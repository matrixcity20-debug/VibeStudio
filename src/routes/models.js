import { Router } from "express";

const router = Router();
let modelsCache = null;
const CACHE_TTL = 5 * 60 * 1000;

router.get("/models", async (req, res) => {
  try {
    const now = Date.now();
    if (modelsCache && now - modelsCache.fetchedAt < CACHE_TTL) {
      res.json(modelsCache.data);
      return;
    }

    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://vibe-studio.app",
        "X-Title": "Vibe Studio",
      },
    });

    if (!response.ok) {
      res.status(502).json({ error: "Failed to fetch models from OpenRouter" });
      return;
    }

    const raw = await response.json();
    const models = raw.data
      .map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        description: m.description ?? "",
        contextLength: m.context_length ?? 0,
        isFree: m.pricing?.prompt === "0" && m.pricing?.completion === "0",
      }))
      .sort((a, b) => {
        if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    modelsCache = { data: models, fetchedAt: now };
    res.json(models);
  } catch (err) {
    console.error("Error fetching models:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
