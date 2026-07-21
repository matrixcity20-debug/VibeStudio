import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Plus, Settings2, TerminalSquare, Trash2, MessageSquare, Zap } from "lucide-react";
import { api } from "../lib/api";
import type { Conversation } from "../types";

export function Sidebar() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
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

  const handleNewChat = async () => {
    try {
      const conv = await api.createConversation({ title: "New Chat" });
      fetchConversations();
      navigate(`/conversations/${conv.id}`);
    } catch (err) {
      console.error(err);
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

  return (
    <div className="w-[260px] flex-shrink-0 flex flex-col bg-bg-panel border-r border-border h-full">
      {/* Header */}
      <div className="p-4 flex items-center gap-2 text-text-primary font-bold text-lg border-b border-border-subtle">
        <Zap className="w-5 h-5 text-accent" />
        Vibe Studio
      </div>

      {/* New Chat */}
      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Chat
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
  );
}
