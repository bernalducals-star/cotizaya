import fetch from "node-fetch";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Descargando históricos de Bluelytics...");

  const res = await fetch("https://api.bluelytics.com.ar/v2/evolution.json");
  const data = await res.json();

  const outDir = path.resolve("datos");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    path.join(outDir, "historial.json"),
    JSON.stringify(data, null, 2),
    "utf-8"
  );

  console.log(`✅ ${data.length} registros guardados en datos/historial.json`);
}

main().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});