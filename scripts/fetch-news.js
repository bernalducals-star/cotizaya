import fetch from "node-fetch";
import RSSParser from "rss-parser";
import fs from "fs";
import path from "path";

const parser = new RSSParser();

// Solo fuentes en español — removemos CoinDesk, CoinTelegraph y Decrypt
const FEEDS = [
  { url: "https://www.ambito.com/rss/economia.xml", source: "Ámbito", category: "economia" },
  { url: "https://www.ambito.com/rss/dolar.xml", source: "Ámbito Dólar", category: "economia" },
  { url: "https://www.ambito.com/rss/finanzas.xml", source: "Ámbito Finanzas", category: "economia" },
  { url: "https://www.infobae.com/arc/outboundfeeds/rss/?outputType=xml", source: "Infobae", category: "economia" },
  { url: "https://www.cronista.com/rss/economia/", source: "El Cronista", category: "economia" },
  { url: "https://www.iprofesional.com/rss/economia", source: "iProfesional", category: "economia" },
  { url: "https://www.iprofesional.com/rss/finanzas", source: "iProfesional Finanzas", category: "economia" },
  { url: "https://criptotendencia.com/feed/", source: "CriptoTendencia", category: "cripto" },
  { url: "https://www.criptonoticias.com/feed/", source: "CriptoNoticias", category: "cripto" },
];

const MAX_ITEMS = 50;
const ITEMS_PER_FEED = 10;

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

  const keywords = ["dólar", "inflación", "bitcoin", "ethereum", "reservas", "brecha", "bonos", "riesgo país", "cepo", "tipo de cambio", "peso", "milei", "bcra", "deuda"];
  const found = keywords.filter(k =>
    title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(
      k.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    )
  );

  return [...new Set([...base, ...found])].slice(0, 4);
}

// Detectar si el texto está en inglés
function isEnglish(text) {
  if (!text) return false;
  const englishWords = ["the", "and", "for", "with", "that", "this", "from", "are", "has", "was", "will", "have", "been", "its", "not", "but", "they", "new", "says", "still", "below", "risks", "could", "would", "market", "bitcoin", "crypto"];
  const words = text.toLowerCase().split(/\s+/);
  const englishCount = words.filter(w => englishWords.includes(w)).length;
  return englishCount >= 3; // Si tiene 3+ palabras inglesas comunes, es inglés
}

function isRelevant(title, category) {
  // Filtrar noticias en inglés
  if (isEnglish(title)) return false;
  
  if (category === "cripto") return true;
  const t = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const exclude = [
    "spacex", "colombia", "venezuela", "chile", "mexico", "brasil",
    "uribe", "petro", "maduro", "trump", "biden", "eeuu", "china",
    "rusia", "ucrania", "gaza", "israel", "carrefour", "supermercado",
    "descuento", "promo", "lanzamiento", "pelicula", "serie", "deporte",
    "futbol", "basket", "tenis", "formula 1"
  ];
  if (exclude.some(k => t.includes(k))) return false;

  const keywords = [
    "dolar", "euro", "inflacion", "economia", "financiero", "financiera",
    "banco", "peso", "mercado", "bolsa", "reservas", "bcra", "deuda",
    "bonos", "acciones", "milei", "caputo", "imf", "fmi", "cepo",
    "exportacion", "importacion", "salario", "sueldo", "jubilacion",
    "impuesto", "ganancias", "iva", "tipo de cambio", "brecha",
    "plazo fijo", "inversion", "ahorro", "credito", "tasa", "argentina"
  ];
  return keywords.some(k => t.includes(k));
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

    return (parsed.items || []).slice(0, ITEMS_PER_FEED).map(item => {
      const title = item.title?.trim() || "";
      const slug = slugify(title);
      const category = feed.category;

      return {
        title,
        slug,
        category,
        date: toDate(item.pubDate || item.isoDate),
        summary: toSummary(item.contentSnippet || item.content || item.summary || ""),
        link: item.link || "",
        source: feed.source,
        tags: inferTags(title, category),
        featured: false,
        related: [],
      };
    }).filter(it => it.title && it.slug && isRelevant(it.title, it.category));

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

  const seen = new Set();
  const deduped = all.filter(it => {
    if (seen.has(it.slug)) return false;
    seen.add(it.slug);
    return true;
  });

  const final = deduped
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, MAX_ITEMS);

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
