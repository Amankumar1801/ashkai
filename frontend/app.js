(() => {
  "use strict";

  const API_BASE = (window.ASHKAI_API_BASE || "").replace(/\/$/, "");

  const el = {
    hero: document.getElementById("hero"),
    heroForm: document.getElementById("hero-form"),
    heroInput: document.getElementById("hero-input"),
    heroWmA: document.getElementById("hero-wm-a"),
    heroWmDot: document.getElementById("hero-wm-dot"),
    heroWmB: document.getElementById("hero-wm-b"),
    heroWmCursor: document.getElementById("hero-wm-cursor"),
    heroLede: document.getElementById("hero-lede"),
    heroReveal: document.getElementById("hero-reveal"),
    app: document.getElementById("app"),
    topForm: document.getElementById("top-form"),
    topInput: document.getElementById("top-input"),
    homeLink: document.getElementById("home-link"),
    metaRow: document.getElementById("meta-row"),
    cards: document.getElementById("cards"),
    resultList: document.getElementById("result-list"),
    exposureFill: document.getElementById("exposure-fill"),
    exposureVerdict: document.getElementById("exposure-verdict"),
    exposureReasons: document.getElementById("exposure-reasons"),
    engineChips: document.getElementById("engine-chips"),
    lensBody: document.getElementById("lens-body"),
    synthSection: document.getElementById("synth-section"),
    synthBtn: document.getElementById("synth-btn"),
    synthOutput: document.getElementById("synth-output"),
    vaultSwitch: document.getElementById("vault-switch"),
    vaultList: document.getElementById("vault-list"),
  };

  function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /* ---------------- Animation helpers ---------------- */

  const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Types `text` into `target` one character at a time, resolving when
  // done. Falls back to setting the text instantly if the user has
  // reduced-motion enabled — the "opening animation" is decoration, it
  // shouldn't hold up anyone who's asked for less motion.
  function typeText(target, text, speed = 28) {
    return new Promise((resolve) => {
      if (prefersReducedMotion()) {
        target.textContent = text;
        resolve();
        return;
      }
      target.textContent = "";
      let i = 0;
      (function tick() {
        if (i >= text.length) { resolve(); return; }
        target.textContent += text.charAt(i);
        i += 1;
        setTimeout(tick, speed);
      })();
    });
  }

  // (Re)triggers the fade-up entrance on a set of elements, staggered.
  // Removing then re-adding the class forces the CSS animation to restart
  // even if it already ran on these nodes earlier.
  function replayFadeIn(nodes, stagger = 55) {
    nodes.forEach((node, i) => {
      node.classList.remove("fade-in-up");
      void node.offsetWidth; // force reflow so the animation restarts
      node.style.animationDelay = `${Math.min(i, 10) * stagger}ms`;
      node.classList.add("fade-in-up");
    });
  }

  const HERO_TAGLINE = "A search engine that blends independent results into one ranking, shows you exactly how it got there, and keeps nothing about you afterward.";
  let heroIntroPlayed = false;

  // Plays once per session: types the wordmark, then the tagline, then
  // fades in the search bar / hints / principles together. Returning to
  // the hero later (e.g. via the logo) shows everything instantly instead
  // of replaying the whole sequence — delightful once, not repetitive.
  async function playHeroIntro() {
    const showInstantly = () => {
      el.heroWmA.textContent = "Ash";
      el.heroWmDot.textContent = "_";
      el.heroWmB.textContent = "Kai";
      el.heroWmCursor.hidden = false;
      el.heroLede.textContent = HERO_TAGLINE;
      el.heroReveal.classList.add("shown");
      el.heroInput.focus();
    };

    if (heroIntroPlayed || prefersReducedMotion()) {
      heroIntroPlayed = true;
      showInstantly();
      return;
    }
    heroIntroPlayed = true;

    el.heroWmA.textContent = "";
    el.heroWmDot.textContent = "";
    el.heroWmB.textContent = "";
    el.heroWmCursor.hidden = true;
    el.heroLede.textContent = "";
    el.heroReveal.classList.remove("shown");

    await typeText(el.heroWmA, "Ash", 85);
    el.heroWmDot.textContent = "_";
    await typeText(el.heroWmB, "Kai", 85);
    el.heroWmCursor.hidden = false;
    await typeText(el.heroLede, HERO_TAGLINE, 16);
    el.heroReveal.classList.add("shown");
    el.heroInput.focus();
  }

  /* ---------------- Routing (query lives in the URL, no server state) ---------------- */

  function currentQueryFromUrl() {
    return new URLSearchParams(location.search).get("q") || "";
  }

  function goHome(e) {
    if (e) e.preventDefault();
    history.pushState({}, "", location.pathname);
    showHero();
  }
  el.homeLink.addEventListener("click", goHome);

  window.addEventListener("popstate", () => {
    const q = currentQueryFromUrl();
    if (q) runQuery(q, { pushHistory: false });
    else showHero();
  });

  /* ---------------- View toggling ---------------- */

  function showHero() {
    el.hero.hidden = false;
    el.app.hidden = true;
    el.heroInput.value = "";
    playHeroIntro();
  }

  function showApp(query) {
    el.hero.hidden = true;
    el.app.hidden = false;
    el.topInput.value = query;
  }

  /* ---------------- Search submission ---------------- */

  el.heroForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = el.heroInput.value.trim();
    if (q) runQuery(q, { pushHistory: true });
  });
  el.topForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = el.topInput.value.trim();
    if (q) runQuery(q, { pushHistory: true });
  });

  // "/" focuses the active search box, like a lot of fast reference tools —
  // handy since AshKai deliberately doesn't search-as-you-type (every
  // keystroke sent to a search box is itself a small privacy leak, so
  // AshKai only searches on submit).
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || document.activeElement.tagName === "INPUT") return;
    e.preventDefault();
    (el.app.hidden ? el.heroInput : el.topInput).focus();
  });

  async function runQuery(query, { pushHistory }) {
    showApp(query);
    if (pushHistory) {
      const url = `${location.pathname}?q=${encodeURIComponent(query)}`;
      history.pushState({ q: query }, "", url);
    }

    el.metaRow.textContent = "";
    el.cards.innerHTML = "";
    el.resultList.innerHTML = `<li class="loading-line">Querying independent engines…</li>`;
    el.synthSection.hidden = true;
    el.synthOutput.textContent = "";
    el.lensBody.innerHTML = "";
    el.engineChips.innerHTML = "";
    el.exposureFill.style.width = "0%";
    el.exposureVerdict.textContent = "";
    el.exposureReasons.innerHTML = "";

    let data;
    try {
      const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
      data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);
    } catch (err) {
      el.resultList.innerHTML = `<li class="loading-line">Couldn't reach the AshKai backend (${escapeHtml(err.message)}). Is the server running and is the frontend's API address set correctly in config.js?</li>`;
      return;
    }

    if (data.type === "bang") {
      el.resultList.innerHTML = `<li class="loading-line">Redirecting via !${escapeHtml(data.bang)}…</li>`;
      location.href = data.redirect;
      return;
    }

    renderResults(data);
    if (vaultEnabled()) addVaultEntry(query);
  }

  /* ---------------- Rendering ---------------- */

  function renderResults(data) {
    typeText(el.metaRow, `Blended results for "${data.query}"`, 9);

    // Cards: instant answer + Wikipedia summary, in that order.
    let cardsHtml = "";
    if (data.instant) {
      cardsHtml += `
        <div class="card">
          <div class="card-label">${labelForInstant(data.instant.type)}</div>
          <div class="instant-text">${escapeHtml(data.instant.text)}</div>
        </div>`;
    }
    if (data.wikiSummary) {
      const w = data.wikiSummary;
      cardsHtml += `
        <div class="card wiki-card">
          ${w.thumbnail ? `<img src="${escapeHtml(w.thumbnail)}" alt="" />` : ""}
          <div>
            <h3><a href="${escapeHtml(w.url)}" target="_blank" rel="noopener">${escapeHtml(w.title)}</a></h3>
            <p>${escapeHtml(w.extract)}</p>
          </div>
        </div>`;
    }
    el.cards.innerHTML = cardsHtml;
    replayFadeIn(Array.from(el.cards.children), 100);

    // Result list
    if (!data.results.length) {
      el.resultList.innerHTML = `<li class="empty-note">No results came back from any engine for this query. Upstream engines may be unreachable from this server, or the query returned nothing.</li>`;
    } else {
      el.resultList.innerHTML = data.results.map((r) => `
        <li class="result-item">
          <div class="result-url">${escapeHtml(displayUrl(r.url))}</div>
          <a class="result-title" href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.title)}</a>
          <p class="result-snippet">${escapeHtml(r.snippet)}</p>
          <div class="result-sources" title="${escapeHtml(r.sources.join(", "))}">${r.sources.length} SRC${r.sources.length === 1 ? "" : "S"}</div>
        </li>
      `).join("");
      replayFadeIn(Array.from(el.resultList.children), 45);
    }

    // Ledger: exposure meter
    const p = data.privacy;
    el.exposureFill.style.width = `${p.score}%`;
    el.exposureFill.style.background = p.score >= 70 ? "var(--danger)" : p.score >= 35 ? "var(--warn)" : "var(--good)";
    el.exposureVerdict.textContent = p.verdict;
    el.exposureVerdict.style.color = p.score >= 70 ? "var(--danger)" : p.score >= 35 ? "var(--warn)" : "var(--good)";
    el.exposureReasons.innerHTML = p.reasons.length
      ? p.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")
      : `<li>Nothing identifying detected in this query.</li>`;

    // Ledger: engine chips
    el.engineChips.innerHTML = data.engines.queried.map((eng) => {
      const failed = data.engines.failed.includes(eng);
      const empty = !failed && (data.engines.empty || []).includes(eng);
      const cls = failed ? "failed" : empty ? "empty" : "ok";
      const label = failed ? " · unreachable" : empty ? " · no results" : "";
      return `<span class="engine-chip ${cls}">${escapeHtml(eng)}${label}</span>`;
    }).join("");

    // Ledger: lens
    el.lensBody.innerHTML = data.lens.map((l) => `
      <div class="lens-engine">
        <div class="lens-engine-name">${escapeHtml(l.engine)}</div>
        ${l.top.length
          ? `<ol>${l.top.map((t) => `<li><a href="${escapeHtml(t.url)}" target="_blank" rel="noopener">${escapeHtml(t.title)}</a></li>`).join("")}</ol>`
          : `<div class="vault-empty">no results</div>`}
      </div>
    `).join("");

    // Synthesize
    if (data.canSynthesize) {
      el.synthSection.hidden = false;
      el.synthBtn.disabled = false;
      el.synthBtn.textContent = "Summarize top results";
      el.synthBtn.onclick = () => runSynthesis(data.query, data.results);
    }

    replayFadeIn(Array.from(document.querySelectorAll(".ledger-section:not([hidden])")), 70);
  }

  function labelForInstant(type) {
    return { calculator: "Calculator", "unit-conversion": "Unit conversion", time: "Time" }[type] || "Instant answer";
  }

  function displayUrl(u) {
    try {
      const url = new URL(u);
      return url.hostname.replace(/^www\./, "") + url.pathname.replace(/\/$/, "");
    } catch {
      return u;
    }
  }

  async function runSynthesis(query, results) {
    el.synthBtn.disabled = true;
    el.synthBtn.textContent = "Summarizing…";
    try {
      const res = await fetch(`${API_BASE}/api/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, results }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Synthesis failed");
      el.synthOutput.textContent = data.summary;
      el.synthBtn.textContent = "Summarize top results";
    } catch (err) {
      el.synthOutput.textContent = `Couldn't synthesize: ${err.message}`;
      el.synthBtn.textContent = "Try again";
    } finally {
      el.synthBtn.disabled = false;
    }
  }

  /* ================================================================
     Local search vault — an entirely client-side, opt-in, encrypted,
     self-expiring recent-search list. AshKai's server never sees this;
     it lives only in this browser's localStorage.

     Honesty about what this does and doesn't protect against: the
     encryption key is generated per-browser-profile and stored in this
     same localStorage, so this does not protect your history from
     someone with access to this device and browser profile. What it
     does do: entries aren't sitting around as plain readable text if
     something merely dumps localStorage contents (extensions, casual
     inspection), and every entry self-destructs after 24 hours whether
     you come back or not.
     ================================================================ */

  const VAULT_ENABLED_KEY = "ashkai_vault_enabled";
  const VAULT_KEY_KEY = "ashkai_vault_key";
  const VAULT_DATA_KEY = "ashkai_vault_entries";
  const VAULT_TTL_MS = 24 * 60 * 60 * 1000;

  function vaultEnabled() {
    return localStorage.getItem(VAULT_ENABLED_KEY) === "1";
  }

  async function getVaultKey() {
    const stored = localStorage.getItem(VAULT_KEY_KEY);
    if (stored) {
      const jwk = JSON.parse(stored);
      return crypto.subtle.importKey("jwk", jwk, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
    }
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const jwk = await crypto.subtle.exportKey("jwk", key);
    localStorage.setItem(VAULT_KEY_KEY, JSON.stringify(jwk));
    return key;
  }

  function bufToB64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
  function b64ToBuf(b64) {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }

  function loadVaultRaw() {
    try {
      const list = JSON.parse(localStorage.getItem(VAULT_DATA_KEY) || "[]");
      const fresh = list.filter((e) => Date.now() - e.ts < VAULT_TTL_MS);
      if (fresh.length !== list.length) localStorage.setItem(VAULT_DATA_KEY, JSON.stringify(fresh));
      return fresh;
    } catch {
      return [];
    }
  }
  function saveVaultRaw(list) {
    localStorage.setItem(VAULT_DATA_KEY, JSON.stringify(list));
  }

  async function addVaultEntry(query) {
    const key = await getVaultKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(query)
    );
    const list = loadVaultRaw();
    list.unshift({ id: crypto.randomUUID(), ts: Date.now(), iv: bufToB64(iv), ct: bufToB64(ciphertext) });
    saveVaultRaw(list.slice(0, 30));
    renderVault();
  }

  async function removeVaultEntry(id) {
    saveVaultRaw(loadVaultRaw().filter((e) => e.id !== id));
    renderVault();
  }

  function relativeTime(ts) {
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    return `${hrs}h ago`;
  }

  async function renderVault() {
    if (!vaultEnabled()) {
      el.vaultList.innerHTML = "";
      return;
    }
    const list = loadVaultRaw();
    if (!list.length) {
      el.vaultList.innerHTML = `<div class="vault-empty">No searches saved yet. Entries expire after 24h.</div>`;
      return;
    }
    const key = await getVaultKey();
    const rows = await Promise.all(list.map(async (e) => {
      try {
        const plain = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: b64ToBuf(e.iv) }, key, b64ToBuf(e.ct)
        );
        const text = new TextDecoder().decode(plain);
        return `<div class="vault-item"><span>${escapeHtml(text)} · ${relativeTime(e.ts)}</span><button data-id="${e.id}">clear</button></div>`;
      } catch {
        return "";
      }
    }));
    el.vaultList.innerHTML = rows.join("");
    el.vaultList.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => removeVaultEntry(btn.dataset.id));
    });
  }

  el.vaultSwitch.addEventListener("click", () => {
    const next = !vaultEnabled();
    localStorage.setItem(VAULT_ENABLED_KEY, next ? "1" : "0");
    el.vaultSwitch.classList.toggle("on", next);
    el.vaultSwitch.setAttribute("aria-pressed", String(next));
    if (!next) {
      localStorage.removeItem(VAULT_DATA_KEY);
      localStorage.removeItem(VAULT_KEY_KEY);
    }
    renderVault();
  });

  /* ---------------- Boot ---------------- */

  el.vaultSwitch.classList.toggle("on", vaultEnabled());
  el.vaultSwitch.setAttribute("aria-pressed", String(vaultEnabled()));
  renderVault();

  const initialQuery = currentQueryFromUrl();
  if (initialQuery) runQuery(initialQuery, { pushHistory: false });
  else showHero();
})();
