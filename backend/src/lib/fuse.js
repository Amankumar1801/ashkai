// Merge result lists from N independent engines into one ranked list using
// Reciprocal Rank Fusion (RRF) — the same family of technique SearXNG and
// academic meta-search systems use. No single engine's raw ranking is
// trusted on its own; a page that multiple independent engines agree on
// outranks a page only one engine surfaced — a better relevance signal,
// and a mild defense against any one engine's SEO manipulation.
//
//   score(doc) = sum over engines e that returned doc of  1 / (k + rank_e(doc))
//
// k=60 is the standard RRF constant (keeps the top of each list from
// dominating too hard).

const K = 60;

function normalizeForDedup(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/$/, "");
    return `${host}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * @param {Array<{engine: string, results: Array<{url: string, title: string, snippet: string}>}>} engineResults
 * @returns {Array<{url: string, title: string, snippet: string, sources: string[], score: number}>}
 */
export function fuseResults(engineResults) {
  const byKey = new Map();

  for (const { engine, results } of engineResults) {
    results.forEach((r, idx) => {
      if (!r.url || !r.title) return;
      const key = normalizeForDedup(r.url);
      const rank = idx + 1;
      const contribution = 1 / (K + rank);

      if (!byKey.has(key)) {
        byKey.set(key, { url: r.url, title: r.title, snippet: r.snippet || "", sources: [], score: 0 });
      }
      const entry = byKey.get(key);
      entry.score += contribution;
      entry.sources.push(engine);
      if ((r.snippet || "").length > entry.snippet.length) entry.snippet = r.snippet || entry.snippet;
    });
  }

  return [...byKey.values()].sort((a, b) => b.score - a.score);
}

/** Per-engine top-N view for the "Lens" feature — lets the user see what
 *  each individual engine would have shown them on its own, un-blended,
 *  so filter-bubble / SEO differences between engines are visible instead
 *  of hidden inside one merged ranking. */
export function buildLens(engineResults, topN = 5) {
  return engineResults.map(({ engine, results }) => ({
    engine,
    top: results.slice(0, topN).map((r) => ({ url: r.url, title: r.title })),
  }));
}
