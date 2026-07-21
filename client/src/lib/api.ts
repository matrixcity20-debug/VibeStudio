import type { Conversation, Message, SystemPrompt, Skill, Model, WorkspaceFile } from "../types";

const fetchApi = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(url, options);
  if (!res.ok) {
    let message = "API Error";
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {}
    throw new Error(message);
  }
  if (res.status === 204) {
    return undefined as unknown as T;
  }
  return res.json();
};

export const api = {
  // Conversations
  getConversations: () => fetchApi<Conversation[]>("/api/openrouter/conversations"),
  getConversation: (id: number) => fetchApi<Conversation & { messages: Message[] }>(`/api/openrouter/conversations/${id}`),
  createConversation: (data: { title: string; model?: string; systemPromptId?: number }) => 
    fetchApi<Conversation>("/api/openrouter/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  updateConversation: (id: number, data: { title?: string; model?: string; systemPromptId?: number }) =>
    fetchApi<Conversation>(`/api/openrouter/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  deleteConversation: (id: number) =>
    fetchApi<void>(`/api/openrouter/conversations/${id}`, { method: "DELETE" }),

  // System Prompts
  getSystemPrompts: () => fetchApi<SystemPrompt[]>("/api/system-prompts"),
  createSystemPrompt: (data: { name: string; content: string; isDefault?: boolean }) =>
    fetchApi<SystemPrompt>("/api/system-prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  updateSystemPrompt: (id: number, data: { name?: string; content?: string; isDefault?: boolean }) =>
    fetchApi<SystemPrompt>(`/api/system-prompts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  deleteSystemPrompt: (id: number) =>
    fetchApi<void>(`/api/system-prompts/${id}`, { method: "DELETE" }),

  // Skills
  getSkills: () => fetchApi<Skill[]>("/api/skills"),
  createSkill: (data: { name: string; description?: string; content: string; isActive?: boolean }) =>
    fetchApi<Skill>("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  updateSkill: (id: number, data: { name?: string; description?: string; content?: string; isActive?: boolean }) =>
    fetchApi<Skill>(`/api/skills/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  deleteSkill: (id: number) => fetchApi<void>(`/api/skills/${id}`, { method: "DELETE" }),

  // Models
  getModels: () => fetchApi<Model[]>("/api/models"),

  // Workspaces
  getWorkspace: (id: number) => fetchApi<{ conversationId: number; files: WorkspaceFile[] }>(`/api/workspaces/${id}`),
  getWorkspaceFile: (id: number, path: string) => fetchApi<{ path: string; content: string }>(`/api/workspaces/${id}/file?path=${encodeURIComponent(path)}`),
  saveWorkspaceFile: (id: number, path: string, content: string) =>
    fetchApi<{ ok: boolean; path: string }>(`/api/workspaces/${id}/file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content }),
    }),
  deleteWorkspaceFile: (id: number, path: string) =>
    fetchApi<{ ok: boolean }>(`/api/workspaces/${id}/file?path=${encodeURIComponent(path)}`, { method: "DELETE" }),
  runNpm: (id: number, data: { packages: string[]; command: "install" | "uninstall" | "update" }) =>
    fetchApi<{ ok: boolean; output: string }>(`/api/workspaces/${id}/npm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  runCommand: (id: number, command: string) =>
    fetchApi<{ ok: boolean; output: string }>(`/api/workspaces/${id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    }),
};
