// A small, curated bang table. Unlike DuckDuckGo's thousands of bangs
// (most unused, and each one a tiny bit of attack surface / redirect risk),
// AshKai ships ~16 high-traffic ones and lets you extend the table yourself.
export const BANGS = {
  w: (q) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`,
  gh: (q) => `https://github.com/search?q=${encodeURIComponent(q)}`,
  yt: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  so: (q) => `https://stackoverflow.com/search?q=${encodeURIComponent(q)}`,
  reddit: (q) => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}`,
  r: (q) => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}`,
  npm: (q) => `https://www.npmjs.com/search?q=${encodeURIComponent(q)}`,
  pypi: (q) => `https://pypi.org/search/?q=${encodeURIComponent(q)}`,
  imdb: (q) => `https://www.imdb.com/find/?q=${encodeURIComponent(q)}`,
  maps: (q) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`,
  news: (q) => `https://news.google.com/search?q=${encodeURIComponent(q)}`,
  scholar: (q) => `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`,
  arxiv: (q) => `https://arxiv.org/abs/${encodeURIComponent(q)}`,
  wa: (q) => `https://www.wolframalpha.com/input?i=${encodeURIComponent(q)}`,
  archive: (q) => `https://web.archive.org/web/*/${encodeURIComponent(q)}`,
  tr: (q) => `https://translate.google.com/?text=${encodeURIComponent(q)}`,
};

/** If the query starts with "!bang", return { bang, url }; else null. */
export function resolveBang(query) {
  const m = query.trim().match(/^!(\w+)\s+(.+)$/);
  if (!m) return null;
  const [, bang, rest] = m;
  const builder = BANGS[bang.toLowerCase()];
  if (!builder) return null;
  return { bang: bang.toLowerCase(), url: builder(rest.trim()) };
}
