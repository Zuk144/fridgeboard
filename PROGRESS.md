# FRIDGEBOARD progress

Updated Nov 5, 2026. A fresh session should read this file first, then `DASHBOARD_FRAME.md` and `CLAUDE.md`.

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

## Done

- **Design exploration:** three looks at 1080×1920 (`design/a-paper-planner.*`,
  `b-fridge-door.*`, `c-chalkboard.*`).
- **M0 probe** (`public/probe/index.html`, hand-written ES5, copied into `dist/` as-is): screen,
  viewport, DPR, touch, JS level, WebCrypto (AES-GCM, PBKDF2 150k timing, JWK key store), storage,
  grid, flex gap, CSS effects, Intl + both 2026 DST checks, CPU, the paper look's fonts, a
  text/plain POST and a redirect fetch (`?ep=<script URL>` aims them at the real script), plus six
  look tests. Checked at 1080×1920 and 1920×1080.
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
- Checks: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` (32 tests) all pass.

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

### Probe the fridge (C1)

Open `https://zuk144.github.io/fridgeboard/probe/` in the fridge's browser, wait for **DONE**,
and photograph the white results box and the look tests below it. Send the photos.

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

## Next

1. Probe photos from the fridge (finishes M0); set the build target and screen size from them.
   M2 doesn't wait for them: it targets Chrome ~63 at 1080×1920 portrait and 1920×1080 landscape.
2. Build M2 in the paper look on fake board data (`?now=` preview override, every screenshot
   state in the prompt), wired to the real script once the secrets are in.
3. M2.5 board UI + sync on top of the already-built script endpoints.

## Prompt to continue in a fresh session

```
Use the dash-dev agent. Read PROGRESS.md, DASHBOARD_FRAME.md and CLAUDE.md, then continue from
"Next".
```
