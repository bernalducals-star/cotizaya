// /js/article.js
(async function () {
  const $ = (id) => document.getElementById(id);

  // Normaliza: siempre con "/" al final
  const normalizePath = (p) => (p.endsWith("/") ? p : p + "/");
  const currentPath = normalizePath(window.location.pathname);

  // Intenta cargar el HTML real del artículo desde "./contenido.html"
  async function loadLocalContent() {
    const bodyEl = $("article-content"); // ✅ ID real en tu HTML
    if (!bodyEl) return;

    try {
      const res = await fetch("./contenido.html", { cache: "no-store" });
      if (!res.ok) return; // si no existe, dejamos placeholder
      const html = await res.text();
      bodyEl.innerHTML = html;
    } catch (_) {
      // silencio
    }
  }

  // Carga el índice de noticias (título, fecha, fuente, link)
  async function loadNewsIndex() {
    try {
      const res = await fetch("/noticias/noticias.json", { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data) ? data : null;
    } catch (_) {
      return null;
    }
  }

  function formatDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  }

  function setText(id, value) {
    const el = $(id);
    if (!el) return;
    el.textContent = value || "";
  }

  function setMetaDescription(text) {
    if (!text) return;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = text;
  }

  // 1) Primero intentamos contenido local del artículo
  await loadLocalContent();

  // 2) Después metadatos desde noticias.json
  const index = await loadNewsIndex();
  if (!index) return;

  const item = index.find((n) => normalizePath(n.link || "") === currentPath);
  if (!item) return;

  // ✅ IDs reales en tu HTML
  setText("article-title", item.title);
  if (item.title) document.title = `${item.title} | CotizaYa`;

  const dateTxt = formatDate(item.date);
  const sourceTxt = item.source ? String(item.source) : "";
  const metaLine = [sourceTxt, dateTxt].filter(Boolean).join(" · ");
  setText("article-meta", metaLine);

  const fallbackDesc = item.title
    ? `${item.title}. Análisis y contexto económico en CotizaYa.`
    : "";
  setMetaDescription(fallbackDesc);
})();
