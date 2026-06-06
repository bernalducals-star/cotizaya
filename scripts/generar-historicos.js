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
    <p><a href="/historico/">Ver todos los históricos</a></p>
  </main>
</body>
</html>`;

  const dir = path.join(outDir, fecha);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf-8");
  count++;
}

console.log(`✅ ${count} páginas generadas en /historico/`);