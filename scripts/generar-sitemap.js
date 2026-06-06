import fs from "fs";
import path from "path";

const BASE_URL = "https://cotizaya.ar";

const staticUrls = [
  { loc: "/", changefreq: "hourly", priority: "1.0" },
  { loc: "/noticia.html", changefreq: "daily", priority: "0.8" },
  { loc: "/contact.html", changefreq: "monthly", priority: "0.5" },
  { loc: "/privacy.html", changefreq: "monthly", priority: "0.3" },
];

// Leer fechas del historial
const historial = JSON.parse(fs.readFileSync("datos/historial.json", "utf-8"));
const fechas = [...new Set(historial.map(i => i.date))];

let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

for (const u of staticUrls) {
  xml += `  <url>\n    <loc>${BASE_URL}${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>\n`;
}

for (const fecha of fechas) {
  xml += `  <url>\n    <loc>${BASE_URL}/historico/${fecha}/</loc>\n    <changefreq>never</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
}

xml += `</urlset>`;

fs.writeFileSync("sitemap.xml", xml, "utf-8");
console.log(`✅ Sitemap generado con ${fechas.length + staticUrls.length} URLs`);