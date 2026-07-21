import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, systemPrompts } from "../db.js";
import { z } from "zod";

const router = Router();
const IdParam = z.object({ id: z.coerce.number().int().positive() });

router.get("/system-prompts", async (_req, res) => {
  const rows = await db.select().from(systemPrompts).orderBy(systemPrompts.createdAt);
  res.json(rows);
});

router.post("/system-prompts", async (req, res) => {
  const body = z.object({
    name: z.string().min(1),
    content: z.string().min(1),
    isDefault: z.boolean().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  if (body.data.isDefault) await db.update(systemPrompts).set({ isDefault: false });

  const [created] = await db.insert(systemPrompts).values({
    name: body.data.name,
    content: body.data.content,
    isDefault: body.data.isDefault ?? false,
  }).returning();
  res.status(201).json(created);
});

router.patch("/system-prompts/:id", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = z.object({
    name: z.string().optional(),
    content: z.string().optional(),
    isDefault: z.boolean().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  if (body.data.isDefault) await db.update(systemPrompts).set({ isDefault: false });

  const update = {};
  if (body.data.name !== undefined) update.name = body.data.name;
  if (body.data.content !== undefined) update.content = body.data.content;
  if (body.data.isDefault !== undefined) update.isDefault = body.data.isDefault;

  const [updated] = await db.update(systemPrompts).set(update).where(eq(systemPrompts.id, params.data.id)).returning();
  if (!updated) { res.status(404).json({ error: "System prompt not found" }); return; }
  res.json(updated);
});

router.delete("/system-prompts/:id", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db.delete(systemPrompts).where(eq(systemPrompts.id, params.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "System prompt not found" }); return; }
  res.sendStatus(204);
});

export default router;
