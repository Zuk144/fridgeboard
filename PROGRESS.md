# FRIDGEBOARD progress

Updated Nov 5, 2026 (M2 built). A fresh session should read this file first, then `DASHBOARD_FRAME.md` and `CLAUDE.md`.

## Where things live right now

- This public repo, `Zuk144/fridgeboard`, branch `main` (moved here on Nov 5 from a staging
  folder in Zuk's private playground repo). Pushes to `main` deploy to GitHub Pages.
- Site: https://zuk144.github.io/fridgeboard/ · probe: https://zuk144.github.io/fridgeboard/probe/
- Design canvas (three looks side by side): https://claude.ai/artifact/TZATgMivtYoxP1BV3iPymp
  (private to Zuk). Sources and previews: `design/`.

## Decisions made (Nov 5)

- **Look: A · Paper planner.** Frame §2 describes it. Paper by day, dark at night (replaces the
  frame's old "dark by default").
- **Calendar: one Google Apps Script**, the same one as the kitchen list. It reads calendars live
  and adds weather; there are no secret iCal links and no scheduled GitHub job. Frame §3, §4, §5.1,
  §5.2, §5.4, §11–13 were rewritten for it.
- **Repo:** public `Zuk144/fridgeboard`, created by Zuk (with Claude in Chrome on his laptop).
- **Target screen (from the probe):** 720 x 1229 CSS px portrait at DPR 1.5, Chrome 108. The page
  is drawn 1080 units wide and scaled to fit; its height flexes between about 1844 and 1920 units.
  Landscape 1920 x 1080 works but is secondary.

## Done

- **Design exploration:** three looks at 1080×1920 (`design/a-paper-planner.*`,
  `b-fridge-door.*`, `c-chalkboard.*`).
- **M0 probe** (`public/probe/index.html`, hand-written ES5, copied into `dist/` as-is): screen,
  viewport, DPR, touch, JS level, WebCrypto (AES-GCM, PBKDF2 150k timing, JWK key store), storage,
  grid, flex gap, CSS effects, Intl + both 2026 DST checks, CPU, the paper look's fonts, a
  text/plain POST and a redirect fetch (`?ep=<script URL>` aims them at the real script), plus six
  look tests. Checked at 1080×1920 and 1920×1080.
- **M0 done on the real fridge (Nov 5, 13:35):** Tizen 7.0, Family Hub 10.0, SamsungBrowser 1.0 on
  **Chrome 108**; viewport 721 x 1229 CSS px (browser bars showing), screen 720 x 1280, **DPR 1.5**;
  touchstart + PointerEvent (maxTouchPoints reports 0, so don't rely on it); secure context; ES2015,
  async, spread, optional chaining; fetch, TextEncoder, localStorage; grid, flex gap, CSS vars,
  clip-path, mask, filter, sticky, object-fit; Intl America/New_York with both DST checks (device
  zone is New York); CPU loop 70 ms vs about 10 on a laptop (~7x slower); AES-GCM, PBKDF2 150k in
  80 ms, JWK store; text/plain POST 200 in 447 ms and redirect-following fetch both pass; all six
  web fonts and every look test render.
- **M0 skeleton:** Vite 5 + TypeScript + `@vitejs/plugin-legacy` (targets Chrome ≥ 61), Vitest,
  ESLint, `shared/payload.ts` (schemaVersion 1), placeholder `index.html`, dist guard test.
- **M1 Google side** (`apps-script/Code.gs`): `setup()` builds Settings, Calendars (auto-listed
  from your Google account), Items (the 28 starter buttons), Needed, and Log tabs, plus a 64-char
  key. `board` returns calendar + weather + list summary (cached 2 min). `state`, `need`, `undo`
  (30 s), and `gotit` run the list. `onEdit` stamps "Got it" ticks made on a phone. JSONP fallback.
- **M1 tests:** 26 harness tests run the real Code.gs in Node against fake Google services:
  all-day single/multi-day, the UTC Family calendar, cross-midnight, both DST changes and local
  midnight, duplicates merged, observances hidden, sports never busy + late tag, busy-only, hidden
  words, travel turned into dates with no details leaking, weather shaping + wear call, cache,
  idempotent need, one-off items, undo window, got-it + cleanup, phone ticks, keys, JSONP.
- **Encrypted config:** `shared/crypto.ts` (same WebCrypto code in Node and the browser),
  `npm run encrypt-config`, `npm run decrypt-check`, 4 crypto tests. The salt is fixed per site
  so the fridge's stored key survives redeploys.
- **Deploy workflow** (`.github/workflows/deploy.yml`): push to main or run by hand → typecheck,
  lint, build, encrypt config (skipped until secrets exist), decrypt-check, tests, deploy to
  Pages. No schedule, so there's no 60-day shutoff to manage.
- **M2 dashboard (paper planner)**, in `src/`:
  - Unlock once with the passphrase (stored JWK key after; the encrypted config is kept too, so an
    offline reboot still unlocks), "Not set up yet" when `config.enc.json` is missing, a clear note
    for a wrong key or a newer script schema.
  - Board: header (clock, date, weather now + hi/lo, wear call circled in red pen, "updated X min
    ago"), game-day washi tape (countdown → "Game on!" for 3 hours, LATE GAME tag), Dad's-away
    note, Today (all-day chips, ruled timeline, crossed-out past, highlighter, folding when full,
    empty-day note), Next Up sticky with countdown (or a "coming up" index card when nothing is
    left today), holiday countdown kraft tag, rolling 7-day week grid with the trip arrow, 12-hour
    weather strip + 3-day outlook + sunrise/sunset, "We're out" notepad from `board.kitchen`.
  - Tap a day (week column, Today, the sticky) → full-screen agenda. Tap the notepad → placeholder
    pointing at the Sheet (the real list board is M2.5). Long-press the clock → Reload / Forget
    this device.
  - Fridge behavior: 5-minute polling (re-render only on a new board), minute ticks that touch
    only changed DOM, retry backoff, JSONP fallback, last good board kept for offline, offline
    badge, amber stale banner, night mode 10 pm–6 am (dim clock + next morning's first event, tap
    wakes the dark board for 60 s), Tomorrow peek from 6 pm, hourly burn-in drift, overlays close
    after 2 minutes.
  - Modules with switches in `DASH_CONFIG.modules` (`calendar`, `week`, `gameday`, `weather`,
    `kitchen`; all on unless set false); the layout gives a missing module's room to Today.
  - Self-hosted Caveat 700 + Patrick Hand (woff2, OFL in `public/fonts/OFL.txt`), a 22 KB grain PNG.
  - Build: both plugin-legacy bundles aimed at Chrome 108, no modern polyfills. The fridge loads
    about 18 KB gzipped JS + 5 KB CSS.
  - Dev only: `?fixture=<name>` (fake boards made by the real Code.gs in the harness,
    `test/fixtures/boards.ts`), `?now=`, `?offline=1`, `?off=`, `?open=`. Not in the build.
- Checks: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` (93 tests: script
  harness, crypto, dist guard, 26 board-logic tests, 33 render/layout tests over every fixture).
- Screenshots of every state at 720 x 1229 and 720 x 1280 (DPR 1.5) and landscape were looked at
  and fixed; four are committed in `design/screens/`. A headless run of the built site checked the
  real flow: not set up, unlock, wrong passphrase, stored key on reload, offline, stale, JSONP
  fallback, bad key, forget this device.

## Setup status (Nov 5)

Done by Zuk (with Claude in Chrome on the laptop):
- Public repo `Zuk144/fridgeboard`; the Claude GitHub app already covers all repos.
- Pages on (Source: GitHub Actions); the first deploy succeeded.
- Google Sheet "Fridgeboard" with the script pasted, `setup()` run, weather town set (coordinates
  found), "Me" relabeled "Dad", calendars on: Dad, Family, Holidays, Steelers. Web app deployed
  (Version 1, execute as Zuk, access Anyone). It answers `bad_key` without the key.
- Secrets `DASH_CONFIG` and `DASH_PASSPHRASE` saved.

Every deploy now encrypts the config, checks it opens (`decrypt-check`), and calls the live script
(`script-check`, counts only in the public log).

**M1 verified end to end (Nov 5, deploy run 42084560754):** `decrypt-check: PASS`, and
`script-check: PASS · schema 1 · 4 calendars · 2 events · 0 trips · weather ok · list 0 needed ·
28 list buttons`. The 2 events match the real calendars for Nov 5–18 (Veterans Day and Steelers
@ Bengals; Dad and Family are empty). The real Apps Script ran Code.gs with no runtime errors.
(DASH_PASSPHRASE had to be lengthened to 8+ characters first.)

## Waiting on Zuk

### Look at M2 on the fridge

1. On the fridge, open https://zuk144.github.io/fridgeboard/ (refresh if the probe page is open).
2. Type the passphrase (the `DASH_PASSPHRASE` secret) and tap **Unlock**. It only asks once.
3. Check from across the kitchen: is the clock and today's list readable? Does tapping a day open
   the agenda, and does the big **Close** button work?
4. Long-press the clock for a second to see the hidden **Forget this device** option.
5. Send a photo or two, plus anything that looks off.

Your real calendars are nearly empty right now, so expect mostly the Steelers, holidays and the
"coming up" card. Putting something on the Family calendar shows up within about 5 minutes.

## Reference: Google setup steps

Kept for re-doing the setup or updating the script. `LAPTOP_SETUP.md` has the same steps as a
paste-in prompt for Claude in Chrome.

### Google setup (about 10 minutes)

Use Safari on the iPad or any computer. If a Google page opens the mobile view or the app, tap
**aA → Request Desktop Website** in Safari.

**Make the Sheet**
1. Go to **sheets.new**. A blank Google Sheet opens.
2. Tap "Untitled spreadsheet" and name it **Fridgeboard**.

**Paste the script**
3. Menu **Extensions → Apps Script**. The script editor opens in a new tab.
4. In another tab, open https://raw.githubusercontent.com/Zuk144/fridgeboard/main/apps-script/Code.gs,
   then select all and copy.
5. Back in the script editor, select everything in `Code.gs`, delete it, and paste.
6. Tap the **save** icon. Name the project **Fridgeboard** if it asks.

**Run setup**
7. In the toolbar, pick **setup** in the function dropdown, then tap **Run**.
8. Google asks for permission: **Review permissions** → pick your account → "Google hasn't
   verified this app" → **Advanced** → **Go to Fridgeboard (unsafe)** → **Allow**. This warning
   is normal for your own script. It asks to read your calendars, edit this one spreadsheet, and
   reach the weather service.
9. Wait for "Execution completed". The Sheet now has Settings, Calendars, Items, Needed, and Log tabs.

**Tune it**
10. **Settings** tab: type your town or ZIP in the `weatherPlace` value cell (for example
    Pittsburgh). It stays in your Sheet.
11. **Calendars** tab: your main calendar, Family, Holidays, and Steelers start ticked. Change
    the label "Me" to **Dad**. Tick or untick anything else.
12. Back in the script editor, run **setup** again. It looks up your town's coordinates.

**Deploy it**
13. **Deploy** (top right) → **New deployment** → gear icon next to "Select type" → **Web app**.
14. Description: `fridge`. Execute as: **Me**. Who has access: **Anyone**. Tap **Deploy**.
15. Copy the **Web app URL** (it ends in `/exec`). Keep it somewhere private, like your Notes app.

**Get the key**
16. Function dropdown → **showKey** → **Run**. The log at the bottom shows `Fridge key: …`
    (64 letters and numbers). Copy it and keep it with the URL. Don't paste it into chat.

**See your calendar come through (optional, 30 seconds)**
17. In Safari, open your Web app URL with `?action=board&k=` and your key on the end, like
    `https://script.google.com/macros/s/…/exec?action=board&k=…`. You should see your events,
    the Steelers games, holidays, and the weather as text. That means the calendar is plugged in.

**Later: when the code changes**
- Paste the new `Code.gs`, save, then **Deploy → Manage deployments → pencil icon → Version:
  New version → Deploy**. The URL stays the same.

### Secrets

**fridgeboard repo → Settings → Secrets and variables → Actions → New repository secret**, twice:
- Name `DASH_CONFIG`, value (fill in your two values):
  `{"endpointUrl": "https://script.google.com/macros/s/PASTE/exec", "key": "PASTE"}`
- Name `DASH_PASSPHRASE`, value: a passphrase you'll type once on the fridge (four or more
  made-up words is good).

Then tell Claude "secrets are in". Never paste the URL, key, or passphrase into chat.

## Small calls made (no need to weigh in)

- Week strip is a rolling 7 days starting today.
- M2: the week grid writes times in planner shorthand ("6 Taco night", "4:30 Piano") and wraps
  titles to two lines; today's column lists only what's still ahead.
- M2: an empty Today shows a "coming up" index card with the next thing on the calendar where the
  Next Up sticky would be (the sticky itself stays hidden when nothing is left today).
- M2: night mode looks ahead to tomorrow before midnight and to the same day after midnight.
- M2: module on/off switches live in `DASH_CONFIG.modules` (all on by default), so turning one off
  is a secret edit + redeploy, not a code change.
- M2: the modern bundle ships no polyfills (Chrome 108 has everything the code uses).
- Removed Zuk's email from `DASHBOARD_FRAME.md` §5.1 (the repo will be public).
- Fonts: the real build self-hosts the look's two fonts (Caveat, Patrick Hand) as woff2.
- Paper texture: a small pre-rendered grain PNG instead of the mockups' live SVG filter.
- The probe lives in `public/probe/` so Vite copies it untouched (the frame said `probe/`).
- Night-mode hours, the Tomorrow-peek hour, and the stale threshold are Settings rows in the
  Sheet, sent in `board.display`, so they can be changed from a phone.
- Sports calendars start unticked except names containing "Steelers" (`FB.defaultOnTeams`).
- New one-off list items get ids like `x-birthday-candles`; typing a known name ("MILK") maps to
  its button.
- "Got it" rows tidy themselves out of the Needed tab after 24 hours (the Log keeps history).
- Encrypted config is `config.enc.json`, not `data.enc.json`: it holds only the script URL and key.

## Real-calendar notes (checked Nov 5 via the Calendar connector; nothing copied into the repo)

- Calendars: primary, Family (time zone UTC; the script handles that), Appointment, Holidays in
  United States, Steelers, Titans, Colts, Sunrise and sunset.
- Primary and Family have no events in the next two weeks, so early on the board will mostly show
  Steelers games and holidays. Family events should go on the Family calendar.
- No Travel calendar yet. Until there is one, "Dad's away" comes from flight/hotel keywords.

## Open questions (no rush)

- **Night hours:** 10 pm to 6 am (Settings tab, `nightStartHour` / `nightEndHour`). Change them in
  the Sheet if the kitchen is still busy at 10.
- **Christmas countdown:** the tag only sees as far as the board's 14 days (`daysAhead`). A longer
  holiday lookahead needs a small script change; parked in `IDEAS.md`.
- **Landscape:** works, not polished. Only matters if the board is ever shown on a landscape screen.

## Next

1. Zuk looks at M2 on the fridge (above). Fix what's off; measure unlock + first render there.
2. **M2.5 kitchen list board:** the tap-to-add tiles, undo toast, offline queue and sync badge on
   top of the script's `state` / `need` / `undo` / `gotit` endpoints (frame §8). The "We're out"
   notepad's tap currently opens a placeholder; it becomes the door to the list board.
3. M3 hardening: per-source error states, a performance check on the fridge, README.

## Prompt to continue in a fresh session

```
Use the dash-dev agent. Read PROGRESS.md, DASHBOARD_FRAME.md and CLAUDE.md, then continue from
"Next" (M2.5, the kitchen list board, unless Zuk's fridge photos need fixes first). Check visual
work with `npm run dev` and `?fixture=<name>` at 720x1229, deviceScaleFactor 1.5.
```
