import fetch from "node-fetch";
import RSSParser from "rss-parser";
import fs from "fs";
import path from "path";

const parser = new RSSParser();

const FEEDS = [
  { url: "https://www.ambito.com/rss/economia.xml", source: "Ámbito", category: "economia" },
  { url: "https://www.infobae.com/arc/outboundfeeds/rss/?outputType=xml", source: "Infobae", category: "economia" },
  { url: "https://feeds.coindesk.com/coindesk/rss", source: "CoinDesk", category: "cripto" },
];

const MAX_ITEMS = 10;

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function toDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function toSummary(text) {
  if (!text) return "";
  const clean = text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length >= 2) return (sentences[0] + " " + sentences[1]).trim();
  return clean.slice(0, 180).trim();
}

function inferTags(title, category) {
  const base = category === "cripto"
    ? ["cripto", "bitcoin"]
    : ["economía", "argentina"];

  const keywords = ["dólar", "inflación", "bitcoin", "ethereum", "reservas", "brecha", "bonos", "riesgo país", "cepo", "tipo de cambio"];
  const found = keywords.filter(k =>
    title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(
      k.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    )
  );

  return [...new Set([...base, ...found])].slice(0, 4);
}

async function fetchFeed(feed) {
  try {
    const response = await fetch(feed.url, {
      headers: { "User-Agent": "CotizaYa-Bot/1.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    const parsed = await parser.parseString(xml);

    return (parsed.items || []).slice(0, 5).map(item => {
      const title = item.title?.trim() || "";
      const slug = slugify(title);
      const category = feed.category;

      return {
        title,
        slug,
        category,
        date: toDate(item.pubDate || item.isoDate),
        summary: toSummary(item.contentSnippet || item.content || item.summary || ""),
        link: `/noticias/${category}/${slug}`,
        source: feed.source,
        tags: inferTags(title, category),
        featured: false,
        related: [],
      };
    }).filter(it => it.title && it.slug);

  } catch (e) {
    console.warn(`⚠️  Feed falló: ${feed.source} — ${e.message}`);
    return [];
  }
}

async function main() {
  console.log("CotizaYa: generando noticias.json…");

  const results = await Promise.allSettled(FEEDS.map(fetchFeed));

  const all = results
    .filter(r => r.status === "fulfilled")
    .flatMap(r => r.value);

  // Dedup por slug
  const seen = new Set();
  const deduped = all.filter(it => {
    if (seen.has(it.slug)) return false;
    seen.add(it.slug);
    return true;
  });

  // Ordenar por fecha desc y limitar
  const final = deduped
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, MAX_ITEMS);

  // Guardar
  const outDir = path.resolve("noticias");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "noticias.json");
  fs.writeFileSync(outPath, JSON.stringify(final, null, 2), "utf-8");

  console.log(`✅ ${final.length} noticias guardadas en ${outPath}`);
  final.forEach(n => console.log(`   • [${n.category}] ${n.title}`));
}

main().catch(e => {
  console.error("Error fatal:", e);
  process.exit(1);
});