# Chaturveda App v2 — SQLite-backed, vedicscriptures.in style

## What changed from v1
Instead of 5 giant static HTML files, the app now has a small code shell
(`www/`, ~30KB total) that queries a SQLite database at runtime — same
approach as vedicscriptures.in. Navigation, search, and scholar tabs are
all generated dynamically from the database.

## One-time setup

### Step 1 — Upload the code (small files, normal upload works)
Upload this entire folder structure to your GitHub repo (replacing the old
`www` folder and root files):
```
package.json
capacitor.config.json
.github/workflows/build.yml
www/index.html
www/css/app.css
www/js/db.js
www/js/app.js
www/assets/databases/.gitkeep   (empty placeholder — do NOT put the .db here)
```

### Step 2 — Upload the database as a GitHub Release (NOT as a repo file)
The database (`chaturveda.db.gz`, ~103MB) is too large for normal repo
uploads (GitHub caps browser uploads at 25MB, git itself caps at 100MB).
Releases support files up to 2GB via the browser, so:

1. In your repo, tap **"Releases"** (right sidebar on desktop, or under
   the repo's main menu on mobile — may be under "..." or need switching
   to desktop site view)
2. Tap **"Create a new release"**
3. Tag: type anything, e.g. `v1` → **"Create new tag"**
4. Title: anything, e.g. "Database v1"
5. Scroll to **"Attach binaries"** → upload `chaturveda.db.gz`
6. Tap **"Publish release"**

**Important:** the asset filename must be exactly `chaturveda.db.gz` —
the build workflow looks for that exact name in your **latest** release.

### Step 3 — Build
Go to **Actions** tab → the workflow runs automatically on push, or tap
**Run workflow** manually. It will:
1. Download `chaturveda.db.gz` from your latest Release
2. Unzip it into `www/assets/databases/chaturveda.db`
3. Build the Android APK with the database bundled inside

### Step 4 — Download & install
Same as before: completed run → **Artifacts** → `chaturveda-app-debug` →
extract → install `app-debug.apk`.

## Adding new scholars later
1. Add their Excel file + one row in `scholars_mapping_all.csv`
   (locally, not in this app repo — that's in the data-processing project)
2. Re-run `build_db.py` to regenerate `chaturveda.db`
3. Gzip it: `gzip chaturveda.db`
4. Publish a **new Release** with the updated `chaturveda.db.gz`
   (same exact filename) — the next Actions build will pick it up
   automatically, no code changes needed.

## App structure reference
- `www/js/db.js` — all SQLite queries (add new query functions here if
  you want new views/features)
- `www/js/app.js` — router + screen rendering (hash-based navigation)
- `www/css/app.css` — dark yajna-kunda theme, per-veda accent colors
- Database schema: `vedas`, `mantras`, `scholars`, `scholar_fields`,
  `bhashyas`, `search_index` (FTS5 full-text search)
