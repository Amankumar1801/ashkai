# AshKai

A private meta-search engine. AshKai queries several independent search
engines on your behalf, blends their results into one ranking, and keeps
nothing about you afterward — no query logs, no cookies, no accounts, no
tracking pixels, not even a request to Google Fonts (the fonts are
bundled in the repo).

It's a real, runnable full-stack app: a Node/Express backend that talks to
upstream engines server-side (so your IP and browser fingerprint never
reach them directly), and a plain HTML/CSS/JS frontend with no build step
and no framework.

## What it has that a private search engine should have

- **No logs.** The server logs method/path/status/timing only — never the
  query string, never an IP (`X-Forwarded-For` / `X-Real-IP` are stripped
  before any route handler runs).
- **No cookies, no accounts, no tracking.**
- **Server-side fetch, rotating User-Agent.** Your browser never talks to
  DuckDuckGo, Wikipedia, Brave, or Google directly — AshKai's server does, so
  upstream engines see AshKai's IP, not yours.
- **Tracking-parameter stripping.** `utm_*`, `fbclid`, `gclid`, `msclkid`
  and similar are stripped from every result URL before you see it.
- **Rate limiting** on both API routes, to keep one client from hammering
  upstream engines on everyone's behalf.
- **Bang shortcuts** (`!w query`, `!gh query`, `!yt query`, …) that jump
  straight to a site's own search.
- **Instant answers** for calculator expressions, unit conversions, and
  the time — resolved locally, no engine ever sees them.

## What makes it stand on its own

- **Rank fusion, not "pick one engine."** Results from every engine are
  merged with Reciprocal Rank Fusion (the same family of technique
  SearXNG and academic meta-search systems use — see
  `backend/src/lib/fuse.js`), so a page multiple independent engines
  agree on consistently outranks a page only one engine (or one SEO
  campaign) pushed to the top.
- **The Ledger.** Every search opens a small inspector panel showing
  *exactly* what happened: which engines answered, which were
  unreachable, and — per engine — the unblended top results, so you can
  see where the engines actually disagree (a real, visible filter-bubble
  check) instead of trusting one hidden ranking.
- **A query privacy score.** Before your query goes anywhere, AshKai
  flags patterns that would identify you if sent to a logging search
  engine directly — an email, a phone number, a street address, a
  first-person medical or legal question — and shows you a plain-English
  exposure score. Advisory only, computed fresh every time, never stored.
- **A local, encrypted, self-destructing search vault.** Opt-in, off by
  default. If you turn it on, your recent searches are kept — AES-GCM
  encrypted — only in your own browser's `localStorage`, and every entry
  expires after 24 hours on its own. AshKai's server never sees this list
  at all; there's nothing to send.
- **Optional one-click synthesis.** If you add your own Anthropic API
  key, a "Summarize top results" button appears that asks Claude to
  write one short, source-cited paragraph from the top results for the
  query you're already looking at — never run automatically, never used
  to re-rank anything.
- **Self-hosted fonts.** Even the typefaces are bundled as local `.woff2`
  files, so loading the page never pings Google Fonts.

## Architecture

```
ashkai/
  backend/
    server.js              Express app, routes, wiring
    src/engines/
      duckduckgo.js         HTML-endpoint scrape (cheerio), no key needed
      wikipedia.js           search API + summary API, no key needed
      brave.js                official API, optional (needs a key)
      google.js               Google Programmable Search, optional (free tier, needs a key)
    src/lib/
      fuse.js                Reciprocal Rank Fusion + dedup + the Lens view
      privacy.js              URL tracking-param stripping + query privacy score
      instantAnswers.js       calculator / unit conversion / time
      bangs.js                 !bang shortcuts
      aiSummary.js              optional Claude-powered synthesis
  frontend/
    index.html, style.css, app.js, config.js, fonts/
  Dockerfile, docker-compose.yml
```

Request flow for a normal search:

```
browser --GET /api/search?q=...--> AshKai server
                                        |-- bang? --> redirect, done
                                        |-- instant answer? (local, always runs)
                                        |-- DuckDuckGo  --\
                                        |-- Wikipedia    ---> Promise.allSettled --> fuseResults() --> response
                                        |-- Brave (opt.) --/
                                        |-- Google (opt.)-/
```

Every engine call is wrapped in `Promise.allSettled` with its own timeout,
so one slow or blocked engine never breaks the others — you get a partial
blend instead of an error, and the Ledger tells you which engine failed.

## Quickstart (local)

Requires Node 18+.

```bash
cd backend
cp .env.example .env      # defaults work with zero keys
npm install
npm start
```

Open **http://localhost:8787** — the backend serves the frontend itself,
so that's the whole app, no separate frontend server needed. Try a plain
query, `!w graph theory`, `5 km to miles`, or `12 * (7 + 3)`.

For auto-reload while you work on the backend: `npm run dev`.

## Configuration

All optional — AshKai works with zero API keys. See `backend/.env.example`:

| Variable | Effect |
|---|---|
| `PORT` | Backend port (default `8787`) |
| `BRAVE_API_KEY` | Adds Brave's independent index to the blend |
| `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` | Adds Google's official Programmable Search (100 free queries/day) — a real API, not a scrape |
| `ANTHROPIC_API_KEY` | Enables the "Synthesize" button |
| `ASHKAI_SUMMARY_MODEL` | Model for synthesis (default `claude-haiku-4-5-20251001`) |
| `ALLOWED_ORIGINS` | Comma-separated origins allowed to call the API in production |

If you host the frontend separately from the backend, edit
`frontend/config.js` and set `window.ASHKAI_API_BASE` to your backend's
URL.

## Deploying it as a live app

Pick whichever you're already comfortable with — the app is a single
Node process, so any of these work:

- **Render / Railway / Fly.io** — connect the repo, set the root/start
  command to `cd backend && npm install && npm start`, add any env vars
  from the table above. All three have free or low-cost tiers.
- **Docker anywhere** (a VPS, Fly, Railway, your own box):
  ```bash
  docker compose up --build -d
  ```
- **A plain VPS**: install Node 18+, clone the repo, `cd backend && npm
  install`, then run it under `pm2` or a `systemd` unit so it survives
  reboots; put it behind Caddy or nginx for TLS.

Whichever you choose, once it's live, set `ALLOWED_ORIGINS` to your real
domain to lock the API down to your own frontend.

## Extending it

- **Add another engine:** create `backend/src/engines/yourengine.js`
  exporting an async function that returns `[{url, title, snippet}, ...]`,
  then add it to the `engineCalls` array in `server.js`. `fuseResults()`
  picks it up automatically.
- **Add a bang:** add one line to `BANGS` in `backend/src/lib/bangs.js`.
- **Change the fusion weighting:** `fuse.js`'s `K` constant controls how
  much the top of each engine's list dominates — lower it to trust
  top-ranked results more, raise it to flatten the blend.

## Known limitations, honestly

- DuckDuckGo's HTML endpoint isn't an official API — it's the same
  approach SearXNG and similar projects use. It can go quiet (return zero
  results with no error) if DuckDuckGo rate-limits or challenges the
  request, which is more likely from a datacenter/cloud IP than from
  your own machine. The Ledger panel shows this honestly: an engine
  chip reading "no results" (amber) means it was reachable but came back
  empty — check the terminal running the server for a matching warning
  log. If you're seeing only Wikipedia results, this is almost always
  why. **Fix:** add a `GOOGLE_API_KEY`/`GOOGLE_CSE_ID` or `BRAVE_API_KEY`
  in `.env` — both are official APIs, not scrapes, so they don't have
  this problem, and results will immediately get more diverse.
- The search vault's encryption key lives in the same browser storage as
  the data it protects (see the comment in `app.js`) — it guards against
  casual inspection and guarantees auto-expiry, not against someone with
  access to your unlocked device.
- No JavaScript-rendered engines are scraped (by design — server-side
  headless browsing is heavier, slower, and a bigger attack surface for
  very little relevance gain over the four sources already here).
