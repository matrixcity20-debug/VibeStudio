import React, { useEffect, useState } from "react";
import { Plus, Settings2, Edit2, Trash2, Check, X, Power } from "lucide-react";
import { api } from "../lib/api";
import type { Skill } from "../types";

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [isActive, setIsActive] = useState(true);

  const fetchSkills = async () => {
    try {
      const data = await api.getSkills();
      setSkills(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const openNewModal = () => {
    setEditingSkill(null);
    setName("");
    setDescription("");
    setContent("");
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (s: Skill) => {
    setEditingSkill(s);
    setName(s.name);
    setDescription(s.description || "");
    setContent(s.content);
    setIsActive(s.isActive);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSkill(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSkill) {
        await api.updateSkill(editingSkill.id, { name, description, content, isActive });
      } else {
        await api.createSkill({ name, description, content, isActive });
      }
      closeModal();
      fetchSkills();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this skill?")) return;
    try {
      await api.deleteSkill(id);
      fetchSkills();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleActive = async (s: Skill) => {
    try {
      await api.updateSkill(s.id, { isActive: !s.isActive });
      fetchSkills();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-base overflow-hidden">
      {/* Header */}
      <div className="h-16 px-8 flex items-center justify-between border-b border-border bg-bg-base">
        <div className="flex items-center gap-3 text-text-primary text-lg font-semibold">
          <Settings2 className="w-5 h-5 text-accent" />
          Skills
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Skill
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {skills.length === 0 ? (
            <div className="col-span-full text-center py-12 text-text-muted">No skills found.</div>
          ) : (
            skills.map((s) => (
              <div key={s.id} className={`bg-bg-surface border rounded-xl p-5 transition-colors flex flex-col h-full ${s.isActive ? 'border-border hover:border-accent/50' : 'border-border border-dashed opacity-75'}`}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-text-primary text-lg flex items-center gap-2">
                    {s.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive(s)}
                      className={`p-1.5 rounded-md transition-colors ${s.isActive ? 'text-green-400 hover:bg-green-400/10' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}
                      title={s.isActive ? "Deactivate" : "Activate"}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(s)}
                      className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 text-text-secondary hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {s.description && (
                  <p className="text-sm text-text-secondary mb-4 line-clamp-2">{s.description}</p>
                )}
                <div className="mt-auto pt-4 border-t border-border">
                  <div className="text-xs text-text-muted font-mono truncate">
                    {s.content.substring(0, 60)}...
                  </div>
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
                {editingSkill ? "Edit Skill" : "New Skill"}
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
                  placeholder="e.g. Supabase Knowledge"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent transition-colors"
                  placeholder="Brief summary..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary">Content (Knowledge Base)</label>
                <textarea
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="w-full bg-bg-surface border border-border rounded-lg px-4 py-3 text-sm font-mono text-text-primary outline-none focus:border-accent transition-colors resize-none"
                  placeholder="Paste context, documentation, or guidelines here..."
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative flex items-center justify-center w-5 h-5 border border-border rounded bg-bg-surface data-[checked=true]:bg-accent data-[checked=true]:border-accent transition-colors" data-checked={isActive}>
                  {isActive && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className="text-sm text-text-primary">Active</span>
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
