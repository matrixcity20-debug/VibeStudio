import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, skills } from "../db.js";
import { z } from "zod";

const router = Router();
const IdParam = z.object({ id: z.coerce.number().int().positive() });

router.get("/skills", async (_req, res) => {
  const rows = await db.select().from(skills).orderBy(skills.createdAt);
  res.json(rows);
});

router.post("/skills", async (req, res) => {
  const body = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    content: z.string().min(1),
    isActive: z.boolean().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [created] = await db.insert(skills).values({
    name: body.data.name,
    description: body.data.description ?? "",
    content: body.data.content,
    isActive: body.data.isActive ?? true,
  }).returning();
  res.status(201).json(created);
});

router.patch("/skills/:id", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    content: z.string().optional(),
    isActive: z.boolean().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const update = {};
  if (body.data.name !== undefined) update.name = body.data.name;
  if (body.data.description !== undefined) update.description = body.data.description;
  if (body.data.content !== undefined) update.content = body.data.content;
  if (body.data.isActive !== undefined) update.isActive = body.data.isActive;

  const [updated] = await db.update(skills).set(update).where(eq(skills.id, params.data.id)).returning();
  if (!updated) { res.status(404).json({ error: "Skill not found" }); return; }
  res.json(updated);
});

router.delete("/skills/:id", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db.delete(skills).where(eq(skills.id, params.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Skill not found" }); return; }
  res.sendStatus(204);
});

export default router;
