/* =========================
   CotizaYa - script.js (estable + sin romper UI)
   - Noticias local + RSS fallback (no rompe si RSS falla)
   - Conversor con miles bien (input tipo text recomendado)
   - Auto refresh + flechitas + %
   - Tema dark estable (body.dark)
   ========================= */

// Estado simple para reutilizar cotizaciones en el conversor y balances
const state = {
  fiat: {
    usd_oficial: null,
    usd_blue: null,
    usd_mep: null,
    eur: null,
    brl: null,
    uyu: null,
    mxn_ars: null, // 1 MXN en ARS (estimado por cruce)
    pyg_ars: null  // 1 PYG en ARS (estimado por cruce, sin nueva API)
  },
  crypto: {},
  lastUpdateISO: null
};

// Cache simple en memoria (y opcional en sessionStorage)
const cache = {
  crypto: { ts: 0, data: null },
  news: { ts: 0, data: null }
};

// Para variaciones % y flechas
const prev = {
  fiat: null,
  crypto: null
};

// Config
const CONFIG = {
  CRYPTO_CACHE_MS: 60 * 1000,        // 1 min
  NEWS_CACHE_MS: 5 * 60 * 1000,      // 5 min
  DEFAULT_NEWS_LIMIT: 8,
  TIMEOUT_MS: 9000,
  AUTO_REFRESH_MS: 60 * 1000         // 1 min auto refresh
};

document.addEventListener("DOMContentLoaded", () => {
  setText("year", new Date().getFullYear());
  initTheme();
  init();
});

async function init() {
  // 🚫 Si estamos en una página de noticia, no ejecutar la home
  if (parseNewsRoute()) return;

  // 1) Balances (no depende de APIs)
  try { loadBalances(); } catch (e) { console.error("Balances: error inicializando", e); }

  // 2) Conversor
  try { setupConverter(); } catch (e) { console.error("Conversor: error inicializando", e); }

  // 3) Cotizaciones
  try { await loadQuotes({ silent: false }); } catch (e) { console.error("Cotizaciones: error general", e); }

  // 4) Noticias (listado de la home)
  try { await loadNews(); } catch (e) { console.error("Noticias: error general", e); }

  // Auto refresh (solo para home)
  setInterval(() => {
    loadQuotes({ silent: true }).catch(() => {});
    loadNews().catch(() => {});
  }, CONFIG.AUTO_REFRESH_MS);
}

/* =========================
   Helpers UI
   ========================= */

function $(id) { return document.getElementById(id); }

function setText(id, value) {
  const el = $(id);
  if (!el) return;
  el.textContent = value ?? "–";
}

function formatNumber(value, max = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) return "–";
  return value.toLocaleString("es-AR", { minimumFractionDigits: max,
 maximumFractionDigits: max });
}

function formatMoneyARS(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "–";
  return "$ " + formatNumber(value, 2);
}

function formatMoneyUSD(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "–";
  return "US$ " + formatNumber(value, 2);
}

function nowISO() { return new Date().toISOString(); }

function toNum(v) {
  if (v === null || v === undefined) return NaN;

  let s = String(v).trim();
  if (!s) return NaN;

  // sacamos espacios y símbolos comunes
  s = s.replace(/\s/g, "").replace(/\$/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  // Caso 1: estilo AR (coma decimal)
  if (hasComma) {
    // miles con puntos, decimal con coma
    s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  // Caso 2: solo puntos -> decidir si son miles o decimal
  if (hasDot) {
    const parts = s.split(".");
    const last = parts[parts.length - 1];

    // Si TODOS los grupos después del primero tienen largo 3 => miles
    const looksLikeThousands = parts.length > 1 && parts.slice(1).every(p => /^\d{3}$/.test(p));

    if (looksLikeThousands) {
      // 50.000 -> 50000
      s = s.replace(/\./g, "");
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    } else {
      // 1715.0394 (API) -> decimal
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    }
  }

  // Caso 3: solo dígitos
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function pctChange(newV, oldV) {
  if (!Number.isFinite(newV) || !Number.isFinite(oldV) || oldV === 0) return null;
  return ((newV - oldV) / oldV) * 100;
}

/**
 * Pinta valor + flecha + % con animación
 * - targetId: span donde se imprime
 * - newValue: number
 * - oldValue: number | null
 * - formatter: (n)=>string
 */
function paintValueWithDelta(targetId, newValue, oldValue, formatter) {
  const el = $(targetId);
  if (!el) return;

  // Limpia clases
  el.classList.remove("price-up", "price-down");

  if (!Number.isFinite(newValue)) {
    el.textContent = "–";
    return;
  }

  const base = formatter(newValue);

  const p = pctChange(newValue, oldValue);
  if (p === null) {
    el.textContent = base;
    return;
  }

  const arrow = p > 0 ? "▲" : p < 0 ? "▼" : "•";
  const pAbs = Math.abs(p);
  const pTxt = `${arrow} ${pAbs.toFixed(2)}%`;

  // Animación
  if (p > 0) el.classList.add("price-up");
  if (p < 0) el.classList.add("price-down");

  el.textContent = `${base} ${pTxt}`;
}

/* =========================
   Theme (luna) - body.dark
   ========================= */

const THEME_KEY = "cotizaya_theme_v1";

function initTheme() {
  const btn = $("theme-toggle");
  const icon = $("theme-icon");
  if (!btn || !icon) return;

  const saved = safeGetLocal(THEME_KEY);
  const prefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

  const initial = saved || (prefersDark ? "dark" : "light");
  applyTheme(initial);

  btn.addEventListener("click", () => {
    const next = document.body.classList.contains("dark") ? "light" : "dark";
    applyTheme(next);
    safeSetLocal(THEME_KEY, next);
  });
}

function applyTheme(mode) {
  const icon = $("theme-icon");
  const btn = $("theme-toggle");
  if (!icon) return;

  const isDark = mode === "dark";
  document.body.classList.toggle("dark", isDark);

  const color = isDark ? "#ffffff" : "#111111";
  icon.innerHTML = isDark ? sunSVG(color) : moonSVG(color);

  if (btn) {
    btn.setAttribute("aria-label", isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
    btn.setAttribute("title", isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
  }
}

function moonSVG(color = "#111111") {
  return `
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M21 13.2A7.5 7.5 0 0 1 10.8 3 8.5 8.5 0 1 0 21 13.2Z"
      stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function sunSVG(color = "#ffffff") {
  return `
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="4" stroke="${color}" stroke-width="2"/>
    <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M5 19l1.5-1.5"
      stroke="${color}" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function safeGetLocal(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function safeSetLocal(key, value) {
  try { localStorage.setItem(key, value); } catch (_) {}
}

/* =========================
   Cotizaciones (Fiat + Cripto)
   ========================= */

async function loadQuotes({ silent = false } = {}) {
  // Guardar prev para variaciones
  const prevFiat = prev.fiat ? structuredClone(prev.fiat) : null;
  const prevCrypto = prev.crypto ? structuredClone(prev.crypto) : null;

  // Fiat (API real con fallback)
  const fiatData = await fetchFiatRatesWithFallback();
  state.fiat = { ...state.fiat, ...fiatData };

  // Cripto (CoinGecko)
  try {
    const cryptoData = await fetchCryptoPricesCached();
    state.crypto = cryptoData;
  } catch (err) {
    console.error("Cripto: error cargando", err);
    // no rompe todo
  }

  // Guardar prev nuevo
  prev.fiat = structuredClone(state.fiat);
  prev.crypto = structuredClone(state.crypto);

  // UI Fiat + deltas
  updateFiatUI(state.fiat, prevFiat);

  // UI Cripto + deltas (solo BTC destacado)
  updateCryptoUI(state.crypto, prevCrypto);

  state.lastUpdateISO = nowISO();
  const lastUpdateEl = $("last-update");
  if (lastUpdateEl) lastUpdateEl.textContent = new Date().toLocaleString("es-AR");

  // Recalcular balances
  try { recalcBalancesUI(); } catch (e) { console.error("Balances: error recalculando", e); }

  // Resumen del día
  try { renderDailyBrief(); } catch (e) { console.error("Resumen del día: error", e); }

  if (!silent) console.log("CotizaYa: cotizaciones actualizadas");
}

async function fetchFiatRatesWithFallback() {
 const endpoints = {
  usd_oficial: "https://dolarapi.com/v1/dolares/oficial",
  usd_blue: "https://dolarapi.com/v1/dolares/blue",
  usd_mep: "https://dolarapi.com/v1/dolares/bolsa",
  eur: "https://dolarapi.com/v1/cotizaciones/eur",
  brl: "https://dolarapi.com/v1/cotizaciones/brl",
  uyu: "https://dolarapi.com/v1/cotizaciones/uyu",
  usd_mxn: "https://mx.dolarapi.com/v1/cotizaciones/usd",
  usd_pyg: "https://py.dolarapi.com/v1/cotizaciones/usd"
};

  const out = {
    usd_oficial: null,
    usd_blue: null,
    usd_mep: null,
    eur: null,
    brl: null,
    uyu: null,
    mxn_ars: null,
    pyg_ars: null
  };

  const results = await Promise.allSettled([
    fetchJSON(endpoints.usd_oficial),
    fetchJSON(endpoints.usd_blue),
    fetchJSON(endpoints.usd_mep),
    fetchJSON(endpoints.eur),
    fetchJSON(endpoints.brl),
    fetchJSON(endpoints.uyu),
    fetchJSON(endpoints.usd_mxn),
    fetchJSON(endpoints.usd_pyg)
  ]);

  const [rOf, rBl, rMep, rEur, rBrl, rUyu, rUsdMxn, rUsdPyg] = results;

  if (rOf.status === "fulfilled") out.usd_oficial = pickCompraVenta(rOf.value);
  if (rBl.status === "fulfilled") out.usd_blue = pickCompraVenta(rBl.value);
  if (rMep.status === "fulfilled") out.usd_mep = pickCompraVenta(rMep.value);
  if (rEur.status === "fulfilled") out.eur = pickCompraVenta(rEur.value);
  if (rBrl.status === "fulfilled") out.brl = pickCompraVenta(rBrl.value);
  if (rUyu.status === "fulfilled") out.uyu = pickCompraVenta(rUyu.value);

  // MXN: cruce USD ARS / USD MXN
  if (rUsdMxn.status === "fulfilled") {
    const mx = rUsdMxn.value || {};
    const usdInMxn = pickFixOrVenta(mx);
    const usdInArs = out.usd_oficial?.venta;
    if (Number.isFinite(usdInMxn) && usdInMxn > 0 && Number.isFinite(usdInArs) && usdInArs > 0) {
      out.mxn_ars = usdInArs / usdInMxn; // 1 MXN en ARS
    }
  }

  // PYG: cruce USD ARS / USD PYG (si existe py.dolarapi.com, si no, queda null)
  if (rUsdPyg.status === "fulfilled") {
    const py = rUsdPyg.value || {};
    const usdInPyg = pickFixOrVenta(py); // cuantos PYG por 1 USD
    const usdInArs = out.usd_oficial?.venta;
    if (Number.isFinite(usdInPyg) && usdInPyg > 0 && Number.isFinite(usdInArs) && usdInArs > 0) {
      out.pyg_ars = usdInArs / usdInPyg; // 1 PYG en ARS
    }
  }

  // Fallback mínimo si algo vino null
  const mock = getFiatRatesMock();
  out.usd_oficial = out.usd_oficial || mock.usd_oficial;
  out.usd_blue    = out.usd_blue    || mock.usd_blue;
  out.usd_mep     = out.usd_mep     || mock.usd_mep;
  out.eur         = out.eur         || mock.eur;
  out.brl         = out.brl         || mock.brl;
  out.uyu         = out.uyu         || mock.uyu;
  out.mxn_ars     = (Number.isFinite(out.mxn_ars) && out.mxn_ars > 0) ? out.mxn_ars : mock.mxn_ars;
  // pyg_ars puede quedar null si no hay fuente, no rompe nada

  return out;
}

function pickFixOrVenta(obj) {
  const fix = toNum(obj?.fix);
  if (Number.isFinite(fix) && fix > 0) return fix;
  const venta = toNum(obj?.venta);
  return Number.isFinite(venta) && venta > 0 ? venta : NaN;
}

function getFiatRatesMock() {
  return {
    usd_oficial: { compra: 900, venta: 940 },
    usd_blue: { compra: 1200, venta: 1250 },
    usd_mep: { compra: 1100, venta: 1120 },
    eur: { compra: 950, venta: 1000 },
    brl: { compra: 180, venta: 190 },
    uyu: { compra: 25, venta: 28 },
    mxn_ars: 55
  };
}

function pickCompraVenta(obj) {
  return { compra: toNum(obj?.compra), venta: toNum(obj?.venta) };
}

function updateFiatUI(fiat, prevFiat) {
  const p = prevFiat || {};

  paintValueWithDelta("usd_oficial_compra", fiat.usd_oficial?.compra, p.usd_oficial?.compra, (n)=>formatNumber(n));
  paintValueWithDelta("usd_oficial_venta",  fiat.usd_oficial?.venta,  p.usd_oficial?.venta,  (n)=>formatNumber(n));

  paintValueWithDelta("usd_blue_compra", fiat.usd_blue?.compra, p.usd_blue?.compra, (n)=>formatNumber(n));
  paintValueWithDelta("usd_blue_venta",  fiat.usd_blue?.venta,  p.usd_blue?.venta,  (n)=>formatNumber(n));

  paintValueWithDelta("usd_blue_compra_card", fiat.usd_blue?.compra, p.usd_blue?.compra, (n)=>formatNumber(n));
  paintValueWithDelta("usd_blue_venta_card",  fiat.usd_blue?.venta,  p.usd_blue?.venta,  (n)=>formatNumber(n));

  paintValueWithDelta("usd_mep_compra", fiat.usd_mep?.compra, p.usd_mep?.compra, (n)=>formatNumber(n));
  paintValueWithDelta("usd_mep_venta",  fiat.usd_mep?.venta,  p.usd_mep?.venta,  (n)=>formatNumber(n));

  paintValueWithDelta("eur_oficial_compra", fiat.eur?.compra, p.eur?.compra, (n)=>formatNumber(n));
  paintValueWithDelta("eur_oficial_venta",  fiat.eur?.venta,  p.eur?.venta,  (n)=>formatNumber(n));

  paintValueWithDelta("brl_compra", fiat.brl?.compra, p.brl?.compra, (n)=>formatMoneyARS(n));
  paintValueWithDelta("brl_venta",  fiat.brl?.venta,  p.brl?.venta,  (n)=>formatMoneyARS(n));

  paintValueWithDelta("uyu_compra", fiat.uyu?.compra, p.uyu?.compra, (n)=>formatMoneyARS(n));
  paintValueWithDelta("uyu_venta",  fiat.uyu?.venta,  p.uyu?.venta,  (n)=>formatMoneyARS(n));

  if (Number.isFinite(fiat.mxn_ars) && fiat.mxn_ars > 0) {
    setText("mxn_ref", `1 MXN ≈ ${formatMoneyARS(fiat.mxn_ars)}`);
  } else {
    setText("mxn_ref", "–");
  }

  // Si después agregás en HTML un span id="pyg_ref", esto lo mostrará
  if ($("pyg_ref")) {
    if (Number.isFinite(fiat.pyg_ars) && fiat.pyg_ars > 0) {
      setText("pyg_ref", `1 PYG ≈ ${formatMoneyARS(fiat.pyg_ars)}`);
    } else {
      setText("pyg_ref", "–");
    }
  }
}

/**
 * CoinGecko: BTC, ETH, USDT vs ARS y USD
 */
async function fetchCryptoPricesCached() {
  const now = Date.now();
  if (cache.crypto.data && now - cache.crypto.ts < CONFIG.CRYPTO_CACHE_MS) return cache.crypto.data;

  try {
    const raw = sessionStorage.getItem("cotizaya_crypto_cache");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.ts && parsed?.data && now - parsed.ts < CONFIG.CRYPTO_CACHE_MS) {
        cache.crypto = parsed;
        return parsed.data;
      }
    }
  } catch (_) {}

  const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=ars,usd";
  const res = await fetchWithTimeout(url, { cache: "no-store" });
  if (!res.ok) throw new Error("CoinGecko: respuesta no OK");
  const data = await res.json();

  cache.crypto = { ts: now, data };
  try { sessionStorage.setItem("cotizaya_crypto_cache", JSON.stringify(cache.crypto)); } catch (_) {}
  return data;
}

function updateCryptoUI(data, prevCrypto) {
  const tbody = $("crypto-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  const rows = [
    { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
    { id: "ethereum", name: "Ethereum", symbol: "ETH" },
    { id: "tether", name: "Tether", symbol: "USDT" }
  ];

  rows.forEach((c) => {
    const info = data?.[c.id];
    if (!info) return;

    const priceArs = info.ars;
    const priceUsd = info.usd;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.symbol)}</td>
      <td>${formatMoneyARS(priceArs)}</td>
      <td>${formatMoneyUSD(priceUsd)}</td>
    `;
    tbody.appendChild(tr);

    if (c.id === "bitcoin") {
      const oldBtcArs = prevCrypto?.bitcoin?.ars;
      const oldBtcUsd = prevCrypto?.bitcoin?.usd;
      paintValueWithDelta("btc_ars", priceArs, oldBtcArs, (n)=>formatMoneyARS(n));
      paintValueWithDelta("btc_usd", priceUsd, oldBtcUsd, (n)=>formatMoneyUSD(n));
    }
  });

  if (!tbody.children.length) {
    tbody.innerHTML = '<tr><td colspan="4">No se pudieron cargar las cotizaciones cripto. Probá recargar.</td></tr>';
  }
}

/* =========================
   Conversor (FIX: miles + coma/punto)
   ========================= */

function setupConverter() {
  const form = $("converter-form");
  if (!form) return;

  const amountInput = $("converter-amount");
  const currencySelect = $("converter-currency");
  const resultEl = $("converter-result");
  if (!amountInput || !currencySelect || !resultEl) return;

  // Opcional: si el input NO es number, lo dejamos "lindo" al salir del campo
  // (si es type="number", no tocamos nada para no pelear con el navegador)
  if ((amountInput.getAttribute("type") || "").toLowerCase() !== "number") {
   amountInput.addEventListener("input", () => {
  // NO formateamos mientras escribe
  // solo limpiamos caracteres inválidos
  amountInput.value = amountInput.value.replace(/[^\d.,]/g, "");
});
amountInput.addEventListener("blur", () => {
  const n = toNum(amountInput.value);
  amountInput.value = Number.isFinite(n) && n > 0
    ? n.toLocaleString("es-AR", { maximumFractionDigits: 8 })
    : "";
});
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const direction = form.querySelector('input[name="direction"]:checked')?.value || "ars-to";

    // FIX CLAVE: usamos toNum() (saca puntos de miles y acepta coma decimal)
    const rawAmount = toNum(amountInput.value);

    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      resultEl.textContent = "Resultado: ingresá un monto válido.";
      return;
    }

    const currency = currencySelect.value;
    const { rate, label } = getRateForConverter(currency);

    if (!Number.isFinite(rate) || rate <= 0) {
      resultEl.textContent = "Resultado: todavía no se cargaron cotizaciones para esa moneda.";
      return;
    }

    if (direction === "ars-to") {
      const result = rawAmount / rate;
      resultEl.textContent = `Resultado: ${formatNumber(rawAmount)} ARS ≈ ${formatNumber(result)} ${label}`;
    } else {
      const result = rawAmount * rate;
      resultEl.textContent = `Resultado: ${formatNumber(rawAmount)} ${label} ≈ ${formatNumber(result)} ARS`;
    }
  });
}

function getRateForConverter(currency) {
  // rate = ARS por 1 unidad de la moneda (venta)
  if (currency === "usd_oficial") return { rate: state.fiat.usd_oficial?.venta, label: "dólar oficial" };
  if (currency === "usd_blue")    return { rate: state.fiat.usd_blue?.venta,    label: "dólar blue" };
  if (currency === "usd_mep")     return { rate: state.fiat.usd_mep?.venta,     label: "dólar MEP" };
  if (currency === "eur_oficial") return { rate: state.fiat.eur?.venta,         label: "euro" };
  if (currency === "brl")         return { rate: state.fiat.brl?.venta,         label: "real (BRL)" };
  if (currency === "uyu")         return { rate: state.fiat.uyu?.venta,         label: "peso uruguayo (UYU)" };
  if (currency === "mxn")         return { rate: state.fiat.mxn_ars,            label: "peso mexicano (MXN)" };
  if (currency === "btc")         return { rate: state.crypto.bitcoin?.ars,     label: "Bitcoin (BTC)" };
  return { rate: null, label: "–" };
}

/* =========================
   Balances (localStorage)
   ========================= */

const BALANCES_KEY = "cotizaya_balances_v1";

function loadBalances() {
  const btnEdit = $("btn-edit-balances");
  const btnReset = $("btn-reset-balances");
  const panel = $("balances-panel");
  const form = $("balances-form");
  const btnCancel = $("btn-cancel-balances");

  if (!btnEdit || !btnReset || !panel || !form || !btnCancel) return;

  setText("balances-status", "Listo.");

  const balances = getBalances();
  fillBalancesForm(balances);
  recalcBalancesUI();

  btnEdit.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "block" : "none";
    setText("balances-status", panel.style.display === "none" ? "Listo." : "Editando…");
  });

  btnCancel.addEventListener("click", () => {
    panel.style.display = "none";
    fillBalancesForm(getBalances());
    setText("balances-status", "Cancelado.");
  });

  btnReset.addEventListener("click", () => {
    localStorage.removeItem(BALANCES_KEY);
    const fresh = getBalances();
    fillBalancesForm(fresh);
    recalcBalancesUI();
    setText("balances-status", "Reseteado.");
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const next = {
      ars: toNum($("input-balance-ars")?.value),
      usd: toNum($("input-balance-usd")?.value),
      usdt: toNum($("input-balance-usdt")?.value),
      btc: toNum($("input-balance-btc")?.value)
    };

    saveBalances({
      ars: Number.isFinite(next.ars) ? Math.max(0, next.ars) : 0,
      usd: Number.isFinite(next.usd) ? Math.max(0, next.usd) : 0,
      usdt: Number.isFinite(next.usdt) ? Math.max(0, next.usdt) : 0,
      btc: Number.isFinite(next.btc) ? Math.max(0, next.btc) : 0
    });

    recalcBalancesUI();
    panel.style.display = "none";
    setText("balances-status", "Guardado.");
  });
}

function getBalances() {
  const defaults = { ars: 0, usd: 0, usdt: 0, btc: 0 };
  try {
    const raw = localStorage.getItem(BALANCES_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ars: Number.isFinite(toNum(parsed?.ars)) ? toNum(parsed?.ars) : 0,
      usd: Number.isFinite(toNum(parsed?.usd)) ? toNum(parsed?.usd) : 0,
      usdt: Number.isFinite(toNum(parsed?.usdt)) ? toNum(parsed?.usdt) : 0,
      btc: Number.isFinite(toNum(parsed?.btc)) ? toNum(parsed?.btc) : 0
    };
  } catch {
    return defaults;
  }
}

function saveBalances(balances) {
  try { localStorage.setItem(BALANCES_KEY, JSON.stringify(balances)); }
  catch (e) { console.error("Balances: no se pudo guardar en localStorage", e); }
}

function fillBalancesForm(b) {
  if ($("input-balance-ars")) $("input-balance-ars").value = b.ars;
  if ($("input-balance-usd")) $("input-balance-usd").value = b.usd;
  if ($("input-balance-usdt")) $("input-balance-usdt").value = b.usdt;
  if ($("input-balance-btc")) $("input-balance-btc").value = b.btc;
}

function recalcBalancesUI() {
  if (!$("balance_total_ars") && !$("balance_total_usd")) return;

  const b = getBalances();

  setText("balance_ars", formatNumber(b.ars));
  setText("balance_usd", formatNumber(b.usd));
  setText("balance_usdt", formatNumber(b.usdt));
  setText("balance_btc", formatNumber(b.btc, 8));

  const usdBlueArs = state.fiat.usd_blue?.venta;
  const usdtUsd = state.crypto.tether?.usd;
  const btcArs = state.crypto.bitcoin?.ars;
  const btcUsd = state.crypto.bitcoin?.usd;

  let totalARS = b.ars;

  if (Number.isFinite(usdBlueArs) && usdBlueArs > 0) {
    totalARS += b.usd * usdBlueArs;
    totalARS += b.usdt * usdBlueArs;
  }
  if (Number.isFinite(btcArs) && btcArs > 0) totalARS += b.btc * btcArs;

  let totalUSD = 0;
  if (Number.isFinite(usdBlueArs) && usdBlueArs > 0) totalUSD += b.ars / usdBlueArs;
  totalUSD += b.usd;
  totalUSD += b.usdt * (Number.isFinite(usdtUsd) && usdtUsd > 0 ? usdtUsd : 1);
  if (Number.isFinite(btcUsd) && btcUsd > 0) totalUSD += b.btc * btcUsd;

  setText("balance_total_ars", formatMoneyARS(totalARS));
  setText("balance_total_usd", formatMoneyUSD(totalUSD));
}

/* =========================
   Noticias (local primero + RSS opcional)
   ========================= */

async function loadNews() {
  const statusEl = $("news-status");
  const listEl = $("news-list");
  if (!statusEl || !listEl) return;

  statusEl.textContent = "Cargando…";
  listEl.innerHTML = "";

  try {
    const items = await fetchNewsItemsCached(CONFIG.DEFAULT_NEWS_LIMIT);

    if (!items.length) {
      statusEl.textContent = "Sin titulares por ahora.";
      listEl.innerHTML = `<div class="hint">No hay titulares disponibles.</div>`;
      return;
    }

    statusEl.textContent = `Actualizado: ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;

    listEl.innerHTML = items
      .slice(0, CONFIG.DEFAULT_NEWS_LIMIT)
      .map((it) => `
        <a class="news-item" href="${escapeAttr(it.link)}" target="${it.link.startsWith('/') ? '_self' : '_blank'}" rel="noopener noreferrer">
          <div class="news-title">${escapeHtml(it.title)}</div>
          <div class="news-meta">${escapeHtml(it.source)} • ${escapeHtml(it.date)}</div>
        </a>
      `)
      .join("");
  } catch (e) {
    console.error("Noticias: error cargando", e);
    statusEl.textContent = "No se pudieron cargar titulares.";
    listEl.innerHTML = `<div class="hint">Probá recargar. Si sigue, cambiamos fuentes.</div>`;
  }
}

async function fetchLocalNewsIndex() {
  try {
    // IMPORTANTE: todo en minúscula
    const res = await fetch("/noticias/noticias.json", { cache: "no-store" });
    if (!res.ok) return [];

    const data = await res.json();

    return (Array.isArray(data) ? data : [])
      .map(n => {
        const link = n.link || n.url || "";
        const ts = n.date ? Date.parse(n.date) : Date.now();
        return {
          title: n.title || "",
          link,
          source: n.source || "CotizaYa",
          date: n.date ? new Date(ts).toLocaleString("es-AR") : "–",
          ts
        };
      })
      .filter(it => it.title && it.link);
  } catch (e) {
    console.warn("No se pudo cargar noticias.json", e);
    return [];
  }
}

async function fetchNewsItemsCached(limit) {
  const now = Date.now();

  // 1) Local primero SIEMPRE
  const localItems = await fetchLocalNewsIndex();

  // 2) Cache memoria
  if (cache.news.data && now - cache.news.ts < CONFIG.NEWS_CACHE_MS) {
    return dedupAndSort(localItems.concat(cache.news.data)).slice(0, limit);
  }

  // 3) Cache session
  try {
    const raw = sessionStorage.getItem("cotizaya_news_cache");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.ts && Array.isArray(parsed?.data) && now - parsed.ts < CONFIG.NEWS_CACHE_MS) {
        cache.news = parsed;
        return dedupAndSort(localItems.concat(parsed.data)).slice(0, limit);
      }
    }
  } catch (_) {}

  // 4) RSS opcional: si falla, no rompe
  const feeds = [
    { name: "iProfesional (Economía)", url: "https://www.iprofesional.com/rss/economia.xml" },
    { name: "iProfesional (Finanzas)", url: "https://www.iprofesional.com/rss/finanzas.xml" },
    { name: "iProfesional (Impuestos)", url: "https://www.iprofesional.com/rss/impuestos.xml" }
  ];

  let all = [...localItems];

  for (const feed of feeds) {
    try {
      const xmlText = await fetchRSSWithFallback(feed.url);
      const items = parseFeed(xmlText, feed.name);
      all = all.concat(items);
    } catch (e) {
      console.warn("Noticias: feed falló", feed.name, e);
    }
  }

  const final = dedupAndSort(all);

  cache.news = { ts: now, data: final };
  try { sessionStorage.setItem("cotizaya_news_cache", JSON.stringify(cache.news)); } catch (_) {}

  return final.slice(0, limit);
}

function dedupAndSort(items) {
  const dedup = new Map();
  for (const it of items) {
    if (!it?.link) continue;
    if (!dedup.has(it.link)) dedup.set(it.link, it);
  }
  return Array.from(dedup.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

async function fetchRSSWithFallback(url) {
  // 1) directo
  try {
    return await fetchText(url, 8000);
  } catch (_) {}

  // 2) AllOrigins raw
  try {
    const proxied = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
    return await fetchText(proxied, 10000);
  } catch (_) {}

  // 3) Jina raw (último recurso)
  const jina = "https://r.jina.ai/http://" + url.replace(/^https?:\/\//, "");
  return await fetchText(jina, 12000);
}

async function fetchText(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(`Fetch no OK (${res.status})`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function parseFeed(xmlText, sourceName) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");

  const rssItems = Array.from(xml.querySelectorAll("item"));
  if (rssItems.length) {
    return rssItems
      .slice(0, 20)
      .map((it) => {
        const title = it.querySelector("title")?.textContent?.trim() || "";
        const link = it.querySelector("link")?.textContent?.trim() || "";
        const pubDate = it.querySelector("pubDate")?.textContent?.trim() || "";
        const ts = pubDate ? Date.parse(pubDate) : Date.now();
        const date = pubDate ? new Date(ts).toLocaleString("es-AR") : "–";
        if (!title || !link) return null;
        return { title, link, source: sourceName, date, ts };
      })
      .filter(Boolean);
  }

  const entries = Array.from(xml.querySelectorAll("entry"));
  if (entries.length) {
    return entries
      .slice(0, 20)
      .map((en) => {
        const title = en.querySelector("title")?.textContent?.trim() || "";
        const linkEl = en.querySelector('link[rel="alternate"]') || en.querySelector("link");
        const link = linkEl?.getAttribute("href")?.trim() || "";
        const updated =
          en.querySelector("updated")?.textContent?.trim() ||
          en.querySelector("published")?.textContent?.trim() || "";
        const ts = updated ? Date.parse(updated) : Date.now();
        const date = updated ? new Date(ts).toLocaleString("es-AR") : "–";
        if (!title || !link) return null;
        return { title, link, source: sourceName, date, ts };
      })
      .filter(Boolean);
  }

  return [];
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(str) {
  return String(str).replaceAll('"', "%22");
}

/* =========================
   Fetch utils (timeout)
   ========================= */

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchJSON(url) {
  const res = await fetchWithTimeout(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch JSON no OK (${res.status})`);
  return await res.json();
}

// =========================
// Resumen del día automático
// =========================
function renderDailyBrief() {
  const textEl = $("daily-brief-text");
  const metaEl = $("daily-brief-meta");
  if (!textEl) return;

  const setMeta = (t) => { if (metaEl) metaEl.textContent = t || ""; };

  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = "cotizaya_brief_" + today;

  // Cache diario
  try {
    const cachedRaw = localStorage.getItem(cacheKey);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached?.text) {
        textEl.textContent = cached.text;
        setMeta(cached.meta || "");
        return;
      }
    }
  } catch (_) {}

  const blueV = state?.fiat?.usd_blue?.venta;
  const ofiV  = state?.fiat?.usd_oficial?.venta;
  const mepV  = state?.fiat?.usd_mep?.venta;
  const eurV  = state?.fiat?.eur?.venta;
  const btcUsd = state?.crypto?.bitcoin?.usd;

  if (!Number.isFinite(blueV) || !Number.isFinite(ofiV) || ofiV <= 0) {
    textEl.textContent = "Resumen: esperando cotizaciones para armar el informe de hoy.";
    setMeta("");
    return;
  }

  const brecha = ((blueV - ofiV) / ofiV) * 100;
  const brechaTxt =
    brecha > 60 ? "brecha alta" :
    brecha > 30 ? "brecha moderada" :
    "brecha contenida";

  const parts = [];
  parts.push(`Blue: $${formatNumber(blueV)} | Oficial: $${formatNumber(ofiV)} → ${brechaTxt} (${brecha.toFixed(1)}%).`);
  if (Number.isFinite(mepV) && mepV > 0) parts.push(`MEP: $${formatNumber(mepV)}.`);
  if (Number.isFinite(eurV) && eurV > 0) parts.push(`Euro: $${formatNumber(eurV)}.`);
  if (Number.isFinite(btcUsd) && btcUsd > 0) parts.push(`BTC: US$ ${formatNumber(btcUsd)}.`);

  const finalText = parts.join(" ");
  const meta = `Actualizado: ${new Date().toLocaleString("es-AR")}`;

  textEl.textContent = finalText;
  setMeta(meta);

  try {
    localStorage.setItem(cacheKey, JSON.stringify({ text: finalText, meta }));
  } catch (_) {}
}

// ===============================
// NOTICIAS: router + render (robusto)
// ===============================

function parseNewsRoute() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  // /noticias/{categoria}/{slug}/
  if (parts[0] === "noticias" && parts.length >= 3) {
    return { category: parts[1], slug: parts[2] };
  }
  return null;
}

async function fetchArticlesJson() {
  const res = await fetch("/data/articles.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar /data/articles.json");
  return await res.json();
}

function findMainContainer() {
  // SIEMPRE renderizar dentro del contenedor SPA
  return document.getElementById("app")
    || document.querySelector("main")
    || document.body;
}

function renderNewsArticle(article) {
  const container = findMainContainer();
  container.innerHTML = `
    <section class="container" style="padding-top:24px;padding-bottom:24px;max-width:820px">
      <div style="opacity:.8;font-size:.95rem;margin-bottom:10px">
        ${article.source ? article.source + " · " : ""}${article.date ? article.date : ""}
      </div>

      <h1 style="font-size:2rem;line-height:1.15;margin:0 0 14px 0">${article.title}</h1>

      <div class="news-content" style="line-height:1.75;font-size:1.05rem">
        ${article.html || "<p>(sin contenido)</p>"}
      </div>

      <div style="margin-top:28px">
        <a href="/#noticias" style="text-decoration:none">← Volver</a>
      </div>
    </section>
  `;
}

async function tryRenderNewsFromUrl() {
  const route = parseNewsRoute();
  if (!route) return;

  try {
    const articles = await fetchArticlesJson();
    const article = articles.find(
      a => a.slug === route.slug && a.category === route.category
    );

    if (!article) {
      const container = findMainContainer();
      container.innerHTML = `
        <section class="container" style="padding:24px;max-width:820px">
          <h1>Artículo no encontrado</h1>
          <p>Slug: <b>${route.slug}</b></p>
          <p><a href="/#noticias">← Volver</a></p>
        </section>
      `;
      return;
    }

    renderNewsArticle(article);

  } catch (e) {
    console.error("Error renderizando noticia:", e);
  }
}

document.addEventListener("DOMContentLoaded", tryRenderNewsFromUrl);
