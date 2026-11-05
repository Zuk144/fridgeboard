# FRIDGEBOARD

Family dashboard for Zuk's Samsung Family Hub fridge screen. It's a static site on GitHub Pages. One Google Apps Script, bound to Zuk's "Fridgeboard" Google Sheet, serves the calendar, weather, and kitchen list live; the fridge calls it with a key that ships inside an encrypted config. Calendar first, weather second, everything else is an optional module. The look is **A · Paper planner** (`design/`, frame §2).

**Read `DASHBOARD_FRAME.md` before any feature work.** It's the source of truth for what we're building and why. If you change behavior, update the frame in the same change.

For build work, use the `dash-dev` agent (`.claude/agents/dash-dev.md`). It has the rules for the old fridge browser, privacy, and verification.

## Hard rules (short version)

1. **No personal data in the repo, ever.** The repo is public. The script URL, its key, and the passphrase live only in GitHub Secrets (`DASH_CONFIG`, `DASH_PASSPHRASE`) and a local, gitignored `.env.local`. Calendar choices and home location live in Zuk's Sheet. Fixtures are fake.
2. **Only encrypted config gets published.** `dist/` holds the page and `config.enc.json`, nothing readable about the family. A test enforces it.
3. **Old-browser safe.** The fridge browser is old Chromium on Tizen. Build through `@vitejs/plugin-legacy`. No framework-heavy dependencies, no hover-only UI.
4. **Not done until it's seen.** Visual work needs a screenshot at the fridge resolution (from the M0 probe; until then, 1080×1920 portrait and 1920×1080 landscape).
5. **Work stays off the fridge.** Travel shows only "Dad's away." Strip work titles, locations, and descriptions in the script, not in the UI.

## Commands (fill in as they exist)

- `npm run dev` — local dashboard
- `npm run build` — production build to `dist/` (the probe is copied from `public/probe/`)
- `npm run encrypt-config` — `DASH_CONFIG` + `DASH_PASSPHRASE` (env or `.env.local`) → `dist/config.enc.json`
- `npm run decrypt-check [-- <url>]` — round-trips the built or deployed config
- `npm test` (includes the Apps Script harness and the dist guard) / `npm run typecheck` / `npm run lint`
- The Google side has no build: paste `apps-script/Code.gs` into the Sheet's Apps Script editor and deploy a new version.

## Talking with Zuk

- Casual and direct. Lead with what changed and what he can try right now.
- **Show the work:** what you built, how you checked it, and a screenshot when it's visual.
- Plain language, no hype. If something is shaky or a hack, say so.
- Bring real decisions with a recommendation ("Option A (recommended) because…"). Make small calls yourself, note them, keep moving.
- **Never paste secrets into chat or commit them.** When a secret is needed, tell Zuk exactly where to paste it (repo → Settings → Secrets and variables → Actions).
- Zuk reviews and clicks confirm on anything that publishes or changes his accounts.
