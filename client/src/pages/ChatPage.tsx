import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Bot, User, CheckCircle2, Save } from "lucide-react";
import { api } from "../lib/api";
import { WorkspacePanel } from "../components/WorkspacePanel";
import type { Conversation, Message } from "../types";

// Helper to guess extension
const getExtension = (lang: string) => {
  const map: Record<string, string> = {
    javascript: "js", js: "js",
    typescript: "ts", ts: "ts",
    python: "py", py: "py",
    html: "html", css: "css",
    json: "json",
    bash: "sh", sh: "sh", shell: "sh",
  };
  return map[lang.toLowerCase()] || "txt";
};

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const conversationId = Number(id);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

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
    } catch (err) {
      console.error("Failed to save snippet", err);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessageContent = input.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: Date.now(),
      conversationId,
      role: "user",
      content: userMessageContent,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setIsStreaming(true);
    setStreamContent("");

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
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                console.error("Stream error:", data.error);
                break;
              }
              if (data.done) {
                break;
              }
              if (data.content) {
                accumulated += data.content;
                setStreamContent(accumulated);
              }
            } catch (e) {
              console.error("Error parsing stream data", e, dataStr);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsStreaming(false);
      fetchChat(); // Refresh to get proper IDs and final state
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  return (
    <div className="flex-1 flex w-full h-full relative">
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-bg-surface border border-border text-text-primary px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          {toastMessage}
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="h-14 px-6 flex items-center border-b border-border bg-bg-base flex-shrink-0">
          <h2 className="font-semibold text-text-primary">
            {conversation?.title || "Loading..."}
          </h2>
          {conversation?.model && (
            <span className="ml-3 px-2 py-0.5 rounded text-xs bg-bg-surface text-text-muted border border-border-subtle">
              {conversation.model}
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-3xl mx-auto space-y-8 pb-10">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onSave={handleSaveToWorkspace} />
            ))}
            {isStreaming && (
              <MessageBubble 
                message={{ id: -1, conversationId, role: "assistant", content: streamContent, createdAt: "" }} 
                onSave={handleSaveToWorkspace}
              />
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
      <WorkspacePanel conversationId={conversationId} />
    </div>
  );
}

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
                  const isCodeBlock = !inline && match;
                  
                  if (isCodeBlock) {
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
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    );
                  }
                  
                  return (
                    <code className="bg-bg-surface text-accent px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                      {children}
                    </code>
                  );
                }
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
