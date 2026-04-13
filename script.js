(() => {
  "use strict";

  // Config
  const TIMEOUT_MS = 6500;

  const $ = (sel, root = document) => root.querySelector(sel);

  function setText(selOrEl, text) {
    const el = typeof selOrEl === "string" ? $(selOrEl) : selOrEl;
    if (el) el.textContent = String(text);
  }

  function renderNoData(container, msg = "Sin datos") {
    if (!container) return;
    container.innerHTML = `<div class="muted">${msg}</div>`;
  }

  function withTimeout(ms) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(new Error("timeout")), ms);
    return { signal: controller.signal, clear: () => clearTimeout(t) };
  }

  async function fetchText(url, timeoutMs = TIMEOUT_MS) {
    const { signal, clear } = withTimeout(timeoutMs);
    try {
      const res = await fetch(url, { signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } finally {
      clear();
    }
  }

  // ===== Noticias (RSS) =====
  async function loadNews() {
    const statusEl = $("#news-status");
    const listEl = $("#news-list");
    if (!listEl) return;

    setText(statusEl, "Cargando…");

    try {
      // IMPORTANTE: en front puro, muchos RSS dan CORS.
      // Si ya tenías un proxy/endpoint, ponelo acá:
      const RSS_PROXY_URL = window.COTIZAYA_NEWS_URL; // setear en HTML si querés

      if (!RSS_PROXY_URL) {
        renderNoData(listEl, "Sin datos (RSS no configurado)");
        setText(statusEl, "Sin datos");
        return;
      }

      // Si tu proxy devuelve JSON:
      const { signal, clear } = withTimeout(TIMEOUT_MS);
      try {
        const res = await fetch(RSS_PROXY_URL, {
          signal,
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const items = Array.isArray(data?.items) ? data.items : [];
        if (!items.length) {
          renderNoData(listEl, "Sin datos");
          setText(statusEl, "Sin datos");
          return;
        }

        listEl.innerHTML = items.slice(0, 8).map((it) => {
          const title = String(it.title || "Sin título");
          const link = String(it.link || "#");
          const date = String(it.pubDate || "");
          return `
            <a class="news-item" href="${link}" target="_blank" rel="noopener noreferrer">
              <div class="news-title">${escapeHtml(title)}</div>
              <div class="news-meta">${escapeHtml(date)}</div>
            </a>
          `;
        }).join("");

        setText(statusEl, "OK");
      } finally {
        clear();
      }
    } catch (e) {
      console.error("Noticias error:", e);
      renderNoData($("#news-list"), "Sin datos");
      setText($("#news-status"), "Sin datos");
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ===== Cotizaciones / Saldos (placeholder) =====
  async function loadQuotes() {
    // Acá va tu lógica real de cotizaciones/saldos.
    // Ahora lo dejamos sin romper nada.
    try {
      // Si tenías endpoints, los conectamos cuando me pegues esa sección del HTML.
      // const QUOTES_URL = window.COTIZAYA_QUOTES_URL;
      // ...
    } catch (e) {
      console.error("Cotizaciones error:", e);
    }
  }

  function bootOnce() {
    if (window.__COTIZAYA_BOOTED__) return;
    window.__COTIZAYA_BOOTED__ = true;

    loadNews();
    loadQuotes();
  }

  document.addEventListener("DOMContentLoaded", bootOnce);
})();
