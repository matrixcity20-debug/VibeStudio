import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { ChatPage } from "./pages/ChatPage";
import { SystemPromptsPage } from "./pages/SystemPromptsPage";
import { SkillsPage } from "./pages/SkillsPage";

function App() {
  return (
    <div className="flex h-screen w-full bg-bg-base overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex overflow-hidden">
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/conversations/:id" element={<ChatPage />} />
          <Route path="/system-prompts" element={<SystemPromptsPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

// Redirects or shows empty state
function HomeRoute() {
  const [hasConversations, setHasConversations] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    fetch("/api/openrouter/conversations")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setHasConversations(data.length > 0))
      .catch(() => setHasConversations(false));
  }, []);

  if (hasConversations === null) {
    return <div className="flex-1 flex items-center justify-center text-text-muted">Loading...</div>;
  }

  if (hasConversations) {
    // Ideally we could redirect to the most recent conversation, but we don't know it here
    // Let's just show an empty chat state, they can click one in the sidebar.
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted bg-bg-base h-full w-full">
        <div className="text-2xl font-semibold text-text-primary mb-2">Vibe Studio</div>
        <p>Select a conversation or create a new chat.</p>
      </div>
    );
  }

  return <Navigate to="/system-prompts" replace />;
}

export default App;
