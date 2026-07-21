import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Plus, Settings2, TerminalSquare, Trash2, MessageSquare, Zap, ChevronDown, X, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import type { Conversation, Model } from "../types";

export function Sidebar() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchConversations = async () => {
    try {
      const data = await api.getConversations();
      setConversations(data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    } catch (err) {
      console.error("Failed to fetch conversations", err);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 3000);
    return () => clearInterval(interval);
  }, []);

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

  const handleSelectModel = async (modelId: string) => {
    setCreating(true);
    try {
      const conv = await api.createConversation({ title: "New Chat", model: modelId });
      setShowModelPicker(false);
      fetchConversations();
      navigate(`/conversations/${conv.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.deleteConversation(id);
      if (location.pathname === `/conversations/${id}`) {
        navigate("/");
      }
      fetchConversations();
    } catch (err) {
      console.error(err);
    }
  };

  const freeModels = models.filter((m) => m.isFree);
  const filteredModels = freeModels.filter(
    (m) =>
      m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.id.toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <>
      <div className="w-[260px] flex-shrink-0 flex flex-col bg-bg-panel border-r border-border h-full">
        {/* Header */}
        <div className="p-4 flex items-center gap-2 text-text-primary font-bold text-lg border-b border-border-subtle">
          <Zap className="w-5 h-5 text-accent" />
          Vibe Studio
        </div>

        {/* New Chat */}
        <div className="p-3">
          <button
            onClick={openModelPicker}
            className="w-full flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Chat
            <ChevronDown className="w-3.5 h-3.5 ml-auto opacity-70" />
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <div className="text-xs font-semibold text-text-muted px-2 py-2 mb-1 tracking-wider uppercase">
            Conversations
          </div>
          <div className="space-y-0.5">
            {conversations.map((conv) => {
              const isActive = location.pathname === `/conversations/${conv.id}`;
              return (
                <Link
                  key={conv.id}
                  to={`/conversations/${conv.id}`}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-bg-active text-text-primary border-l-2 border-accent"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <MessageSquare className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{conv.title || "Untitled Chat"}</span>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, conv.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 hover:bg-red-400/10 rounded transition-all"
                    title="Delete Chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Bottom Nav */}
        <div className="p-2 border-t border-border-subtle space-y-1">
          <Link
            to="/system-prompts"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              location.pathname === "/system-prompts"
                ? "bg-bg-active text-text-primary"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
          >
            <TerminalSquare className="w-4 h-4" />
            System Prompts
          </Link>
          <Link
            to="/skills"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              location.pathname === "/skills"
                ? "bg-bg-active text-text-primary"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
          >
            <Settings2 className="w-4 h-4" />
            Skills
          </Link>
        </div>
      </div>

      {/* Model Picker Modal */}
      {showModelPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModelPicker(false); }}
        >
          <div
            ref={modalRef}
            className="bg-bg-panel border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
              <div>
                <h2 className="text-text-primary font-semibold text-base">Ücretsiz Model Seç</h2>
                <p className="text-text-muted text-xs mt-0.5">Konuşmak istediğin AI modelini seç</p>
              </div>
              <button
                onClick={() => setShowModelPicker(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
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

            {/* Model List */}
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
                    onClick={() => handleSelectModel(model.id)}
                    disabled={creating}
                    className="w-full text-left px-4 py-3 rounded-xl bg-bg-surface hover:bg-bg-hover border border-transparent hover:border-accent/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-text-primary text-sm font-medium truncate group-hover:text-accent transition-colors">
                          {model.name}
                        </div>
                        <div className="text-text-muted text-xs mt-0.5 truncate font-mono opacity-60">
                          {model.id}
                        </div>
                        {model.contextLength > 0 && (
                          <div className="text-text-muted text-xs mt-1 opacity-50">
                            {model.contextLength.toLocaleString()} token bağlam
                          </div>
                        )}
                      </div>
                      <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium">
                        Ücretsiz
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
