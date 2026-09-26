// AshKai privacy core.
//
// Two jobs:
//   1. Clean outgoing result URLs (strip tracking parameters that engines
//      and ad networks attach — utm_*, fbclid, gclid, etc.) before they
//      ever reach the user.
//   2. Give the user a plain-English "privacy score" for their own query,
//      flagging patterns that would identify them if sent to a logging
//      search engine directly (emails, phone numbers, full names + city,
//      etc.) — purely local, advisory, never stored.

const TRACKING_PARAM_PATTERNS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^gclsrc$/i,
  /^dclid$/i,
  /^msclkid$/i,
  /^mc_(eid|cid)$/i,
  /^igshid$/i,
  /^ref_?src$/i,
  /^ref$/i,
  /^spm$/i,
  /^_hs(enc|mi)$/i,
  /^vero_(id|conv)$/i,
  /^yclid$/i,
  /^wickedid$/i,
  /^oly_(enc|anon)_id$/i,
  /^si$/i, // YouTube share id
];

/** Strip tracking query params from a URL string. Returns the cleaned URL,
 *  or the original string if it isn't a parseable absolute URL. */
export function cleanUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const toDelete = [];
    for (const key of u.searchParams.keys()) {
      if (TRACKING_PARAM_PATTERNS.some((re) => re.test(key))) toDelete.push(key);
    }
    toDelete.forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return rawUrl;
  }
}

const PII_CHECKS = [
  { id: "email", re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, label: "looks like it contains an email address" },
  { id: "phone", re: /(\+?\d[\d\s().-]{7,}\d)/, label: "looks like it contains a phone number" },
  { id: "id-number", re: /\b\d{3}-\d{2}-\d{4}\b/, label: "looks like it contains a government ID number pattern" },
  { id: "address", re: /\b\d{1,5}\s+\w+(\s\w+){0,3}\s(street|st|avenue|ave|road|rd|lane|ln|drive|dr)\b/i, label: "looks like it contains a street address" },
  { id: "first-person-medical", re: /\b(i have|i was diagnosed with|my symptoms|i think i have)\b/i, label: "reads like a personal health question" },
  { id: "first-person-legal", re: /\b(can i be sued|am i going to jail|is it illegal for me)\b/i, label: "reads like a personal legal question" },
];

/** Score a query 0 (nothing identifying) to 100 (very identifying) with
 *  human-readable reasons. Purely a client-facing nudge — never logged,
 *  never used to alter results, computed fresh on every request. */
export function scoreQueryPrivacy(query) {
  const hits = PII_CHECKS.filter((c) => c.re.test(query));
  const wordCount = query.trim().split(/\s+/).length;
  let score = hits.length * 25;
  if (wordCount >= 12) score += 15; // long, specific queries are more identifying
  score = Math.min(100, score);

  let verdict = "Low exposure";
  if (score >= 70) verdict = "High exposure";
  else if (score >= 35) verdict = "Moderate exposure";

  return { score, verdict, reasons: hits.map((h) => h.label) };
}

/** Express middleware: strip anything that could identify the client
 *  before it's available to route handlers, and disable response caching
 *  of anything containing a query. AshKai keeps no request logs, no query
 *  logs, and no cookies. */
export function noTrackMiddleware(req, res, next) {
  req.headers["x-forwarded-for"] = undefined;
  req.headers["x-real-ip"] = undefined;
  res.setHeader("Cache-Control", "no-store");
  res.removeHeader("X-Powered-By");
  next();
}
