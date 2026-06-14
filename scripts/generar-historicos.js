import fs from "fs";
import path from "path";

const historial = JSON.parse(fs.readFileSync("datos/historial.json", "utf-8"));

// Agrupar por fecha
const porFecha = {};
for (const item of historial) {
  if (!porFecha[item.date]) porFecha[item.date] = {};
  porFecha[item.date][item.source] = item;
}

const outDir = path.resolve("historico");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let count = 0;

for (const [fecha, valores] of Object.entries(porFecha)) {
  const blue = valores["Blue"];
  const oficial = valores["Oficial"];
  if (!blue || !oficial) continue;

  const [anio, mes, dia] = fecha.split("-");
  const fechaLegible = `${dia}/${mes}/${anio}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dólar blue y oficial el ${fechaLegible} | CotizaYa Argentina</title>
  <meta name="description" content="Cotización del dólar blue y oficial en Argentina el ${fechaLegible}. Blue compra $${blue.value_buy} venta $${blue.value_sell}. Oficial compra $${oficial.value_buy} venta $${oficial.value_sell}.">
  <link rel="canonical" href="https://cotizaya.ar/historico/${fecha}/">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="topbar">
    <div class="container topbar-inner">
      <a href="/" class="logo">Cotiza<span>Ya</span></a>
    </div>
  </header>
  <main class="container section">
    <h1>Dólar en Argentina — ${fechaLegible}</h1>
    <table>
      <thead><tr><th>Tipo</th><th>Compra</th><th>Venta</th></tr></thead>
      <tbody>
        <tr><td>Dólar Blue</td><td>$${blue.value_buy}</td><td>$${blue.value_sell}</td></tr>
        <tr><td>Dólar Oficial</td><td>$${oficial.value_buy}</td><td>$${oficial.value_sell}</td></tr>
      </tbody>
    </table>
    <!-- CTA: precio actual -->
    <div style="margin: 2rem 0; padding: 1.25rem 1.5rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; text-align: center;">
      <p style="margin: 0 0 0.75rem; font-size: 1rem; color: #166534; font-weight: 600;">
        📈 ¿Querés saber cuánto vale el dólar <strong>hoy</strong>?
      </p>
      <a href="/" style="display: inline-block; background: #16a34a; color: #fff; padding: 0.6rem 1.4rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.95rem;">
        Ver cotización en tiempo real →
      </a>
    </div>

    <!-- Links internos SEO -->
    <div style="margin: 1.5rem 0; padding: 1rem 1.25rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
      <p style="margin: 0 0 0.5rem; font-size: 0.9rem; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">También te puede interesar</p>
      <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.95rem; line-height: 2;">
        <li><a href="/aprender/que-es-el-dolar-blue/">¿Qué es el dólar blue en Argentina?</a></li>
        <li><a href="/aprender/que-es-el-dolar-mep/">¿Qué es el dólar MEP?</a></li>
        <li><a href="/aprender/brecha-cambiaria/">¿Qué es la brecha cambiaria?</a></li>
      </ul>
    </div>

    <p><a href="/historico/">← Ver todos los históricos</a></p>
  </main>
</body>
</html>`;

  const dir = path.join(outDir, fecha);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf-8");
  count++;
}

console.log(`✅ ${count} páginas generadas en /historico/`);