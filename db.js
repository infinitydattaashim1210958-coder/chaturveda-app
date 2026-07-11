/**
 * db.js — SQLite access layer for the Chaturveda app (v3: on-demand bhashya packs).
 *
 * Architecture:
 *   - "core" database (bundled, small, ~25MB): vedas, mantras (Samhita text),
 *     scholars (names/metadata only — NO commentary text), scholar_fields,
 *     and a search_index over Sanskrit mantra text only.
 *   - Each scholar's actual commentary lives in a separate small SQLite file
 *     ("scholar_<id>.db"), downloaded on demand from GitHub Releases, stored
 *     in the app's private data directory, and opened as its own connection
 *     only when needed. Deleting a scholar's content just removes that file.
 */

const CORE_DB_NAME = "core";
const PACK_RELEASE_BASE =
  "https://github.com/infinitydattaashim1210958-coder/chaturveda-app/releases/download/bhashyas-v1/";
const PACK_DIR = "bhashya_packs"; // subfolder within Directory.Data

function sqlitePlugin() {
  return window.Capacitor.Plugins.CapacitorSQLite;
}
function fsPlugin() {
  return window.Capacitor.Plugins.Filesystem;
}

async function initDB() {
  const sqlite = sqlitePlugin();
  const isDBExists = await sqlite.isDatabase({ database: CORE_DB_NAME });
  if (!isDBExists.result) {
    await sqlite.copyFromAssets({ overwrite: false });
  }
  await sqlite.createConnection({
    database: CORE_DB_NAME,
    encrypted: false,
    mode: "no-encryption",
    version: 1,
    readonly: false,
  });
  await sqlite.open({ database: CORE_DB_NAME });

  // Ensure the packs folder exists
  try {
    await fsPlugin().mkdir({ path: PACK_DIR, directory: "DATA", recursive: true });
  } catch (e) {
    // already exists — fine
  }
}

function rowsOf(result) {
  return (result && result.values) ? result.values : [];
}

async function query(sql, params = [], database = CORE_DB_NAME) {
  const res = await sqlitePlugin().query({ database, statement: sql, values: params });
  return rowsOf(res);
}

// ---- Core (always-available) queries ----

async function getVedas() {
  return query("SELECT * FROM vedas ORDER BY id");
}

async function getVedaByCode(code) {
  const rows = await query("SELECT * FROM vedas WHERE code=?", [code]);
  return rows[0] || null;
}

async function getLevel1List(vedaId) {
  return query(
    "SELECT DISTINCT level1 FROM mantras WHERE veda_id=? AND level1 IS NOT NULL ORDER BY level1",
    [vedaId]
  );
}

async function getLevel2List(vedaId, level1) {
  return query(
    "SELECT DISTINCT level2 FROM mantras WHERE veda_id=? AND level1=? AND level2 IS NOT NULL ORDER BY level2",
    [vedaId, level1]
  );
}

async function getMantraList(vedaId, level1, level2) {
  let sql = "SELECT * FROM mantras WHERE veda_id=?";
  const params = [vedaId];
  if (level1 !== null && level1 !== undefined) {
    sql += " AND level1=?";
    params.push(level1);
  }
  if (level2 !== null && level2 !== undefined) {
    sql += " AND level2=?";
    params.push(level2);
  }
  sql += " ORDER BY mantra_no, id";
  return query(sql, params);
}

async function getMantraRange(vedaId, fromNo, toNo) {
  return query(
    "SELECT * FROM mantras WHERE veda_id=? AND mantra_no BETWEEN ? AND ? ORDER BY mantra_no",
    [vedaId, fromNo, toNo]
  );
}

async function getMantraCount(vedaId) {
  const rows = await query("SELECT COUNT(*) as c FROM mantras WHERE veda_id=?", [vedaId]);
  return rows[0].c;
}

async function getMantraByRef(vedaId, ref) {
  const rows = await query("SELECT * FROM mantras WHERE veda_id=? AND mantra_ref_id=?", [vedaId, ref]);
  return rows[0] || null;
}

async function getAdjacentMantras(vedaId, mantraId) {
  const prevRows = await query(
    "SELECT mantra_ref_id FROM mantras WHERE veda_id=? AND id < ? ORDER BY id DESC LIMIT 1",
    [vedaId, mantraId]
  );
  const nextRows = await query(
    "SELECT mantra_ref_id FROM mantras WHERE veda_id=? AND id > ? ORDER BY id ASC LIMIT 1",
    [vedaId, mantraId]
  );
  return {
    prev: prevRows[0] ? prevRows[0].mantra_ref_id : null,
    next: nextRows[0] ? nextRows[0].mantra_ref_id : null,
  };
}

// List of scholars for a veda — metadata only, no commentary content.
// Includes pack_file/pack_size_bytes/entry_count/downloaded flag.
async function getScholarsForVeda(vedaId) {
  const scholars = await query(
    "SELECT * FROM scholars WHERE veda_id=? ORDER BY display_order, id", [vedaId]
  );
  for (const s of scholars) {
    s.downloaded = await isPackDownloaded(s.id);
    s.fields = await query(
      "SELECT field_key, display_order FROM scholar_fields WHERE scholar_id=? ORDER BY display_order",
      [s.id]
    );
  }
  return scholars;
}

function escapeFTS(term) {
  return '"' + term.replace(/"/g, '""') + '"';
}

async function search(vedaCode, term, limit = 50) {
  const ftsTerm = escapeFTS(term.trim());
  let sql = "SELECT * FROM search_index WHERE search_index MATCH ?";
  const params = [ftsTerm];
  if (vedaCode) {
    sql = "SELECT * FROM search_index WHERE veda_code=? AND search_index MATCH ?";
    params.unshift(vedaCode);
  }
  sql += " LIMIT ?";
  params.push(limit);
  return query(sql, params);
}

// ---- Scholar pack (on-demand download) management ----

function packDbName(scholarId) {
  return "pack_" + scholarId;
}
function packFileName(scholarId) {
  return `${PACK_DIR}/scholar_${scholarId}.db`;
}

async function isPackDownloaded(scholarId) {
  try {
    await fsPlugin().stat({ path: packFileName(scholarId), directory: "DATA" });
    return true;
  } catch (e) {
    return false;
  }
}

async function decompressGzip(arrayBuffer) {
  const ds = new DecompressionStream("gzip");
  const stream = new Blob([arrayBuffer]).stream().pipeThrough(ds);
  const decompressedBlob = await new Response(stream).blob();
  return decompressedBlob;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function downloadPack(scholarId, packFile, onProgress) {
  onProgress && onProgress("ডাউনলোড হচ্ছে…");
  const url = PACK_RELEASE_BASE + packFile;
  const res = await fetch(url);
  if (!res.ok) throw new Error("ডাউনলোড ব্যর্থ: HTTP " + res.status);
  const arrayBuffer = await res.arrayBuffer();

  onProgress && onProgress("আনপ্যাক হচ্ছে…");
  const decompressedBlob = await decompressGzip(arrayBuffer);
  const base64 = await blobToBase64(decompressedBlob);

  onProgress && onProgress("সেভ হচ্ছে…");
  await fsPlugin().writeFile({
    path: packFileName(scholarId),
    data: base64,
    directory: "DATA",
    recursive: true,
  });

  return true;
}

async function deletePack(scholarId) {
  await detachPack(scholarId);
  await fsPlugin().deleteFile({ path: packFileName(scholarId), directory: "DATA" });
}

const attachedPacks = new Set();

async function getBhashyaForMantraFromPack(scholarId, mantraId) {
  const sqlite = sqlitePlugin();
  const alias = "pack_" + scholarId;

  if (!attachedPacks.has(scholarId)) {
    const uriRes = await fsPlugin().getUri({ path: packFileName(scholarId), directory: "DATA" });
    let path = uriRes.uri;
    if (path.startsWith("file://")) path = path.replace("file://", "");
    await sqlite.execute({
      database: CORE_DB_NAME,
      statements: `ATTACH DATABASE '${path}' AS ${alias};`,
    });
    attachedPacks.add(scholarId);
  }

  const res = await sqlite.query({
    database: CORE_DB_NAME,
    statement: `SELECT field_key, value FROM ${alias}.bhashyas WHERE mantra_id=?`,
    values: [mantraId],
  });
  return rowsOf(res);
}

async function detachPack(scholarId) {
  const alias = "pack_" + scholarId;
  if (attachedPacks.has(scholarId)) {
    try {
      await sqlitePlugin().execute({
        database: CORE_DB_NAME,
        statements: `DETACH DATABASE ${alias};`,
      });
    } catch (e) {
      // ignore
    }
    attachedPacks.delete(scholarId);
  }
}

window.VedaDB = {
  initDB,
  getVedas,
  getVedaByCode,
  getLevel1List,
  getLevel2List,
  getMantraList,
  getMantraRange,
  getMantraCount,
  getMantraByRef,
  getAdjacentMantras,
  getScholarsForVeda,
  search,
  isPackDownloaded,
  downloadPack,
  deletePack,
  getBhashyaForMantraFromPack,
};
