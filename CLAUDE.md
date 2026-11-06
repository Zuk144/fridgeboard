# FRIDGEBOARD

Family dashboard for Zuk's Samsung Family Hub fridge screen. It's a static site on GitHub Pages. One Google Apps Script, bound to Zuk's "Fridgeboard" Google Sheet, serves the calendar, weather, and kitchen list live; the fridge calls it with a key that ships inside an encrypted config. Calendar first, weather second, everything else is an optional module. The look is **A · Paper planner** (`design/`, frame §2).

**Read `DASHBOARD_FRAME.md` before any feature work.** It's the source of truth for what we're building and why. If you change behavior, update the frame in the same change.

For build work, use the `dash-dev` agent (`.claude/agents/dash-dev.md`). It has the rules for the fridge browser, privacy, and verification.

## Hard rules (short version)

1. **No personal data in the repo, ever.** The repo is public. The script URL, its key, and the passphrase live only in GitHub Secrets (`DASH_CONFIG`, `DASH_PASSPHRASE`) and a local, gitignored `.env.local`. Calendar choices and home location live in Zuk's Sheet. Fixtures are fake.
2. **Only encrypted config gets published.** `dist/` holds the page and `config.enc.json`, nothing readable about the family. A test enforces it.
3. **Fridge-browser safe.** The fridge runs Samsung's Tizen browser on Chrome 108 (M0 probe) with a CPU about 7x slower than a laptop. The build targets Chrome 108 directly (one modern bundle, no legacy copy). No framework-heavy dependencies, no hover-only UI, cheap repaints.
4. **Not done until it's seen.** Visual work needs a screenshot at the fridge's viewport: 720×1229 CSS px at deviceScaleFactor 1.5 (and 720×1280, when its browser bars hide). The board is portrait only; a wider screen gets the same page, letterboxed.
5. **Work stays off the fridge.** Travel shows only "Dad's away." Strip work titles, locations, and descriptions in the script, not in the UI.

## Commands (fill in as they exist)

- `npm run dev` — local dashboard. Dev only: `?fixture=<name>` shows a fake board without unlocking (names in `test/fixtures/boards.ts`), `?now=2026-11-15T19:30` sets the clock, `?offline=1`, `?off=weather,kitchen`, `?open=agenda:2026-11-16|kitchen|settings`
- `npm run build` — production build to `dist/` (the probe is copied from `public/probe/`)
- `npm run encrypt-config` — `DASH_CONFIG` + `DASH_PASSPHRASE` (env or `.env.local`) → `dist/config.enc.json`
- `npm run decrypt-check [-- <url>]` — round-trips the built or deployed config
- `npm run script-check` — calls the live Google script with `DASH_CONFIG` and prints counts only (runs on every deploy)
- `npm test` (includes the Apps Script harness and the dist guard) / `npm run typecheck` / `npm run lint`
- The Google side has no build: paste `apps-script/Code.gs` into the Sheet's Apps Script editor and deploy a new version.

## Talking with Zuk

- Casual and direct. Lead with what changed and what he can try right now.
- **Show the work:** what you built, how you checked it, and a screenshot when it's visual.
- Plain language, no hype. If something is shaky or a hack, say so.
- Bring real decisions with a recommendation ("Option A (recommended) because…"). Make small calls yourself, note them, keep moving.
- **Never paste secrets into chat or commit them.** When a secret is needed, tell Zuk exactly where to paste it (repo → Settings → Secrets and variables → Actions).
- Zuk reviews and clicks confirm on anything that publishes or changes his accounts.
