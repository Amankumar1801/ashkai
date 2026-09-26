// Optional. Google's Programmable Search Engine (the "Custom Search JSON
// API") is an official, ToS-compliant API with its own free tier (100
// queries/day as of writing) — unlike the DuckDuckGo adapter, this one
// never gets rate-limited or CAPTCHA-challenged, because it's a real API
// call, not a scrape. Skipped entirely if no key/engine ID is configured.
import { cleanUrl } from "../lib/privacy.js";

const ENDPOINT = "https://www.googleapis.com/customsearch/v1";

export async function searchGoogle(query, apiKey, cx, { timeoutMs = 5000 } = {}) {
  if (!apiKey || !cx) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(ENDPOINT);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", cx);
    url.searchParams.set("q", query);
    url.searchParams.set("num", "10");

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Google CSE returned ${res.status}`);
    const data = await res.json();

    return (data.items || []).map((item) => ({
      url: cleanUrl(item.link),
      title: item.title,
      snippet: item.snippet || "",
    }));
  } catch {
    return []; // fail open — never let one engine's outage break the blend
  } finally {
    clearTimeout(timeout);
  }
}
