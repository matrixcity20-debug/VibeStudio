import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, conversations, messages, systemPrompts, skills } from "../db.js";
import { openrouter } from "../openrouter.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const router = Router();
const IdParam = z.object({ id: z.coerce.number().int().positive() });

// ── Workspace helpers ────────────────────────────────────────────────────────

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces");

async function ensureWorkspaceDir(id) {
  const dir = path.join(WORKSPACES_DIR, String(id));
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function safeJoin(base, userPath) {
  const resolved = path.resolve(base, (userPath || "").replace(/^\/+/, ""));
  if (!resolved.startsWith(base)) throw new Error("Path traversal blocked");
  return resolved;
}

async function readDirTree(dir, base) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const result = [];
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      const rel = path.relative(base, full);
      if (e.isDirectory()) {
        result.push({ type: "dir", path: rel, children: await readDirTree(full, base) });
      } else {
        result.push({ type: "file", path: rel });
      }
    }
    return result;
  } catch {
    return [];
  }
}

async function executeTool(wsDir, name, args) {
  switch (name) {
    case "write_file": {
      const abs = safeJoin(wsDir, args.path);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, args.content ?? "", "utf-8");
      return { ok: true, message: `File '${args.path}' written successfully.` };
    }
    case "read_file": {
      const abs = safeJoin(wsDir, args.path);
      const content = await fs.readFile(abs, "utf-8");
      return { ok: true, content };
    }
    case "delete_file": {
      const abs = safeJoin(wsDir, args.path);
      await fs.rm(abs, { recursive: true, force: true });
      return { ok: true, message: `'${args.path}' deleted.` };
    }
    case "run_command": {
      try {
        const { stdout, stderr } = await execAsync(args.command, {
          cwd: wsDir,
          timeout: 30000,
          env: { ...process.env, PATH: process.env.PATH },
        });
        return { ok: true, output: (stdout + stderr).slice(0, 4000) };
      } catch (err) {
        return {
          ok: false,
          output: ((err.stdout ?? "") + (err.stderr ?? "")).slice(0, 4000),
          error: err.message,
        };
      }
    }
    case "list_files": {
      const tree = await readDirTree(wsDir, wsDir);
      return { ok: true, files: tree };
    }
    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}

// ── Tool definitions ─────────────────────────────────────────────────────────

const WORKSPACE_TOOLS = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List all files and directories currently in the workspace.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the content of an existing file in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to workspace root, e.g. 'src/index.js'" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or overwrite a file in the workspace with the provided content.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to workspace root, e.g. 'index.js' or 'src/app.py'" },
          content: { type: "string", description: "Full text content to write into the file" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a file or directory from the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path or directory to delete" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Execute any shell command in the workspace directory. Use for running scripts (node, python, bash), installing packages (npm install, pip install), compiling, testing, etc.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command string, e.g. 'node index.js' or 'npm install express'" },
        },
        required: ["command"],
      },
    },
  },
];

// ── Conversation routes ──────────────────────────────────────────────────────

router.get("/openrouter/conversations", async (_req, res) => {
  const rows = await db.select().from(conversations).orderBy(conversations.updatedAt);
  res.json(rows.reverse());
});

router.post("/openrouter/conversations", async (req, res) => {
  const body = z.object({
    title: z.string().min(1),
    model: z.string().optional(),
    systemPromptId: z.number().int().positive().nullable().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [conv] = await db.insert(conversations).values({
    title: body.data.title,
    model: body.data.model ?? "meta-llama/llama-3.3-70b-instruct:free",
    systemPromptId: body.data.systemPromptId ?? null,
  }).returning();
  res.status(201).json(conv);
});

router.get("/openrouter/conversations/:id", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, params.data.id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, conv.id)).orderBy(messages.createdAt);
  res.json({ ...conv, messages: msgs });
});

router.patch("/openrouter/conversations/:id", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = z.object({
    title: z.string().optional(),
    model: z.string().optional(),
    systemPromptId: z.number().int().positive().nullable().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const update = {};
  if (body.data.title !== undefined) update.title = body.data.title;
  if (body.data.model !== undefined) update.model = body.data.model;
  if ("systemPromptId" in body.data) update.systemPromptId = body.data.systemPromptId ?? null;

  const [updated] = await db.update(conversations).set(update).where(eq(conversations.id, params.data.id)).returning();
  if (!updated) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.json(updated);
});

router.delete("/openrouter/conversations/:id", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db.delete(conversations).where(eq(conversations.id, params.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.sendStatus(204);
});

router.get("/openrouter/conversations/:id/messages", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, params.data.id)).orderBy(messages.createdAt);
  res.json(msgs);
});

// ── SSE streaming with agentic tool loop ─────────────────────────────────────

router.post("/openrouter/conversations/:id/messages", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = z.object({ content: z.string().min(1) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, params.data.id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  // Save user message
  await db.insert(messages).values({ conversationId: conv.id, role: "user", content: body.data.content });

  // Build message history
  const history = await db.select().from(messages).where(eq(messages.conversationId, conv.id)).orderBy(messages.createdAt);

  // Build system content
  let systemContent = "";
  if (conv.systemPromptId) {
    const [sp] = await db.select().from(systemPrompts).where(eq(systemPrompts.id, conv.systemPromptId));
    if (sp) systemContent += sp.content + "\n\n";
  }
  const activeSkills = await db.select().from(skills).where(eq(skills.isActive, true));
  if (activeSkills.length > 0) {
    systemContent += "## Active Skills\n\n";
    for (const skill of activeSkills) {
      systemContent += `### ${skill.name}\n${skill.content}\n\n`;
    }
  }

  const chatMessages = [];
  if (systemContent.trim()) chatMessages.push({ role: "system", content: systemContent.trim() });
  for (const msg of history) chatMessages.push({ role: msg.role, content: msg.content });

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const wsDir = await ensureWorkspaceDir(conv.id);
  let allMessages = [...chatMessages];
  let fullResponse = "";
  let usedTools = false;
  const MAX_LOOPS = 12;

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    for (let loop = 0; loop < MAX_LOOPS; loop++) {
      let textContent = "";
      let toolCalls = {};
      let finishReason = null;

      // Try with tools first; fall back without tools if model rejects
      let stream;
      let withTools = true;
      try {
        stream = await openrouter.chat.completions.create({
          model: conv.model,
          max_tokens: 8192,
          messages: allMessages,
          tools: WORKSPACE_TOOLS,
          tool_choice: "auto",
          stream: true,
        });
      } catch (err) {
        // Model doesn't support tools — retry without
        withTools = false;
        stream = await openrouter.chat.completions.create({
          model: conv.model,
          max_tokens: 8192,
          messages: allMessages,
          stream: true,
        });
      }

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const chunkFinish = chunk.choices[0]?.finish_reason;
        if (chunkFinish) finishReason = chunkFinish;

        if (delta?.content) {
          textContent += delta.content;
          fullResponse += delta.content;
          sendEvent({ content: delta.content });
        }

        if (withTools && delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCalls[idx]) {
              toolCalls[idx] = { id: "", type: "function", function: { name: "", arguments: "" } };
            }
            if (tc.id) toolCalls[idx].id += tc.id;
            if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
          }
        }
      }

      const toolCallsArray = Object.values(toolCalls);

      if (withTools && finishReason === "tool_calls" && toolCallsArray.length > 0) {
        usedTools = true;

        // Add assistant turn with tool calls
        allMessages.push({
          role: "assistant",
          content: textContent || null,
          tool_calls: toolCallsArray,
        });

        // Execute each tool call and send events
        for (const tc of toolCallsArray) {
          let args = {};
          try { args = JSON.parse(tc.function.arguments); } catch {}

          let result;
          try {
            result = await executeTool(wsDir, tc.function.name, args);
          } catch (err) {
            result = { ok: false, error: err.message };
          }

          // Send tool event to frontend
          const toolEvent = {
            tool_call: {
              name: tc.function.name,
              // Don't send full file content for write_file (too large for SSE)
              args: tc.function.name === "write_file"
                ? { path: args.path }
                : args,
              result: tc.function.name === "write_file"
                ? result.message
                : tc.function.name === "read_file"
                  ? `Read ${result.content?.length ?? 0} chars`
                  : tc.function.name === "run_command"
                    ? result.output?.slice(0, 300)
                    : result.message ?? result.error,
              ok: result.ok,
            },
          };
          sendEvent(toolEvent);

          // Feed result back to model
          allMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }

        // Continue agentic loop
        continue;
      }

      // No more tool calls — we're done
      break;
    }
  } catch (err) {
    console.error("OpenRouter streaming error:", err);
    sendEvent({ error: "Streaming failed" });
    res.end();
    return;
  }

  // Persist assistant response
  if (fullResponse) {
    await db.insert(messages).values({ conversationId: conv.id, role: "assistant", content: fullResponse });
  }

  // Auto-title on first exchange
  if (conv.title === "New Chat" && history.length === 1) {
    await db.update(conversations)
      .set({ title: body.data.content.slice(0, 60).trim() || "Chat" })
      .where(eq(conversations.id, conv.id));
  }

  sendEvent({ done: true, workspaceUpdated: usedTools });
  res.end();
});

export default router;
