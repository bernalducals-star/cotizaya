import fs from "fs";
import path from "path";

const historial = JSON.parse(fs.readFileSync("datos/historial.json", "utf-8"));

// Agrupar por fecha
const porFecha = {};
for (const item of historial) {
  if (!porFecha[item.date]) porFecha[item.date] = {};
  porFecha[item.date][item.source] = item;
}

// Ordenar fechas cronológicamente para calcular variación vs día anterior
const fechasOrdenadas = Object.keys(porFecha).sort();

const outDir = path.resolve("historico");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let count = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcularBrecha(blueSell, oficialSell) {
  return (((blueSell - oficialSell) / oficialSell) * 100).toFixed(1);
}

function diaSemana(fecha) {
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const d = new Date(fecha + "T12:00:00");
  return dias[d.getDay()];
}

function mesNombre(mes) {
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return meses[parseInt(mes) - 1];
}

function generarParrafo(fecha, blue, oficial, blueAnterior, oficialAnterior) {
  const [anio, mes, dia] = fecha.split("-");
  const fechaLegible = `${dia}/${mes}/${anio}`;
  const diaNombre = diaSemana(fecha);
  const mesNom = mesNombre(mes);

  const blueSell = parseFloat(blue.value_sell);
  const blueCompra = parseFloat(blue.value_buy);
  const oficialSell = parseFloat(oficial.value_sell);
  const oficialCompra = parseFloat(oficial.value_buy);

  const brecha = calcularBrecha(blueSell, oficialSell);

  // Variación vs día anterior
  let varBlue = null;
  let varOficial = null;
  let textoVariacion = "";

  if (blueAnterior && oficialAnterior) {
    varBlue = (((blueSell - parseFloat(blueAnterior.value_sell)) / parseFloat(blueAnterior.value_sell)) * 100).toFixed(1);
    varOficial = (((oficialSell - parseFloat(oficialAnterior.value_sell)) / parseFloat(oficialAnterior.value_sell)) * 100).toFixed(1);

    const signBlue = varBlue > 0 ? "subió" : varBlue < 0 ? "bajó" : "se mantuvo";
    const signOficial = varOficial > 0 ? "subió" : varOficial < 0 ? "bajó" : "se mantuvo";
    const absBlue = Math.abs(varBlue);
    const absOficial = Math.abs(varOficial);

    if (varBlue == 0 && varOficial == 0) {
      textoVariacion = `Respecto a la jornada anterior, ambas cotizaciones se mantuvieron sin cambios.`;
    } else {
      textoVariacion = `Respecto al día anterior, el dólar blue ${signBlue} un ${absBlue}% y el dólar oficial ${signOficial} un ${absOficial}%.`;
    }
  }

  // Descripción de la brecha
  let textoBrecha = "";
  const brechaNum = parseFloat(brecha);
  if (brechaNum < 5) {
    textoBrecha = `La brecha cambiaria fue de apenas ${brecha}%, una de las más bajas del período, reflejando una notable convergencia entre ambos mercados.`;
  } else if (brechaNum < 20) {
    textoBrecha = `La brecha cambiaria se ubicó en ${brecha}%, un nivel moderado que indicaba relativa estabilidad en el mercado de cambios.`;
  } else if (brechaNum < 50) {
    textoBrecha = `La brecha cambiaria alcanzó el ${brecha}%, evidenciando una tensión significativa entre el mercado oficial y el paralelo.`;
  } else if (brechaNum < 100) {
    textoBrecha = `La brecha cambiaria fue del ${brecha}%, un nivel elevado que reflejaba las restricciones vigentes sobre el acceso al dólar oficial.`;
  } else {
    textoBrecha = `La brecha cambiaria trepó al ${brecha}%, uno de los niveles más altos del período, en un contexto de fuerte cepo cambiario.`;
  }

  // Contexto por día de la semana
  let textoDia = "";
  const dow = new Date(fecha + "T12:00:00").getDay();
  if (dow === 0 || dow === 6) {
    textoDia = `Al tratarse de un ${diaNombre}, el mercado formal permaneció cerrado y los valores reflejan la última cotización disponible.`;
  } else {
    textoDia = `Este ${diaNombre} ${parseInt(dia)} de ${mesNom} de ${anio}, las casas de cambio y el mercado informal operaron con estos valores durante la jornada.`;
  }

  // Párrafo final ensamblado
  const partes = [textoDia, textoBrecha];
  if (textoVariacion) partes.push(textoVariacion);

  return partes.join(" ");
}

// ─── Generación de páginas ────────────────────────────────────────────────────

for (let i = 0; i < fechasOrdenadas.length; i++) {
  const fecha = fechasOrdenadas[i];
  const valores = porFecha[fecha];

  const blue = valores["Blue"];
  const oficial = valores["Oficial"];
  if (!blue || !oficial) continue;

  // Buscar día anterior con datos completos
  let blueAnterior = null;
  let oficialAnterior = null;
  for (let j = i - 1; j >= 0; j--) {
    const fechaAnt = fechasOrdenadas[j];
    const valoresAnt = porFecha[fechaAnt];
    if (valoresAnt["Blue"] && valoresAnt["Oficial"]) {
      blueAnterior = valoresAnt["Blue"];
      oficialAnterior = valoresAnt["Oficial"];
      break;
    }
  }

  const [anio, mes, dia] = fecha.split("-");
  const fechaLegible = `${dia}/${mes}/${anio}`;
  const brecha = calcularBrecha(parseFloat(blue.value_sell), parseFloat(oficial.value_sell));
  const parrafo = generarParrafo(fecha, blue, oficial, blueAnterior, oficialAnterior);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dólar blue y oficial el ${fechaLegible} | CotizaYa Argentina</title>
  <meta name="description" content="Cotización del dólar blue y oficial en Argentina el ${fechaLegible}. Blue compra $${blue.value_buy} venta $${blue.value_sell}. Oficial compra $${oficial.value_buy} venta $${oficial.value_sell}. Brecha: ${brecha}%.">
  <link rel="canonical" href="https://cotizaya.ar/historico/${fecha}/">
  <link rel="stylesheet" href="/styles.css">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Dólar blue y oficial el ${fechaLegible}",
    "description": "Cotización histórica del dólar en Argentina el ${fechaLegible}",
    "url": "https://cotizaya.ar/historico/${fecha}/",
    "datePublished": "${fecha}",
    "publisher": {
      "@type": "Organization",
      "name": "CotizaYa",
      "url": "https://cotizaya.ar"
    }
  }
  </script>
</head>
<body>
  <header class="topbar">
    <div class="container topbar-inner">
      <a href="/" class="logo">Cotiza<span>Ya</span></a>
    </div>
  </header>
  <main class="container section">
    <h1>Dólar en Argentina — ${fechaLegible}</h1>

    <p class="historico-intro">${parrafo}</p>

    <table>
      <thead><tr><th>Tipo</th><th>Compra</th><th>Venta</th></tr></thead>
      <tbody>
        <tr><td>Dólar Blue</td><td>$${blue.value_buy}</td><td>$${blue.value_sell}</td></tr>
        <tr><td>Dólar Oficial</td><td>$${oficial.value_buy}</td><td>$${oficial.value_sell}</td></tr>
      </tbody>
    </table>

    <p class="historico-brecha">Brecha cambiaria del día: <strong>${brecha}%</strong></p>

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
