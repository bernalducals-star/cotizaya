// Estado simple para reutilizar cotizaciones en el conversor
const state = {
  fiat: {},
  crypto: {}
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();
  loadAllData();
  setupConverter();
});

/**
 * Carga cotizaciones fiat (mock por ahora) y cripto (CoinGecko)
 */
async function loadAllData() {
  // Fiat (por ahora datos de ejemplo, después se puede conectar API)
  const fiatData = getFiatRatesMock();
  state.fiat = fiatData;
  updateFiatUI(fiatData);

  // Cripto (vía CoinGecko)
  try {
    const cryptoData = await fetchCryptoPrices();
    state.crypto = cryptoData;
    updateCryptoUI(cryptoData);
  } catch (err) {
    console.error("Error cargando datos de cripto:", err);
    const tbody = document.getElementById("crypto-table-body");
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="4">No se pudieron cargar las cotizaciones cripto. Probá recargar la página.</td></tr>';
    }
  }

  const lastUpdateEl = document.getElementById("last-update");
  if (lastUpdateEl) {
    lastUpdateEl.textContent = new Date().toLocaleString("es-AR");
  }
}

/**
 * Datos de ejemplo para dólar/euro.
 * CAMBIÁ ESTOS VALORES MANUALMENTE HASTA QUE CONECTEMOS UNA API.
 */
function getFiatRatesMock() {
  return {
    usd_oficial: { compra: 900, venta: 940 },
    usd_blue: { compra: 1200, venta: 1250 },
    usd_mep: { compra: 1100, venta: 1120 },
    eur_oficial: { compra: 950, venta: 1000 }
  };
}

function updateFiatUI(fiat) {
  const map = [
    ["usd_oficial_compra", fiat.usd_oficial.compra],
    ["usd_oficial_venta", fiat.usd_oficial.venta],
    ["usd_blue_compra", fiat.usd_blue.compra],
    ["usd_blue_venta", fiat.usd_blue.venta],
    ["usd_blue_compra_card", fiat.usd_blue.compra],
    ["usd_blue_venta_card", fiat.usd_blue.venta],
    ["usd_mep_compra", fiat.usd_mep.compra],
    ["usd_mep_venta", fiat.usd_mep.venta],
    ["eur_oficial_compra", fiat.eur_oficial.compra],
    ["eur_oficial_venta", fiat.eur_oficial.venta]
  ];

  map.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatNumber(value);
  });
}

/**
 * Llama a CoinGecko para obtener precios de BTC, ETH y USDT
 */
async function fetchCryptoPrices() {
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=ars,usd";

  const res = await fetch(url);
  if (!res.ok) throw new Error("Respuesta no OK de CoinGecko");
  const data = await res.json();
  return data;
}

function updateCryptoUI(data) {
  const tbody = document.getElementById("crypto-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  const rows = [
    { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
    { id: "ethereum", name: "Ethereum", symbol: "ETH" },
    { id: "tether", name: "Tether", symbol: "USDT" }
  ];

  rows.forEach((c) => {
    const info = data[c.id];
    if (!info) return;

    const priceArs = info.ars;
    const priceUsd = info.usd;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.symbol}</td>
      <td>$ ${formatNumber(priceArs)}</td>
      <td>US$ ${formatNumber(priceUsd)}</td>
    `;
    tbody.appendChild(tr);

    // Datos extra para el hero y el conversor
    if (c.id === "bitcoin") {
      const btcArsEl = document.getElementById("btc_ars");
      const btcUsdEl = document.getElementById("btc_usd");
      if (btcArsEl) btcArsEl.textContent = "$ " + formatNumber(priceArs);
      if (btcUsdEl) btcUsdEl.textContent = "US$ " + formatNumber(priceUsd);
    }
  });
}

/**
 * Formateador simple de números
 */
function formatNumber(value) {
  if (typeof value !== "number") return value;
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

/**
 * Lógica del conversor
 */
function setupConverter() {
  const form = document.getElementById("converter-form");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const amountInput = document.getElementById("converter-amount");
    const currencySelect = document.getElementById("converter-currency");
    const resultEl = document.getElementById("converter-result");
    const direction = form.querySelector('input[name="direction"]:checked')?.value;

    const rawAmount = parseFloat(amountInput.value.replace(",", "."));
    if (isNaN(rawAmount) || rawAmount <= 0) {
      resultEl.textContent = "Resultado: ingresá un monto válido.";
      return;
    }

       const isArsTo = direction === "ars-to";

    // helper para elegir compra/venta según dirección
    // ars-to (ARS -> moneda): usa VENTA (te venden la moneda)
    // to-ars (moneda -> ARS): usa COMPRA (te compran la moneda)
    const pickFiatRate = (pair) => (isArsTo ? pair?.venta : pair?.compra);

    let rate = null;
    let label = "";
    let unit = ""; // unidad real

    if (currency === "usd_oficial") {
      rate = pickFiatRate(state.fiat.usd_oficial);
      label = "dólar oficial";
      unit = "USD";
    } else if (currency === "usd_blue") {
      rate = pickFiatRate(state.fiat.usd_blue);
      label = "dólar blue";
      unit = "USD";
    } else if (currency === "usd_mep") {
      rate = pickFiatRate(state.fiat.usd_mep);
      label = "dólar MEP";
      unit = "USD";
    } else if (currency === "eur_oficial") {
      rate = pickFiatRate(state.fiat.eur_oficial);
      label = "euro oficial";
      unit = "EUR";
    } else if (currency === "btc") {
      // cripto: ARS por 1 BTC. Misma tasa sirve para ambas direcciones.
      rate = state.crypto.bitcoin?.ars;
      label = "Bitcoin";
      unit = "BTC";
    }
let result;
if (isArsTo) {
  result = rawAmount / rate;
  resultEl.textContent = `Resultado: ${formatNumber(rawAmount)} ARS ≈ ${formatNumber(result)} ${unit} (${label})`;
} else {
  result = rawAmount * rate;
  resultEl.textContent = `Resultado: ${formatNumber(rawAmount)} ${unit} (${label}) ≈ ${formatNumber(result)} ARS`;
}
    