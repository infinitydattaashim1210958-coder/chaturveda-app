/**
 * app.js — Hash-based router and screen renderer for the Chaturveda app.
 * All content is rendered dynamically from SQLite queries (see db.js).
 */

const root = document.getElementById("app");
const backBtn = document.getElementById("backBtn");
const titleEl = document.getElementById("appTitle");
const searchBtn = document.getElementById("searchBtn");

const VEDA_THEME = {
  rigveda:     { a: "#d4a24c", b: "#e8915c", tag: "Veda I · Knowledge" },
  yajurveda:   { a: "#ff7a1a", b: "#e8b23d", tag: "Veda II · Ritual" },
  samaveda:    { a: "#f2c464", b: "#ff7a1a", tag: "Veda III · Chant" },
  atharvaveda: { a: "#4f8c6b", b: "#c99a3e", tag: "Veda IV · Life" },
};

let vedaCache = {}; // code -> veda row (with id + labels)
let history = [];   // simple in-app back stack of hashes

function setTitle(t) {
  titleEl.textContent = t;
}

function showBack(show) {
  backBtn.style.visibility = show ? "visible" : "hidden";
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

async function ensureVedaCache() {
  if (Object.keys(vedaCache).length) return;
  const rows = await window.VedaDB.getVedas();
  for (const r of rows) vedaCache[r.code] = r;
}

// ---------- Screens ----------

async function screenHome() {
  showBack(false);
  setTitle("চতুর্বেদ সংকলন");
  await ensureVedaCache();

  const cards = Object.values(vedaCache).map((v) => {
    const theme = VEDA_THEME[v.code] || { a: "#d4a24c", b: "#e8915c", tag: "" };
    return `
      <a class="card" href="#/veda/${v.code}" style="--a:${theme.a};--b:${theme.b}">
        <div class="tag">${theme.tag}</div>
        <h2>${v.name}</h2>
        <div class="arrow">→</div>
      </a>`;
  }).join("");

  root.innerHTML = `
    <div class="hero">
      <div class="om">ॐ</div>
      <div class="sub">The Four Vedas — সম্পূর্ণ মন্ত্র সংকলন, ভাষ্য ও অনুবাদসহ</div>
    </div>
    <div class="grid">${cards}</div>`;
}

async function screenVeda(code) {
  await ensureVedaCache();
  const veda = vedaCache[code];
  if (!veda) return screenHome();
  showBack(true);
  setTitle(veda.name);

  if (veda.level1_label) {
    const level1s = await window.VedaDB.getLevel1List(veda.id);
    root.innerHTML = `
      <div class="listHeader">${veda.level1_label} বেছে নিন</div>
      <div class="numGrid">
        ${level1s.map(r => `<a class="numChip" href="#/veda/${code}/${r.level1}">${r.level1}</a>`).join("")}
      </div>`;
  } else {
    // Flat veda (e.g. Samaveda) — paginate by mantra_no in chunks of 100
    const total = await window.VedaDB.getMantraCount(veda.id);
    const chunkSize = 100;
    const chunks = [];
    for (let start = 1; start <= total; start += chunkSize) {
      chunks.push([start, Math.min(start + chunkSize - 1, total)]);
    }
    root.innerHTML = `
      <div class="listHeader">${veda.mantra_no_label || "মন্ত্র"} নির্বাচন করুন (মোট ${total})</div>
      <div class="rangeList">
        ${chunks.map(([s, e]) => `<a class="rangeItem" href="#/veda/${code}/range/${s}-${e}">${s}–${e}</a>`).join("")}
      </div>`;
  }
}

async function screenLevel1(code, level1) {
  await ensureVedaCache();
  const veda = vedaCache[code];
  if (!veda) return screenHome();
  showBack(true);

  if (level1 === "range") return; // handled separately below via screenRange

  setTitle(`${veda.level1_label} ${level1}`);

  if (veda.level2_label) {
    const level2s = await window.VedaDB.getLevel2List(veda.id, level1);
    root.innerHTML = `
      <div class="listHeader">${veda.level2_label} বেছে নিন</div>
      <div class="numGrid">
        ${level2s.map(r => `<a class="numChip" href="#/veda/${code}/${level1}/${r.level2}">${r.level2}</a>`).join("")}
      </div>`;
  } else {
    const mantras = await window.VedaDB.getMantraList(veda.id, level1, null);
    renderMantraList(veda, mantras);
  }
}

async function screenRange(code, fromNo, toNo) {
  await ensureVedaCache();
  const veda = vedaCache[code];
  if (!veda) return screenHome();
  showBack(true);
  setTitle(`${veda.mantra_no_label || "মন্ত্র"} ${fromNo}–${toNo}`);
  const mantras = await window.VedaDB.getMantraRange(veda.id, fromNo, toNo);
  renderMantraList(veda, mantras);
}

async function screenLevel2(code, level1, level2) {
  await ensureVedaCache();
  const veda = vedaCache[code];
  if (!veda) return screenHome();
  showBack(true);
  setTitle(`${veda.level1_label} ${level1} · ${veda.level2_label} ${level2}`);
  const mantras = await window.VedaDB.getMantraList(veda.id, level1, level2);
  renderMantraList(veda, mantras);
}

function renderMantraList(veda, mantras) {
  root.innerHTML = `
    <div class="listHeader">${mantras.length} মন্ত্র</div>
    <div class="mantraList">
      ${mantras.map(m => `
        <a class="mantraItem" href="#/mantra/${veda.code}/${encodeURIComponent(m.mantra_ref_id)}">
          <div class="mref">${m.mantra_ref_id}</div>
          <div class="mtext">${(m.sanskrit_text || "").slice(0, 70)}${(m.sanskrit_text || "").length > 70 ? "…" : ""}</div>
        </a>`).join("")}
    </div>`;
}

async function screenMantra(code, refEncoded) {
  await ensureVedaCache();
  const veda = vedaCache[code];
  if (!veda) return screenHome();
  const ref = decodeURIComponent(refEncoded);
  showBack(true);
  setTitle(`${veda.name} ${ref}`);

  const mantra = await window.VedaDB.getMantraByRef(veda.id, ref);
  if (!mantra) {
    root.innerHTML = `<div class="empty">এই মন্ত্র খুঁজে পাওয়া যায়নি।</div>`;
    return;
  }
  const scholars = await window.VedaDB.getScholarsForMantra(mantra.id);

  const meta = [
    mantra.devata ? `দেবতা: ${mantra.devata}` : "",
    mantra.rishi ? `ঋষি: ${mantra.rishi}` : "",
    mantra.chhanda ? `ছন্দ: ${mantra.chhanda}` : "",
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");

  const tabsHtml = scholars.map((s, i) => `
    <button class="tabBtn ${i === 0 ? "active" : ""}" data-scholar="${s.id}">
      ${s.name}${s.language ? ` <span class="lang">(${s.language})</span>` : ""}
    </button>`).join("");

  const panelsHtml = scholars.map((s, i) => `
    <div class="tabPanel ${i === 0 ? "active" : ""}" data-scholar="${s.id}">
      ${s.fields.map(f => `
        <div class="field">
          <div class="fieldLabel">${f.field_key}</div>
          <div class="fieldValue">${f.value}</div>
        </div>`).join("") || `<div class="empty">কোনো তথ্য নেই।</div>`}
    </div>`).join("");

  root.innerHTML = `
    <div class="mantraDetail">
      <div class="sanskritBlock">${mantra.sanskrit_text || ""}</div>
      ${meta ? `<div class="mantraMeta">${meta}</div>` : ""}
    </div>
    ${scholars.length ? `
      <div class="tabBar">${tabsHtml}</div>
      <div class="tabPanels">${panelsHtml}</div>
    ` : `<div class="empty">এই মন্ত্রের কোনো ভাষ্য পাওয়া যায়নি।</div>`}
  `;

  root.querySelectorAll(".tabBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      root.querySelectorAll(".tabBtn").forEach(b => b.classList.remove("active"));
      root.querySelectorAll(".tabPanel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      root.querySelector(`.tabPanel[data-scholar="${btn.dataset.scholar}"]`).classList.add("active");
    });
  });
}

async function screenSearch() {
  showBack(true);
  setTitle("খুঁজুন");
  root.innerHTML = `
    <div class="searchBox">
      <input type="text" id="searchInput" placeholder="সংস্কৃত, বাংলা বা ইংরেজিতে খুঁজুন…" autofocus />
    </div>
    <div id="searchResults"></div>`;

  const input = document.getElementById("searchInput");
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => runSearch(input.value), 350);
  });
}

async function runSearch(term) {
  const resultsEl = document.getElementById("searchResults");
  if (!term || term.trim().length < 2) {
    resultsEl.innerHTML = "";
    return;
  }
  await ensureVedaCache();
  const codeToName = {};
  for (const [code, v] of Object.entries(vedaCache)) codeToName[code] = v.name;

  try {
    const results = await window.VedaDB.search(null, term, 60);
    if (!results.length) {
      resultsEl.innerHTML = `<div class="empty">কোনো ফলাফল পাওয়া যায়নি।</div>`;
      return;
    }
    resultsEl.innerHTML = results.map(r => `
      <a class="mantraItem" href="#/mantra/${r.veda_code}/${encodeURIComponent(r.mantra_ref_id)}">
        <div class="mref">${codeToName[r.veda_code] || r.veda_code} ${r.mantra_ref_id}</div>
        <div class="mtext">${(r.content || "").slice(0, 90)}…</div>
      </a>`).join("");
  } catch (e) {
    resultsEl.innerHTML = `<div class="empty">সার্চ ব্যর্থ হয়েছে।</div>`;
    console.error(e);
  }
}

// ---------- Router ----------

async function router() {
  const hash = location.hash || "#/";
  const parts = hash.replace(/^#\//, "").split("/").filter(Boolean);

  if (parts.length === 0) return screenHome();

  if (parts[0] === "search") return screenSearch();

  if (parts[0] === "veda" && parts.length === 2) return screenVeda(parts[1]);

  if (parts[0] === "veda" && parts.length === 4 && parts[2] === "range") {
    const [fromNo, toNo] = parts[3].split("-").map(Number);
    return screenRange(parts[1], fromNo, toNo);
  }

  if (parts[0] === "veda" && parts.length === 3) return screenLevel1(parts[1], parts[2]);
  if (parts[0] === "veda" && parts.length === 4) return screenLevel2(parts[1], parts[2], parts[3]);

  if (parts[0] === "mantra" && parts.length === 3) return screenMantra(parts[1], parts[2]);

  return screenHome();
}

window.addEventListener("hashchange", router);
backBtn.addEventListener("click", () => history.length ? window.history.back() : (location.hash = "#/"));
searchBtn.addEventListener("click", () => (location.hash = "#/search"));

async function boot() {
  root.innerHTML = `<div class="loading"><div class="om spin">ॐ</div><div>ডাটাবেস লোড হচ্ছে…</div></div>`;
  try {
    await window.VedaDB.initDB();
    router();
  } catch (e) {
    root.innerHTML = `<div class="empty">ডাটাবেস লোড করতে সমস্যা হয়েছে।<br><small>${e.message || e}</small></div>`;
    console.error(e);
  }
}

document.addEventListener("deviceready", boot);
// Fallback for browser preview / non-Capacitor context
if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) {
  window.addEventListener("DOMContentLoaded", () => {
    root.innerHTML = `<div class="empty">এই অ্যাপ শুধু Android বিল্ডে (Capacitor) কাজ করে — ব্রাউজার প্রিভিউতে ডাটাবেস প্লাগইন পাওয়া যায় না।</div>`;
  });
}
