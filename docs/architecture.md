# AshKai architecture

The maintained quickstart in the root README targets the application in
the repository-root `backend/` and `frontend/` directories. The separate
`ashkai/` directory contains a divergent copy and is not used by those
instructions.

## Request flow

![Diagram of a search request through AshKai and its configured providers](media/search-flow.svg)

A regular search request is handled by `backend/server.js`. Bangs return
a redirect response. Other queries can produce a local instant answer and
are sent to enabled providers. Provider results are collected independently,
combined with rank fusion, and returned with per-engine status and Lens data.
The optional synthesis route sends a query and selected result excerpts to
Anthropic only after the user requests a summary.

## Components

| Path | Responsibility |
| --- | --- |
| `backend/server.js` | Express routes, rate limits, static frontend, and provider wiring. |
| `backend/src/engines/` | DuckDuckGo, Wikipedia, Brave, and Google integrations. |
| `backend/src/lib/fuse.js` | Reciprocal Rank Fusion, deduplication, and per-engine Lens data. |
| `backend/src/lib/privacy.js` | Tracking-parameter stripping and advisory query scoring. |
| `backend/src/lib/instantAnswers.js` | Calculator, unit-conversion, and time answers. |
| `frontend/` | No-build UI, browser-local features, PWA shell, and canvas game. |
| `docs/media/` | Repository banner, demo video, and explanatory diagrams. |

## Rank fusion

AshKai uses Reciprocal Rank Fusion with `K = 60`. For a document returned
by multiple providers, each provider contributes `1 / (K + rank)` to the
document's score. URL host and path are used to group equivalent results.
The illustrative values and formula are shown in
[`media/rrf-illustration.svg`](media/rrf-illustration.svg); they are not
benchmarks or live search measurements.

## Data and privacy boundaries

- The server logs request method, path, response status, and timing, but
  not query strings or client IP addresses. Client connection details are
  still used in memory for rate limiting.
- Queries sent to configured providers are subject to those providers'
  policies. The exposure score is advisory and calculated after upstream
  search requests.
- Calculator, conversion, and time answers are calculated locally, but the
  current request flow still sends those queries to configured providers.
- The optional vault and pinboard are browser-local. The vault is encrypted
  with a key stored alongside its data; the pinboard is not encrypted.
- The service worker caches app-shell assets, not `/api/` responses.

See the [README](../README.md) for setup, configuration, and known
limitations.
