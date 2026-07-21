import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Bot, User, CheckCircle2, Save,
  ChevronDown, X, Loader2,
  FileEdit, Trash2, Terminal, FolderOpen, FileSearch,
} from "lucide-react";
import { api } from "../lib/api";
import { WorkspacePanel } from "../components/WorkspacePanel";
import type { Conversation, Message, Model } from "../types";

const getExtension = (lang: string) => {
  const map: Record<string, string> = {
    javascript: "js", js: "js", typescript: "ts", ts: "ts",
    python: "py", py: "py", html: "html", css: "css",
    json: "json", bash: "sh", sh: "sh", shell: "sh",
  };
  return map[lang.toLowerCase()] || "txt";
};

interface ToolCallEvent {
  name: string;
  args: Record<string, string>;
  result?: string;
  ok: boolean;
}

const TOOL_META: Record<string, { icon: React.ReactNode; label: (args: Record<string, string>) => string; color: string }> = {
  write_file:   { icon: <FileEdit className="w-3.5 h-3.5" />,   label: (a) => `Created ${a.path}`,          color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  read_file:    { icon: <FileSearch className="w-3.5 h-3.5" />, label: (a) => `Read ${a.path}`,              color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  delete_file:  { icon: <Trash2 className="w-3.5 h-3.5" />,     label: (a) => `Deleted ${a.path}`,          color: "text-red-400 bg-red-400/10 border-red-400/20" },
  run_command:  { icon: <Terminal className="w-3.5 h-3.5" />,   label: (a) => `$ ${a.command}`,             color: "text-green-400 bg-green-400/10 border-green-400/20" },
  list_files:   { icon: <FolderOpen className="w-3.5 h-3.5" />, label: ()  => "Listed workspace files",     color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
};

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const conversationId = Number(id);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [streamToolCalls, setStreamToolCalls] = useState<ToolCallEvent[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [workspaceRefreshTick, setWorkspaceRefreshTick] = useState(0);

  // Model picker state
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelSearch, setModelSearch] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchChat = async () => {
    try {
      const data = await api.getConversation(conversationId);
      setConversation(data);
      setMessages(data.messages || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchChat();
    setStreamContent("");
    setIsStreaming(false);
    setStreamToolCalls([]);
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent, streamToolCalls]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleSaveToWorkspace = async (content: string, lang: string) => {
    try {
      const ext = getExtension(lang);
      const filename = `snippet_${Math.random().toString(36).substring(2, 8)}.${ext}`;
      await api.saveWorkspaceFile(conversationId, filename, content);
      showToast(`Saved to workspace as ${filename}`);
      setWorkspaceRefreshTick((t) => t + 1);
    } catch (err) {
      console.error("Failed to save snippet", err);
    }
  };

  const openModelPicker = async () => {
    setShowModelPicker(true);
    setModelSearch("");
    if (models.length === 0) {
      setLoadingModels(true);
      try {
        const data = await api.getModels();
        setModels(data);
      } catch (err) {
        console.error("Failed to fetch models", err);
      } finally {
        setLoadingModels(false);
      }
    }
  };

  const handleChangeModel = async (modelId: string) => {
    try {
      await api.updateConversation(conversationId, { model: modelId });
      setShowModelPicker(false);
      fetchChat();
      showToast("Model değiştirildi");
    } catch (err) {
      console.error("Failed to change model", err);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessageContent = input.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const tempUserMsg: Message = {
      id: Date.now(), conversationId, role: "user",
      content: userMessageContent, createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsStreaming(true);
    setStreamContent("");
    setStreamToolCalls([]);

    try {
      const res = await fetch(`/api/openrouter/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessageContent }),
      });
      if (!res.ok) throw new Error("Stream failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      if (!reader) return;

      let accumulated = "";
      let workspaceWasUpdated = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            if (data.error) { console.error("Stream error:", data.error); break; }
            if (data.done) {
              if (data.workspaceUpdated) workspaceWasUpdated = true;
              break;
            }
            if (data.content) {
              accumulated += data.content;
              setStreamContent(accumulated);
            }
            if (data.tool_call) {
              const tc: ToolCallEvent = data.tool_call;
              setStreamToolCalls((prev) => [...prev, tc]);
              // Refresh workspace panel immediately on every workspace mutation
              if (tc.name === "write_file" || tc.name === "delete_file" || tc.name === "run_command") {
                setWorkspaceRefreshTick((t) => t + 1);
              }
            }
          } catch (e) {
            console.error("Error parsing stream data", e, dataStr);
          }
        }
      }

      if (workspaceWasUpdated) setWorkspaceRefreshTick((t) => t + 1);
    } catch (err) {
      console.error(err);
    } finally {
      setIsStreaming(false);
      fetchChat();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  const freeModels = models.filter((m) => m.isFree);
  const filteredModels = freeModels.filter(
    (m) =>
      m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.id.toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <div className="flex-1 flex w-full h-full relative">
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-bg-surface border border-border text-text-primary px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          {toastMessage}
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="h-14 px-6 flex items-center justify-between border-b border-border bg-bg-base flex-shrink-0">
          <h2 className="font-semibold text-text-primary truncate">
            {conversation?.title || "Loading..."}
          </h2>
          {conversation?.model && (
            <button
              onClick={openModelPicker}
              className="ml-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-bg-surface text-text-muted border border-border-subtle hover:border-accent/40 hover:text-text-primary transition-all flex-shrink-0 group"
              title="Modeli değiştir"
            >
              <span className="max-w-[180px] truncate">{conversation.model}</span>
              <ChevronDown className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-3xl mx-auto space-y-8 pb-10">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onSave={handleSaveToWorkspace} />
            ))}

            {/* Streaming assistant turn */}
            {isStreaming && (
              <>
                {/* Live tool call cards */}
                {streamToolCalls.map((tc, i) => (
                  <ToolCallCard key={i} toolCall={tc} />
                ))}
                {/* Live text */}
                {streamContent && (
                  <MessageBubble
                    message={{ id: -1, conversationId, role: "assistant", content: streamContent, createdAt: "" }}
                    onSave={handleSaveToWorkspace}
                  />
                )}
                {/* Waiting indicator */}
                {!streamContent && streamToolCalls.length === 0 && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-accent/10 text-accent border border-accent/20">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1.5 pt-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
              </>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="p-4 bg-bg-base border-t border-border">
          <div className="max-w-3xl mx-auto relative flex items-end bg-bg-surface border border-border-subtle rounded-xl overflow-hidden focus-within:border-accent/50 transition-colors shadow-sm">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Message Vibe Studio..."
              className="flex-1 max-h-[150px] min-h-[44px] bg-transparent text-text-primary placeholder:text-text-muted p-3 outline-none resize-none overflow-y-auto"
              rows={1}
              disabled={isStreaming}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isStreaming}
              className="p-3 text-text-muted hover:text-accent disabled:opacity-50 transition-colors flex-shrink-0 mb-[2px]"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center mt-2 text-[11px] text-text-muted">
            Shift + Enter to add a new line
          </div>
        </div>
      </div>

      {/* Workspace Panel */}
      <WorkspacePanel conversationId={conversationId} refreshTrigger={workspaceRefreshTick} />

      {/* Model Picker Modal */}
      {showModelPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModelPicker(false); }}
        >
          <div className="bg-bg-panel border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
              <div>
                <h2 className="text-text-primary font-semibold text-base">Model Değiştir</h2>
                <p className="text-text-muted text-xs mt-0.5">Kullanmak istediğin AI modelini seç</p>
              </div>
              <button onClick={() => setShowModelPicker(false)} className="text-text-muted hover:text-text-primary p-1 rounded transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 pt-3 pb-2">
              <input
                type="text"
                placeholder="Model ara..."
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 transition-colors"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {loadingModels ? (
                <div className="flex items-center justify-center py-12 gap-2 text-text-muted">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Modeller yükleniyor...</span>
                </div>
              ) : filteredModels.length === 0 ? (
                <div className="text-center py-12 text-text-muted text-sm">
                  {modelSearch ? "Eşleşen model bulunamadı" : "Ücretsiz model bulunamadı"}
                </div>
              ) : (
                filteredModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleChangeModel(model.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all group ${
                      conversation?.model === model.id
                        ? "bg-accent/10 border-accent/30 text-accent"
                        : "bg-bg-surface hover:bg-bg-hover border-transparent hover:border-accent/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate transition-colors ${conversation?.model === model.id ? "text-accent" : "text-text-primary group-hover:text-accent"}`}>
                          {model.name}
                          {conversation?.model === model.id && <span className="ml-2 text-xs opacity-70">(aktif)</span>}
                        </div>
                        <div className="text-text-muted text-xs mt-0.5 truncate font-mono opacity-60">{model.id}</div>
                        {model.contextLength > 0 && (
                          <div className="text-text-muted text-xs mt-1 opacity-50">{model.contextLength.toLocaleString()} token bağlam</div>
                        )}
                      </div>
                      <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium">Ücretsiz</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tool Call Card ────────────────────────────────────────────────────────────

function ToolCallCard({ toolCall }: { toolCall: ToolCallEvent }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TOOL_META[toolCall.name];
  if (!meta) return null;

  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-accent/10 text-accent border border-accent/20">
        <Bot className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${meta.color} ${toolCall.ok ? "" : "opacity-60"}`}
        >
          {meta.icon}
          <span>{meta.label(toolCall.args)}</span>
          {toolCall.result && (
            <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${expanded ? "rotate-180" : ""}`} />
          )}
        </button>
        {expanded && toolCall.result && (
          <pre className="mt-2 p-3 bg-black/40 border border-border rounded-lg text-xs font-mono text-green-400 whitespace-pre-wrap max-h-40 overflow-y-auto">
            {toolCall.result}
          </pre>
        )}
      </div>
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message, onSave }: { message: Message; onSave: (content: string, lang: string) => void }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${isUser ? "bg-bg-surface text-text-secondary" : "bg-accent/10 text-accent border border-accent/20"}`}>
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>
      <div className={`max-w-[85%] ${isUser ? "bg-bg-surface px-4 py-3 rounded-2xl rounded-tr-sm text-text-primary" : "text-text-primary w-full"}`}>
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="prose prose-invert prose-p:leading-relaxed prose-pre:my-0 max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  const lang = match ? match[1] : "";
                  if (!inline && match) {
                    const codeContent = String(children).replace(/\n$/, "");
                    return (
                      <div className="relative group my-4 rounded-lg overflow-hidden border border-border">
                        <div className="flex items-center justify-between px-4 py-1.5 bg-bg-panel border-b border-border text-xs text-text-muted font-mono">
                          <span>{lang}</span>
                          <button
                            onClick={() => onSave(codeContent, lang)}
                            className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-accent bg-bg-surface px-2 py-1 rounded"
                            title="Save to Workspace"
                          >
                            <Save className="w-3 h-3" /> Save
                          </button>
                        </div>
                        <pre className="p-4 bg-bg-base overflow-x-auto text-sm">
                          <code className={className} {...props}>{children}</code>
                        </pre>
                      </div>
                    );
                  }
                  return (
                    <code className="bg-bg-surface text-accent px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
