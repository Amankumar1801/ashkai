// Optional. Brave Search runs its own independent index (not a Google/Bing
// resell), which makes it genuinely useful in the fusion blend — it turns
// up pages DuckDuckGo's Bing-backed results miss. Skipped entirely if no
// key is configured; AshKai works fine without it.
const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

export async function searchBrave(query, apiKey, { timeoutMs = 5000 } = {}) {
  if (!apiKey) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("count", "10");

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
    });
    if (!res.ok) throw new Error(`Brave returned ${res.status}`);
    const data = await res.json();

    return (data?.web?.results || []).map((r) => ({
      url: r.url,
      title: r.title,
      snippet: (r.description || "").replace(/<[^>]+>/g, ""),
    }));
  } catch {
    return []; // fail open — never let one engine's outage break the blend
  } finally {
    clearTimeout(timeout);
  }
}
