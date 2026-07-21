import React, { useEffect, useState, useRef } from "react";
import { ChevronRight, ChevronLeft, Folder, File as FileIcon, Plus, Trash2, Terminal, Play, CheckCircle2 } from "lucide-react";
import { api } from "../lib/api";
import type { WorkspaceFile } from "../types";

export function WorkspacePanel({ conversationId }: { conversationId: number }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchFiles = async () => {
    try {
      const data = await api.getWorkspace(conversationId);
      setFiles(data.files || []);
    } catch (err) {
      console.error("Failed to fetch workspace files", err);
    }
  };

  useEffect(() => {
    if (isCollapsed) return;
    fetchFiles();
    const interval = setInterval(fetchFiles, 5000);
    return () => clearInterval(interval);
  }, [conversationId, isCollapsed]);

  useEffect(() => {
    if (selectedFilePath) {
      api.getWorkspaceFile(conversationId, selectedFilePath)
        .then(res => setFileContent(res.content))
        .catch(err => console.error("Failed to fetch file content", err));
    } else {
      setFileContent("");
    }
  }, [selectedFilePath, conversationId]);

  const handleSaveFile = async (content: string) => {
    if (!selectedFilePath) return;
    setIsSaving(true);
    try {
      await api.saveWorkspaceFile(conversationId, selectedFilePath, content);
      showToast(`Saved: ${selectedFilePath}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    try {
      await api.saveWorkspaceFile(conversationId, newFileName, "");
      setNewFileName("");
      setShowNewFileInput(false);
      fetchFiles();
      setSelectedFilePath(newFileName);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFile = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    try {
      await api.deleteWorkspaceFile(conversationId, path);
      if (selectedFilePath === path) setSelectedFilePath(null);
      fetchFiles();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;
    const cmd = terminalInput;
    setTerminalInput("");
    setTerminalOutput(prev => prev + `\n$ ${cmd}\nRunning...`);
    
    try {
      let res;
      if (cmd.startsWith("npm ")) {
        const parts = cmd.split(" ");
        const action = parts[1] as "install" | "uninstall" | "update";
        const pkgs = parts.slice(2);
        res = await api.runNpm(conversationId, { command: action, packages: pkgs });
      } else {
        res = await api.runCommand(conversationId, cmd);
      }
      setTerminalOutput(prev => prev.replace("Running...", "") + (res.output || "\nDone."));
    } catch (err: any) {
      setTerminalOutput(prev => prev.replace("Running...", "") + `\nError: ${err.message}`);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const renderFileTree = (nodes: WorkspaceFile[], prefix = "") => {
    return nodes.map(node => (
      <div key={prefix + node.path} className="ml-3">
        {node.type === "dir" ? (
          <div>
            <div className="flex items-center gap-1.5 py-1 text-sm text-text-secondary">
              <Folder className="w-3.5 h-3.5" />
              {node.name}
            </div>
            {node.children && renderFileTree(node.children, prefix + node.path + "/")}
          </div>
        ) : (
          <div
            className={`group flex items-center justify-between py-1 px-1.5 rounded cursor-pointer text-sm transition-colors ${
              selectedFilePath === node.path
                ? "bg-bg-active text-accent"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
            onClick={() => setSelectedFilePath(node.path)}
          >
            <div className="flex items-center gap-1.5 overflow-hidden">
              <FileIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{node.name}</span>
            </div>
            <button
              onClick={(e) => handleDeleteFile(e, node.path)}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 rounded"
              title="Delete File"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    ));
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-bg-panel border-l border-border flex flex-col items-center py-4">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
          title="Expand Workspace"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[380px] flex-shrink-0 bg-bg-panel border-l border-border flex flex-col h-full relative">
      {/* Toast */}
      {toastMessage && (
        <div className="absolute top-16 right-4 z-50 bg-bg-surface border border-border text-text-primary text-xs px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-bg-panel flex-shrink-0">
        <div className="font-semibold text-text-primary flex items-center gap-2">
          <Folder className="w-4 h-4 text-accent" />
          Workspace
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
          title="Collapse Workspace"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* File Tree (40%) */}
      <div className="flex flex-col h-[40%] border-b border-border overflow-hidden">
        <div className="px-3 py-2 flex items-center justify-between bg-bg-active/30 border-b border-border-subtle">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Files</span>
          <button
            onClick={() => setShowNewFileInput(true)}
            className="p-1 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 pr-3 -ml-3">
          {showNewFileInput && (
            <form onSubmit={handleCreateFile} className="ml-3 px-1.5 py-1 mb-1">
              <input
                autoFocus
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onBlur={() => { if (!newFileName.trim()) setShowNewFileInput(false); }}
                placeholder="filename.ext"
                className="w-full bg-bg-surface border border-accent rounded px-2 py-0.5 text-sm text-text-primary outline-none font-mono"
              />
            </form>
          )}
          {files.length === 0 && !showNewFileInput ? (
            <div className="text-center text-xs text-text-muted mt-4">No files yet.</div>
          ) : (
            renderFileTree(files)
          )}
        </div>
      </div>

      {/* Editor (40%) */}
      <div className="flex flex-col h-[40%] border-b border-border bg-bg-base overflow-hidden relative">
        {selectedFilePath ? (
          <>
            <div className="px-3 py-1.5 flex items-center gap-2 bg-bg-surface border-b border-border-subtle">
              <FileIcon className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs font-mono text-text-primary truncate">{selectedFilePath}</span>
              {isSaving && <span className="text-[10px] text-text-muted ml-auto">Saving...</span>}
            </div>
            <textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              onBlur={(e) => handleSaveFile(e.target.value)}
              className="flex-1 w-full bg-transparent p-3 text-sm font-mono text-text-primary outline-none resize-none"
              spellCheck={false}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
            Select a file to edit
          </div>
        )}
      </div>

      {/* Terminal (20%) */}
      <div className="flex flex-col h-[20%] bg-black overflow-hidden relative group">
        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
        <div className="flex-1 overflow-y-auto p-2 text-xs font-mono whitespace-pre-wrap text-green-400">
          {terminalOutput || "Terminal ready."}
        </div>
        <form onSubmit={handleRunCommand} className="flex items-center border-t border-[#333] bg-[#0a0a0a]">
          <div className="px-2 text-accent">❯</div>
          <input
            type="text"
            value={terminalInput}
            onChange={(e) => setTerminalInput(e.target.value)}
            placeholder="npm install <pkg> or node index.js"
            className="flex-1 bg-transparent py-1.5 text-xs font-mono text-text-primary outline-none"
          />
          <button type="submit" className="p-1.5 text-text-secondary hover:text-text-primary">
            <Play className="w-3 h-3" />
          </button>
        </form>
      </div>
    </div>
  );
}
