export interface Conversation {
  id: number;
  title: string;
  model: string;
  systemPromptId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: number;
  conversationId: number;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface SystemPrompt {
  id: number;
  name: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: number;
  name: string;
  description: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Model {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  isFree: boolean;
}

export interface WorkspaceFile {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: WorkspaceFile[];
}
