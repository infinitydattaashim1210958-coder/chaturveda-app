/**
 * db.js — SQLite access layer for the Chaturveda app.
 * Uses @capacitor-community/sqlite. On first launch, copies the bundled
 * chaturveda.db from www/assets/databases/ into the app's writable SQLite
 * storage, then opens a connection for querying.
 */

const DB_NAME = "chaturveda";
let sqlite = null;
let db = null;

async function initDB() {
  const capSQLite = window.Capacitor.Plugins.CapacitorSQLite;
  sqlite = new window.SQLiteConnection(capSQLite);

  const isDBExists = await sqlite.isDatabase(DB_NAME);

  if (!isDBExists.result) {
    // Copies every .db file found in www/assets/databases/ into app storage
    await sqlite.copyFromAssets();
  }

  db = await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
  await db.open();
}

function rowsOf(result) {
  return (result && result.values) ? result.values : [];
}

async function query(sql, params = []) {
  const res = await db.query(sql, params);
  return rowsOf(res);
}

// ---- Public API ----

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

// For flat vedas (e.g. Samaveda) or long lists — paginated by mantra_no range
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
  const rows = await query(
    "SELECT * FROM mantras WHERE veda_id=? AND mantra_ref_id=?",
    [vedaId, ref]
  );
  return rows[0] || null;
}

async function getScholarsForMantra(mantraId) {
  const scholars = await query(
    `SELECT DISTINCT s.id, s.name, s.language, s.display_order
     FROM bhashyas b JOIN scholars s ON b.scholar_id = s.id
     WHERE b.mantra_id=?
     ORDER BY s.display_order, s.id`,
    [mantraId]
  );
  for (const sc of scholars) {
    sc.fields = await query(
      `SELECT b.field_key, b.value, sf.display_order
       FROM bhashyas b
       LEFT JOIN scholar_fields sf ON sf.scholar_id = b.scholar_id AND sf.field_key = b.field_key
       WHERE b.mantra_id=? AND b.scholar_id=?
       ORDER BY sf.display_order, b.field_key`,
      [mantraId, sc.id]
    );
  }
  return scholars;
}

function escapeFTS(term) {
  // Wrap in double quotes to treat as a literal phrase, escaping inner quotes
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
  getScholarsForMantra,
  search,
};
