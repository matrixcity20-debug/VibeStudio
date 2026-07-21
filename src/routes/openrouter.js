import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, conversations, messages, systemPrompts, skills } from "../db.js";
import { openrouter } from "../openrouter.js";
import { z } from "zod";

const router = Router();

const IdParam = z.object({ id: z.coerce.number().int().positive() });

// GET /api/openrouter/conversations
router.get("/openrouter/conversations", async (_req, res) => {
  const rows = await db.select().from(conversations).orderBy(conversations.updatedAt);
  res.json(rows.reverse());
});

// POST /api/openrouter/conversations
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

// GET /api/openrouter/conversations/:id
router.get("/openrouter/conversations/:id", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, params.data.id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, conv.id)).orderBy(messages.createdAt);
  res.json({ ...conv, messages: msgs });
});

// PATCH /api/openrouter/conversations/:id
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

// DELETE /api/openrouter/conversations/:id
router.delete("/openrouter/conversations/:id", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db.delete(conversations).where(eq(conversations.id, params.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.sendStatus(204);
});

// GET /api/openrouter/conversations/:id/messages
router.get("/openrouter/conversations/:id/messages", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, params.data.id)).orderBy(messages.createdAt);
  res.json(msgs);
});

// POST /api/openrouter/conversations/:id/messages — SSE streaming
router.post("/openrouter/conversations/:id/messages", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = z.object({ content: z.string().min(1) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, params.data.id));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  // Save user message
  await db.insert(messages).values({ conversationId: conv.id, role: "user", content: body.data.content });

  // Get history
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

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  try {
    const stream = await openrouter.chat.completions.create({
      model: conv.model,
      max_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
  } catch (err) {
    console.error("OpenRouter streaming error:", err);
    res.write(`data: ${JSON.stringify({ error: "Streaming failed" })}\n\n`);
    res.end();
    return;
  }

  await db.insert(messages).values({ conversationId: conv.id, role: "assistant", content: fullResponse });

  if (conv.title === "New Chat" && history.length === 1) {
    await db.update(conversations).set({ title: body.data.content.slice(0, 60).trim() || "Chat" }).where(eq(conversations.id, conv.id));
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
