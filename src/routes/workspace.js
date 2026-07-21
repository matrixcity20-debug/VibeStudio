import { Router } from "express";
import fs from "fs/promises";
import { existsSync, createReadStream } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { z } from "zod";

const execAsync = promisify(exec);
const router = Router();

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces");
const IdParam = z.object({ id: z.coerce.number().int().positive() });

async function ensureWorkspace(conversationId) {
  const dir = path.join(WORKSPACES_DIR, String(conversationId));
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function safeJoin(base, userPath) {
  const resolved = path.resolve(base, userPath.replace(/^\/+/, ""));
  if (!resolved.startsWith(base)) throw new Error("Path traversal blocked");
  return resolved;
}

async function listFilesRecursive(dir, base) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full);
    if (entry.isDirectory()) {
      result.push({ name: entry.name, path: rel, type: "dir", children: await listFilesRecursive(full, base) });
    } else {
      const stat = await fs.stat(full);
      result.push({ name: entry.name, path: rel, type: "file", size: stat.size });
    }
  }
  return result;
}

// GET /api/workspaces/:id — list files
router.get("/workspaces/:id", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const wsDir = await ensureWorkspace(params.data.id);
  const tree = await listFilesRecursive(wsDir, wsDir);
  res.json({ conversationId: params.data.id, files: tree });
});

// GET /api/workspaces/:id/file?path=src/index.js — read a file
router.get("/workspaces/:id/file", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const filePath = req.query.path;
  if (!filePath) { res.status(400).json({ error: "path query param required" }); return; }
  const wsDir = await ensureWorkspace(params.data.id);
  try {
    const abs = safeJoin(wsDir, filePath);
    const content = await fs.readFile(abs, "utf-8");
    res.json({ path: filePath, content });
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

// POST /api/workspaces/:id/file — write / create a file
router.post("/workspaces/:id/file", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = z.object({ path: z.string().min(1), content: z.string() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const wsDir = await ensureWorkspace(params.data.id);
  try {
    const abs = safeJoin(wsDir, body.data.path);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, body.data.content, "utf-8");
    res.json({ ok: true, path: body.data.path });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/workspaces/:id/file?path=src/index.js — delete a file or folder
router.delete("/workspaces/:id/file", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const filePath = req.query.path;
  if (!filePath) { res.status(400).json({ error: "path query param required" }); return; }
  const wsDir = await ensureWorkspace(params.data.id);
  try {
    const abs = safeJoin(wsDir, filePath);
    await fs.rm(abs, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces/:id/npm — run npm install [packages]
router.post("/workspaces/:id/npm", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = z.object({
    packages: z.array(z.string()).optional(),
    command: z.enum(["install", "uninstall", "update"]).default("install"),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const wsDir = await ensureWorkspace(params.data.id);

  // Ensure package.json exists
  const pkgPath = path.join(wsDir, "package.json");
  if (!existsSync(pkgPath)) {
    await fs.writeFile(pkgPath, JSON.stringify({ name: `workspace-${params.data.id}`, version: "1.0.0", type: "commonjs" }, null, 2));
  }

  const pkgs = (body.data.packages ?? []).join(" ");
  const cmd = `npm ${body.data.command} ${pkgs} --prefix ${wsDir} 2>&1`;

  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd: wsDir, timeout: 60000 });
    res.json({ ok: true, output: stdout + (stderr ?? "") });
  } catch (err) {
    res.status(500).json({ ok: false, output: err.stdout ?? "", error: err.message });
  }
});

// POST /api/workspaces/:id/run — run a shell command inside the workspace
router.post("/workspaces/:id/run", async (req, res) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = z.object({ command: z.string().min(1) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const wsDir = await ensureWorkspace(params.data.id);

  try {
    const { stdout, stderr } = await execAsync(body.data.command, {
      cwd: wsDir,
      timeout: 30000,
      env: { ...process.env, PATH: process.env.PATH },
    });
    res.json({ ok: true, output: stdout + (stderr ?? "") });
  } catch (err) {
    res.status(500).json({ ok: false, output: (err.stdout ?? "") + (err.stderr ?? ""), error: err.message });
  }
});

export default router;
