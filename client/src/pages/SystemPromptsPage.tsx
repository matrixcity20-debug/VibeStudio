import React, { useEffect, useState } from "react";
import { Plus, TerminalSquare, Edit2, Trash2, Check, X } from "lucide-react";
import { api } from "../lib/api";
import type { SystemPrompt } from "../types";

export function SystemPromptsPage() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const fetchPrompts = async () => {
    try {
      const data = await api.getSystemPrompts();
      setPrompts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const openNewModal = () => {
    setEditingPrompt(null);
    setName("");
    setContent("");
    setIsDefault(false);
    setIsModalOpen(true);
  };

  const openEditModal = (p: SystemPrompt) => {
    setEditingPrompt(p);
    setName(p.name);
    setContent(p.content);
    setIsDefault(p.isDefault);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPrompt(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPrompt) {
        await api.updateSystemPrompt(editingPrompt.id, { name, content, isDefault });
      } else {
        await api.createSystemPrompt({ name, content, isDefault });
      }
      closeModal();
      fetchPrompts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this system prompt?")) return;
    try {
      await api.deleteSystemPrompt(id);
      fetchPrompts();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-base overflow-hidden">
      {/* Header */}
      <div className="h-16 px-8 flex items-center justify-between border-b border-border bg-bg-base">
        <div className="flex items-center gap-3 text-text-primary text-lg font-semibold">
          <TerminalSquare className="w-5 h-5 text-accent" />
          System Prompts
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Prompt
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto grid gap-4">
          {prompts.length === 0 ? (
            <div className="text-center py-12 text-text-muted">No system prompts found.</div>
          ) : (
            prompts.map((p) => (
              <div key={p.id} className="bg-bg-surface border border-border rounded-xl p-5 hover:border-border-subtle transition-colors flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-text-primary text-lg">{p.name}</h3>
                    {p.isDefault && (
                      <span className="bg-accent/10 text-accent text-xs px-2 py-0.5 rounded-full border border-accent/20">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(p)}
                      className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-2 text-text-secondary hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-sm text-text-secondary bg-bg-base p-3 rounded-lg font-mono whitespace-pre-wrap line-clamp-3 border border-border">
                  {p.content}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-panel border border-border rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">
                {editingPrompt ? "Edit System Prompt" : "New System Prompt"}
              </h3>
              <button onClick={closeModal} className="text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col p-5 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary">Name</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent transition-colors"
                  placeholder="e.g. React Developer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary">Content</label>
                <textarea
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  className="w-full bg-bg-surface border border-border rounded-lg px-4 py-3 text-sm font-mono text-text-primary outline-none focus:border-accent transition-colors resize-none"
                  placeholder="You are an expert React developer..."
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative flex items-center justify-center w-5 h-5 border border-border rounded bg-bg-surface data-[checked=true]:bg-accent data-[checked=true]:border-accent transition-colors" data-checked={isDefault}>
                  {isDefault && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                <span className="text-sm text-text-primary">Set as default prompt</span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
