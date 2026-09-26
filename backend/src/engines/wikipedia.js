const SEARCH_ENDPOINT = "https://en.wikipedia.org/w/api.php";
const SUMMARY_ENDPOINT = "https://en.wikipedia.org/api/rest_v1/page/summary/";

export async function searchWikipedia(query, { timeoutMs = 5000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(SEARCH_ENDPOINT);
    url.search = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query,
      format: "json",
      srlimit: "8",
      origin: "*",
    }).toString();

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Wikipedia returned ${res.status}`);
    const data = await res.json();

    return (data?.query?.search || []).map((item) => ({
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
      title: item.title,
      snippet: item.snippet.replace(/<[^>]+>/g, ""),
    }));
  } finally {
    clearTimeout(timeout);
  }
}

/** Best-effort "instant answer" card: if the query closely matches a
 *  Wikipedia page title, return its lead summary + thumbnail. */
export async function getWikipediaSummary(query, { timeoutMs = 4000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(SUMMARY_ENDPOINT + encodeURIComponent(query), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === "disambiguation" || !data.extract) return null;
    return {
      title: data.title,
      extract: data.extract,
      url: data.content_urls?.desktop?.page,
      thumbnail: data.thumbnail?.source || null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
