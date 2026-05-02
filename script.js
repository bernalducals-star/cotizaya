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

 // ===== Noticias (Automatizadas) =====
  async function loadNews() {
  const statusEl = "news-status"; // Usamos el ID directamente para tu función setText
  const listEl = document.getElementById("news-list");
  if (!listEl) return;

  setText(statusEl, "Actualizando...");

  try {
    const res = await fetch("/noticias/noticias.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`No se encontró el archivo`);
    const items = await res.json();

    if (!Array.isArray(items) || items.length === 0) {
      listEl.innerHTML = '<div class="hint">Esperando nuevas noticias...</div>';
      setText(statusEl, "Vacío");
      return;
    }

    listEl.innerHTML = items.slice(0, 8).map((it) => {
      const title       = escapeHtml(String(it.title       || "Sin título"));
      const link        = escapeAttr(String(it.link        || "#"));
      const date        = escapeHtml(String(it.date        || ""));
      const source      = escapeHtml(String(it.source      || "CotizaYa"));
      const description = escapeHtml(String(it.description || it.summary || ""));
      const image       = it.image ? escapeAttr(String(it.image)) : "";

      const imgTag = image
        ? `<img class="news-card-img" src="${image}" alt="${title}" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="news-card-img-placeholder"></div>`;

      return `
        <a class="news-card" href="${link}" target="${link.startsWith("/") ? "_self" : "_blank"}" rel="noopener noreferrer">
          ${imgTag}
          <div class="news-card-body">
            <div class="news-card-meta">${source} • ${date}</div>
            <div class="news-card-title">${title}</div>
            ${description ? `<p class="news-card-desc">${description}</p>` : ""}
          </div>
        </a>
      `;
    }).join("");

    setText(statusEl, `Actualizado: ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`);

  } catch (e) {
    console.warn("Noticias:", e.message);
    listEl.innerHTML = '<div class="hint">No se pudieron cargar las noticias.</div>';
    setText(statusEl, "Pendiente");
  }
}

 // Definimos la función que arranca todo
async function bootOnce() {
    console.log("CotizaYa: Iniciando sistema...");
    try {
        await loadQuotes(); // Carga los precios (Dólar, Euro, etc.)
        await loadNews();   // Carga las noticias del JSON
    } catch (e) {
        console.error("Error en el arranque:", e);
    }
}

// Ahora sí la llamamos cuando la página esté lista
document.addEventListener("DOMContentLoaded", bootOnce);
