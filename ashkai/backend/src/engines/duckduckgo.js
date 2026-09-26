import * as cheerio from "cheerio";
import { cleanUrl } from "../lib/privacy.js";

// DuckDuckGo's key-less HTML endpoint. AshKai queries it server-side so the
// client's IP and browser fingerprint never reach DuckDuckGo directly.
// It rotates its outbound User-Agent and sends headers that make the
// request look like a normal browser hit (DuckDuckGo otherwise tends to
// serve an empty/anomaly page to obvious script traffic instead of an
// error — which shows up as "zero results, no crash").
const ENDPOINT = "https://html.duckduckgo.com/html/";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
];
const pickUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

export async function searchDuckDuckGo(query, { timeoutMs = 6000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": pickUA(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://duckduckgo.com/",
        // kl=wt-wt ("no region") is what DuckDuckGo's own homepage sets by
        // default — sending it makes the request look like a normal
        // browser session instead of a bare script hit.
        "Cookie": "kl=wt-wt",
      },
      body: new URLSearchParams({ q: query }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`DuckDuckGo returned ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);
    const results = [];

    $(".result").each((_, el) => {
      const titleEl = $(el).find(".result__title a").first();
      const title = titleEl.text().trim();
      let href = titleEl.attr("href") || "";
      const snippet = $(el).find(".result__snippet").text().trim();
      if (!title || !href) return;

      if (href.startsWith("//duckduckgo.com/l/")) {
        try {
          const wrapped = new URL("https:" + href);
          const real = wrapped.searchParams.get("uddg");
          if (real) href = decodeURIComponent(real);
        } catch {
          /* keep original href */
        }
      }

      results.push({ url: cleanUrl(href), title, snippet });
    });

    // Zero parsed results with a 200 status usually means DuckDuckGo served
    // an anomaly/CAPTCHA page instead of real results — log it distinctly
    // so it's diagnosable from server logs without ever logging the query.
    if (results.length === 0) {
      console.warn("DuckDuckGo returned 0 parseable results (likely rate-limited or challenged).");
    }

    return results.slice(0, 15);
  } finally {
    clearTimeout(timeout);
  }
}
