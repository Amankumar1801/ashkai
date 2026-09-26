// Optional "Synthesize" feature. Only ever called on-demand for one specific
// query the user is already looking at — never run automatically, never
// used to pre-filter or re-rank results. If ANTHROPIC_API_KEY isn't set,
// the route that calls this simply returns 404.
const MODEL = process.env.ASHKAI_SUMMARY_MODEL || "claude-haiku-4-5-20251001";

export async function synthesize(query, topResults, apiKey) {
  const context = topResults
    .slice(0, 6)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\n${r.url}`)
    .join("\n\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system:
        "You summarize search results into one short, neutral paragraph. " +
        "Cite sources inline as [1], [2] etc. matching the numbers given. " +
        "If the results disagree, say so plainly. Never invent facts not in the snippets.",
      messages: [
        { role: "user", content: `Query: "${query}"\n\nResults:\n${context}\n\nWrite the summary paragraph now.` },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
