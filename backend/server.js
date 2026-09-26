import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { searchDuckDuckGo } from "./src/engines/duckduckgo.js";
import { searchWikipedia, getWikipediaSummary } from "./src/engines/wikipedia.js";
import { searchBrave } from "./src/engines/brave.js";
import { searchGoogle } from "./src/engines/google.js";
import { fuseResults, buildLens } from "./src/lib/fuse.js";
import { scoreQueryPrivacy, noTrackMiddleware } from "./src/lib/privacy.js";
import { resolveInstantAnswer } from "./src/lib/instantAnswers.js";
import { resolveBang } from "./src/lib/bangs.js";
import { synthesize } from "./src/lib/aiSummary.js";

const app = express();
const PORT = process.env.PORT || 8787;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "16kb" }));
app.use(noTrackMiddleware);

// CORS: allow only configured origins in production; open in local dev
// (when ALLOWED_ORIGINS is empty) so `npm run dev` just works.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.length === 0 || (origin && ALLOWED_ORIGINS.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// No query strings, no user IDs, no cookies in the log line — timing +
// status only, and even that never includes what was searched for.
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

const searchLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down a little." },
});

// Optional convenience: if a sibling ../frontend directory exists, serve it
// as static files so `npm start` alone gives you the whole app at one URL
// (config.js's ASHKAI_API_BASE = "" then just works, same-origin). If
// you're hosting the frontend separately (a static host, a CDN), this is
// simply skipped — the API still works on its own.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
if (fs.existsSync(path.join(FRONTEND_DIR, "index.html"))) {
  app.use(express.static(FRONTEND_DIR));
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/search", searchLimiter, async (req, res) => {
  const query = (req.query.q || "").toString().trim();
  if (!query) return res.status(400).json({ error: "Missing ?q=" });
  if (query.length > 400) return res.status(400).json({ error: "Query too long" });

  // 1. Bang shortcut — short-circuit straight to a redirect target.
  const bang = resolveBang(query);
  if (bang) return res.json({ type: "bang", redirect: bang.url, bang: bang.bang });

  // 2. Instant answer — calculator / unit conversion / time.
  const instant = resolveInstantAnswer(query);

  // 3. Fire all engines in parallel; a slow/dead engine never blocks the rest.
  const engineCalls = [
    { engine: "duckduckgo", promise: searchDuckDuckGo(query) },
    { engine: "wikipedia", promise: searchWikipedia(query) },
  ];
  if (process.env.BRAVE_API_KEY) {
    engineCalls.push({ engine: "brave", promise: searchBrave(query, process.env.BRAVE_API_KEY) });
  }
  if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) {
    engineCalls.push({
      engine: "google",
      promise: searchGoogle(query, process.env.GOOGLE_API_KEY, process.env.GOOGLE_CSE_ID),
    });
  }

  const settled = await Promise.allSettled(engineCalls.map((c) => c.promise));
  const engineResults = settled.map((outcome, i) => ({
    engine: engineCalls[i].engine,
    results: outcome.status === "fulfilled" ? outcome.value : [],
  }));
  const failedEngines = engineResults
    .filter((_, i) => settled[i].status === "rejected")
    .map((e) => e.engine);
  const emptyEngines = engineResults
    .filter((e, i) => settled[i].status === "fulfilled" && e.results.length === 0)
    .map((e) => e.engine);

  const fused = fuseResults(engineResults);
  const lens = buildLens(engineResults);
  const privacy = scoreQueryPrivacy(query);

  // 4. Wikipedia summary card runs alongside, best-effort.
  const wikiSummary = await getWikipediaSummary(query).catch(() => null);

  res.json({
    type: "results",
    query,
    instant,
    wikiSummary,
    results: fused.slice(0, 25),
    lens,
    privacy,
    engines: { queried: engineCalls.map((c) => c.engine), failed: failedEngines, empty: emptyEngines },
    canSynthesize: Boolean(process.env.ANTHROPIC_API_KEY) && fused.length > 0,
  });
});

const synthLimiter = rateLimit({ windowMs: 60_000, limit: 10 });

app.post("/api/synthesize", synthLimiter, async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(404).json({ error: "Synthesize is not enabled on this server." });
  }
  const { query, results } = req.body || {};
  if (!query || !Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ error: "Missing query or results." });
  }
  try {
    const summary = await synthesize(query, results, process.env.ANTHROPIC_API_KEY);
    res.json({ summary });
  } catch (err) {
    console.error("synthesize failed:", err.message);
    res.status(502).json({ error: "Synthesis failed." });
  }
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => {
  console.log(`AshKai backend listening on :${PORT} — no query logs, no cookies, no tracking.`);
});
