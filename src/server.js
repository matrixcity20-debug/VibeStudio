import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import openrouterRouter from "./routes/openrouter.js";
import systemPromptsRouter from "./routes/system-prompts.js";
import skillsRouter from "./routes/skills.js";
import modelsRouter from "./routes/models.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", openrouterRouter);
app.use("/api", systemPromptsRouter);
app.use("/api", skillsRouter);
app.use("/api", modelsRouter);

// Health check
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// Serve built frontend
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Vibe Studio running at http://localhost:${port}`);
});
