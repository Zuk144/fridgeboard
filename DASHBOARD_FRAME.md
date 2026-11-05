# FRIDGEBOARD — Design Frame

A personal family dashboard for the Samsung Family Hub fridge screen, opened in the fridge's built-in browser. Calendar is the main event. Hosted free on GitHub.

---

## 1. What it is

One web page, pinned on the fridge, that answers the questions people ask in the kitchen:

- What's happening today? What's next, and how long until it starts?
- What does the rest of the week look like?
- Is Dad home tonight, or traveling?
- Do the kids need a jacket?

It is read at a glance from across the kitchen and tapped with wet or messy hands. It's not a phone app squeezed onto a big screen.

## 2. Design pillars

1. **Glanceable from 6 feet.** Huge type for time, today, and next-up. Detail is one tap away, never in the way.
2. **The calendar is the spine.** Every other panel is secondary and can be turned off.
3. **Private by default.** The page is on the public internet, but nothing personal is published there. Family data goes straight from Google to the fridge, and only with a key that ships inside an encrypted config. The page shows nothing until it's unlocked.
4. **Never lies about freshness.** If data is stale or a feed failed, the page says so plainly instead of quietly showing old info.
5. **Works on an old browser.** The fridge browser is years behind. Plain, sturdy front-end code, compiled down, and tested on the actual fridge.

### Look: paper planner (decided Nov 5, 2026)

Zuk picked look **A · Paper planner** from three skeuomorphic options (`design/`, and the design
canvas linked in `PROGRESS.md`):

- A cream, lightly grained planner page with a ring binding across the top and faint blue rules.
- Ink handwriting: **Caveat** for display (clock, date, headings) and **Patrick Hand** for events.
  Each calendar writes in its own ink (blue, green, purple); the Steelers write in black on gold.
- Past events are **crossed out** in pen and fade. What's next gets a **yellow highlighter** swipe.
- **Next Up** is a tilted yellow sticky note with a strip of tape; the countdown is in red pen.
- **Game day** is a strip of gold washi tape with black hazard ends across the page.
- The jacket call is circled in red pen. Holiday countdowns are a kraft-paper tag.
- The week is a hand-ruled 7-day grid; a trip is a dashed pencil arrow with a little plane across
  the days ("Dad's away · back Thu night").
- "We're out" is a torn notepad sheet with a red-pen "+" button.
- **Night mode goes dark** (the frame used to say dark by default; paper by day and dark at night
  replaces that). Paper colors are cream, never pure white, to keep the glow down.
- Real build notes: self-host the two fonts as woff2 with `font-display: swap`; use a small
  pre-rendered grain PNG instead of the mockups' live SVG noise filter.

## 3. Architecture ($0: Google + GitHub)

**Decided Nov 5, 2026:** calendar and weather come live from one Google Apps Script, the same one
that runs the kitchen list (§8). This replaced the first plan (secret iCal links fetched by a
15-minute GitHub Actions job, parsed by our own code, encrypted, and published).

```
 Google Calendar ─┐
 Open-Meteo ──────┼──►  Apps Script web app, bound to the "Fridgeboard" Google Sheet
 Kitchen list ────┘      board  → calendar + weather + list summary (cached 2 min)
   (Sheet tabs)          state / need / undo / gotit → kitchen list
                                     ▲  HTTPS, every call needs the long key
                                     │
 GitHub Pages (public, static) ──►  Fridge browser
   index.html + JS                   1. Unlock once with the passphrase: decrypts
   config.enc.json                      config.enc.json (script URL + key), keeps the derived key
   (encrypted script URL + key)      2. Polls board every 5 min, the list every 45 s / 2 min

 GitHub Actions, on push to main or by hand: build → encrypt config → test → deploy. No schedule.
```

### Why it's built this way

- **Google does the hard calendar work.** CalendarApp hands back repeating events already
  expanded, with exceptions, moved instances, and time zones handled. That was the riskiest code
  in the first plan.
- **Live, not lagged.** No 15–30 minute cron delay, and no scheduled workflow to auto-disable
  after 60 days of repo inactivity.
- **One setup for Zuk.** One Sheet, one pasted script, one deploy. It covers calendar, weather,
  and the kitchen list. No secret iCal links to copy.
- **GitHub Pages still hosts the page.** Free Pages needs a public repo, and even private-repo Pages
  sites are publicly reachable, so the repo holds code only.
- **Privacy:** nothing personal is published. Calendar data goes Google → fridge over HTTPS and
  needs the key. The only published secret is `config.enc.json`: the script URL and key,
  encrypted with AES-256-GCM under a passphrase (PBKDF2-SHA256). The Action builds it from GitHub
  Secrets. The fridge stores the derived key (never the passphrase) after the first unlock.
- **The salt is fixed per site** (`shared/crypto.ts`), and the IV is random on every publish.
  With a new salt each publish, the stored key would stop working and the fridge would ask for
  the passphrase after every deploy.

### Known limits (design around them)

| Limit | Impact | Handling |
|---|---|---|
| Apps Script web apps can take 1–3 s to wake | Slow first poll | Board cached 2 min in CacheService. The fridge keeps showing the last good data. |
| Apps Script daily quotas (consumer accounts) | Heavy polling could run into them | About 300 board calls and 1,500 list calls a day; weather cached 20 min. |
| Script edits need a new deployment version | New code doesn't go live | Deploy → Manage deployments → Edit → Version: New version (keeps the same URL). |
| Script runs as Zuk, with access "Anyone" | Anyone with URL + key can read the board | The key is 64 random hex chars, ships only encrypted, and can be rotated (`rotateKey()`). |
| Pages has no write storage | — | All writes go to the script. |

## 4. Configuration

Personal settings live in **Zuk's Google Sheet**, so they can be changed from a phone, with no
code change and no redeploy:

- **Calendars tab:** one row per Google calendar, filled in by `setup()`. Columns: On, Label,
  Kind (`personal`, `family`, `sports`, `holidays`, `travel`, `other`), Show (`full` or `busy`),
  Color, Calendar name, Calendar ID.
- **Settings tab:** `weatherPlace` (town or ZIP; `setup()` looks up `lat`/`lon`), `timezone`,
  `daysAhead`, `jacketBelowF`, `rainGearAbovePct`, `hideObservances`, `awayLabel`,
  `travelKeywords`, `hideKeywords`, `nightStartHour`, `nightEndHour`, `tomorrowPeekHour`,
  `staleAfterMinutes`.
- **Script Properties:** `FB_KEY`, the long random access key (`showKey()`, `rotateKey()`).

**GitHub Secrets** hold only what the fridge needs to find the script:

- `DASH_CONFIG`: `{ "endpointUrl": "https://script.google.com/macros/s/…/exec", "key": "…" }`
  (template: `config/dash-config.example.json`).
- `DASH_PASSPHRASE`: the passphrase typed once on the fridge.

## 5. The calendar (v1 core)

### 5.1 Sources
Zuk's Google calendars (checked Nov 5, 2026). The script reads each one with CalendarApp,
including subscribed public calendars, so no feed URLs are needed:

| Calendar | Kind | On at setup |
|---|---|---|
| Zuk (primary Gmail calendar) | personal | ✅ (label it "Dad" in the Calendars tab) |
| Family | family | ✅ (empty right now; its time zone is UTC, so switch it to Eastern in Google Calendar settings) |
| Pittsburgh Steelers | sports | ✅ game-day treatment (§5.5) |
| Holidays in United States | holidays | ✅ all-day chips (§5.5) |
| Tennessee Titans, Indianapolis Colts | sports | ⬜ tick to turn on |
| Sunrise and sunset | other | ⬜ weather already gives sunrise/sunset |
| Appointment | personal | ⬜ ask Zuk |
| Wife's calendar, kids' school | — | add when available: share it with Zuk's account, re-run `setup()` |

### 5.2 Processing (in the script)
- Google expands **recurring events (RRULE), exceptions (EXDATE), and moved instances
  (RECURRENCE-ID)**. Our tests cover what we do with them, not the expansion.
- Every event carries epoch ms plus local fields (`day`, `time`, `ampm`) in `America/New_York`.
  The fridge never has to do time-zone math for display.
- All-day events stay all-day with an exclusive end date. The date is read from whichever zone
  puts Google's boundary at midnight, so the UTC Family calendar can't shift a day.
- Window: today through `daysAhead` (14) days.
- Merge duplicates (the same event on two calendars → one item with two color dots).
- `busy`-only calendars publish only "Busy" blocks with no titles. `hideKeywords` drops matches.

### 5.3 Views
- **Header bar:** big clock, date, weather now plus today's high/low, a jacket call ("Jacket weather" / "T-shirt day" / "Rain gear"), and "updated X min ago".
- **Today panel (largest):** all-day items as chips on top, then a timeline of today's events. Past events fade. The current event is highlighted.
- **Next Up card:** the next event with a live countdown ("Soccer practice in 1h 20m"), hidden when nothing is left today.
- **This Week strip:** 7 day-columns with event counts and the first 2–3 titles in each. Tap a day to open a full-screen agenda for that day.
- **Tomorrow peek:** after 6 pm, Today shrinks and Tomorrow grows, since that's what the evening kitchen cares about.

### 5.4 Travel awareness ("Dad's away")
- Detection is configurable in the Sheet:
  - **Option A (recommended):** a Google calendar named "Travel" (Kind `travel`) where trips are
    blocked as all-day events. Simple and reliable.
  - **Option B:** `travelKeywords` (default "flight, hotel") on personal calendars. Gmail's
    flight and hotel events join up into one trip when they're less than 18 hours apart.
- Output: `away: [{ start, end, firstDay, lastDay, backTime, label }]`. The board shows a banner
  on affected days ("Dad's away Tue–Thu, back Thursday night") and a pencil arrow with a plane
  across those days in the week strip.
- **Never display work details.** Travel events are reduced to dates inside the script; their
  titles, places, and notes never leave the Sheet's Google account. A test checks the board JSON
  for leaks.

### 5.5 Calendar kinds: game day and holidays
Each calendar in config gets a `kind` that changes how it renders:

- **`personal` / `family`:** normal events.
- **`sports`:** game-day treatment.
  - On game day, show a header banner: "Steelers @ Bengals · tonight 8:20". Before kickoff it counts down; during the 3-hour game window it reads "Game on".
  - In the week strip, show a small team-colored marker (black and gold for Steelers) with the kickoff time. **Text and colors only, no team logos.**
  - Late kickoffs (after 8 pm) get a "late game" tag, since that's a school-night consideration.
  - The feed marks games as "free" time. Never count them as busy or as conflicts.
- **`holidays`:** all-day chips at the top of Today and the week strip.
  - A `hideObservances` option (default **true**) drops observance-only entries like "Black Friday" and keeps public holidays. Google labels these in the event description ("Public holiday" vs "Observance").
  - Upcoming major holidays (Thanksgiving, Christmas) can show a "12 days to Thanksgiving" countdown chip.
- **Collisions are features:** Broncos @ Steelers on Fri Nov 27, the day after Thanksgiving, should read as one fun day, not a cluttered one.

Reference data at time of writing (for fixtures, not hardcoding): Steelers @ Bengals Sun Nov 15 8:20 pm, Steelers @ Eagles Sun Nov 22 4:25 pm, Broncos @ Steelers Fri Nov 27 3:00 pm; Veterans Day Nov 11, Thanksgiving Nov 26.

## 6. Other v1 panels
- **Weather visual:** Open-Meteo (no API key), fetched by the script (cached 20 min) and included in the board.
  - Current temp with a large condition icon (inline SVG icons, no icon font, so it renders on the old browser).
  - **Next 12 hours strip:** temperature line plus rain-chance bars, drawn as inline SVG.
  - 3-day outlook: icon, high/low, rain %.
  - Morning call: "Jacket weather" / "Rain gear" / "T-shirt day", from simple config thresholds.
  - Sunrise and sunset times in small text.
- **Clock:** ticks client-side. The countdown and "past event" fading update every minute without refetching.

## 7. Fridge behavior
- **Auto-refresh:** poll the script's `board` every 5 minutes (cache-busted). Re-render only when it changes. The clock and countdowns tick locally every minute.
- **Night mode:** go dark, with a minimal clock plus tomorrow's first event, between `nightStartHour` and `nightEndHour` (default 10 pm–6 am). Tap wakes it for 60 seconds.
- **Offline / failure:** keep showing the last good data with a clear "Offline — last updated 7:40 am" badge.
- **Stale data:** if the board's `generatedAt` is older than `staleAfterMinutes` (2 hours), show an amber banner.
- **Lock:** an unlock screen with a passphrase field. A "Forget this device" option sits in a hidden settings corner (long-press the clock).
- **Touch:** tap targets at least 64 px, no hover-only info, no tiny scrollbars, and no pinch-zoom dependency.
- **Burn-in care:** shift the layout a few pixels every hour, and avoid static bright blocks at night.

## 8. Kitchen list — "We're out" board (v1.5)

The first write feature. Use the last of something → tap its button on the fridge → it's on the shopping list, live, on everyone's phone.

### 8.1 How it works for the family
- **Item buttons:** a grid of big tiles for things the house always buys, grouped by tab: Dairy · Produce · Meat · Pantry · Snacks · Drinks · Frozen · Household. Each tile shows a name and an optional emoji.
- **Tap = "we're out."** The tile flips to a "needed" state (filled color + check) and the item joins the **Need list**. Tapping an already-needed tile does nothing harmful; no duplicates.
- **Undo:** a 5-second "Added milk · Undo" toast after every tap, for kids and elbows.
- **"+" button:** an on-screen keyboard to add a one-off item ("birthday candles").
- **Need list panel:** a compact list on the main dashboard showing count and newest items ("Need: milk, eggs, +4"). Tap to open the full board.
- **At the store:** open the same Google Sheet on a phone, tick the "Got it" checkbox. The fridge clears those items on its next sync (within about 1 minute).
- **Managing buttons:** add, rename, reorder, or retire tiles by editing the `Items` tab of the Sheet. No code changes, no redeploy.

### 8.2 Storage: Google Sheet + Apps Script (decision made)
GitHub Pages can't store writes, so the list lives in a Google Sheet in Zuk's Drive, fronted by a small **Apps Script web app** bound to that Sheet.

- **Why this over Cloudflare:** free, stays in Google, and the phone experience comes free through the Sheets app. Zuk and his wife can both use it with no new app.
- **Sheet tabs:**
  - `Items`: `id, name, category, emoji, sortOrder, active`
  - `Needed`: `itemId, name, addedAt, source ("fridge" | "phone"), gotIt (checkbox), gotAt`
  - `Log` (optional): append-only history of taps. It enables "you buy milk every 5 days" later.
- **Endpoints (Apps Script `doGet`/`doPost`):**
  - `GET ?action=state&k=<key>` → `{ items, needed, serverTime }`
  - `POST {action:"need", itemId | name, k}` → add (idempotent; no duplicates of an open item)
  - `POST {action:"undo", itemId, k}` → remove an open entry added in the last 30 seconds
  - `POST {action:"gotit", itemId, k}` → mark bought (for clearing from the fridge too)
- **Access key:** the web app is deployed with access "Anyone" (no Google sign-in on the fridge), and every call requires a long random key `k`. The key and the web-app URL are part of `DASH_CONFIG` and **ship inside the encrypted config** (`config.enc.json`), never in public code. Rotating the key = `rotateKey()` in the script + update the GitHub Secret.
- **Same script as the calendar (§3).** `board` serves calendar + weather + a list summary; the endpoints below serve the list.
- **Old-browser note:** Apps Script web apps redirect, and some POSTs trip CORS preflight. Use `Content-Type: text/plain` POST bodies (JSON inside) to avoid preflight, follow redirects, and test on the fridge in the M0 probe. Fallback: JSONP-style GET for writes.

### 8.3 Sync and offline
- The fridge polls `state` every 45 seconds while the board is open, and every 2 minutes otherwise.
- Taps apply instantly on screen (optimistic), then queue to the endpoint. If offline, keep a local queue in localStorage, retry with backoff, and show a small "Syncing…" badge.
- On conflict (bought on phone while someone taps on the fridge), the server wins and the next poll corrects the screen.

### 8.4 Starter buttons (Zuk edits in the Sheet)
Dairy: milk, eggs, butter, cheese, yogurt · Produce: bananas, apples, berries, lettuce, onions · Pantry: bread, cereal, peanut butter, pasta, rice · Snacks: kids' snacks, chips, granola bars · Drinks: juice, coffee, water · Frozen: waffles, chicken nuggets, ice cream · Household: paper towels, toilet paper, dish soap, trash bags.

### 8.5 Later on this module
- "Usually runs out about now" nudges from the `Log` tab
- Send the list to Gmail or a text with one tap ("Heading to the store")
- Barcode or photo add from a phone (out of scope for the fridge)

## 9. Optional modules

Every panel beyond calendar + weather is a **module** with an on/off switch in `DASH_CONFIG.modules`. The layout reflows when modules are off. Build v1 with the module system in place, even though only calendar and weather ship.

| Module | Source | Needs writes? | Phase |
|---|---|---|---|
| Calendar | Google Calendar via the script | No | v1 |
| Weather | Open-Meteo | No | v1 |
| Steelers game day | sports calendar | No | v1 (part of calendar) |
| Countdowns (birthdays, holidays, trips) | calendars + config list | No | v1.1 |
| Trash/recycling night | config rule (e.g., "Tuesday night") | No | v1.1 |
| Packages arriving today | Gmail delivery emails, via a scheduled Claude task | No | v3 |
| Heads-up strip (email triage, family items only) | scheduled Claude task | No | v3 |
| Fantasy matchup on Sundays | Zuk's fantasy data project | No | v3 |
| Kitchen list ("We're out" board) | Google Sheet + Apps Script (§8) | Yes | v1.5 |
| Dinner plan | same Sheet, new tab | Yes | v2 |
| Kids' chore board | same Sheet, new tab | Yes | v2 |
| Photo frame when idle | Google Photos album or Drive folder | No | later |

v3 modules get their data from a separate job (for example a scheduled Claude task) that writes into an `Extras` tab of the same Sheet; the script adds it to the board, so the dashboard code doesn't care where the data came from.

## 10. Roadmap after v1

- **v1.5 — Kitchen list:** the "We're out" board (§8). It establishes the Sheet + Apps Script write path.
- **v2 — More family write features:** dinner plan and kids' chore board, reusing the same Sheet and endpoint pattern.
- **v2 — Tap-to-add events** via Google Calendar API sign-in (needs the fridge browser to handle Google sign-in; test first).
- **v3 — AI heads-up strip:** a scheduled Claude task runs the morning email triage and publishes 3–5 "notice this" items (permission slip due, picture day, renewal coming) into the payload. Family-relevant items only; nothing from work.
- **Later:** photo frame mode when idle, countdown to big events (birthdays, trips, holidays), a "who's driving" pickup board.

## 11. Tech stack

- **Front end:** Vite + TypeScript, **no framework**. `@vitejs/plugin-legacy` to compile for old Chromium. Plain CSS with variables; grid with flex fallbacks.
- **Google side:** Apps Script (V8) in `apps-script/Code.gs`: CalendarApp, UrlFetchApp (Open-Meteo), SpreadsheetApp, CacheService, LockService. Tested in Node by running the real file against fake Google services (`test/gas-harness.ts`).
- **Build:** Node 22. `scripts/encrypt-config.ts` and `scripts/decrypt-check.ts` use `shared/crypto.ts`, the same WebCrypto code the browser runs.
- **Tests:** Vitest.
- **Deploy:** `actions/upload-pages-artifact` + `actions/deploy-pages`, on push to main or by hand.

## 12. Repo layout

```
fridgeboard/
  .github/workflows/deploy.yml   # push/manual → build, encrypt config, test, deploy
  apps-script/Code.gs            # the Google side: calendar, weather, kitchen list (no keys)
  shared/payload.ts              # board + kitchen types (the contract)
  shared/crypto.ts               # AES-GCM + PBKDF2, used by the build and the browser
  scripts/encrypt-config.ts      # DASH_CONFIG + DASH_PASSPHRASE → dist/config.enc.json
  scripts/decrypt-check.ts       # round-trips the published config
  src/                           # the dashboard
  public/probe/index.html        # M0 fridge browser probe (hand-written ES5, copied as-is)
  test/                          # Vitest: script harness, crypto, dist guard
  design/                        # the three looks; A is the one we build
  config/dash-config.example.json
  DASHBOARD_FRAME.md  CLAUDE.md  IDEAS.md  PROGRESS.md
```

## 13. Milestones

**M0 — Fridge probe + skeleton**
- `public/probe/` reports: user agent, viewport, devicePixelRatio, orientation, touch, WebCrypto (AES-GCM round trip, PBKDF2 150k timing, key export), fetch, localStorage, CSS grid, flex gap, CSS effects the paper look uses, ES levels, Intl time-zone formatting with both DST checks, the look's fonts, a text/plain POST, and a redirect-following fetch (`?ep=<script URL>` aims those at the real script).
- Actions workflow deploys the probe to Pages.
- **Done when:** Zuk opens the probe on the fridge and reports the results. Those numbers set the target screen size and the build target.

**M1 — Google script + encrypted config**
- `apps-script/Code.gs`: `setup()` (tabs, calendar list, starter buttons, key), `board` (calendar + weather + list summary), kitchen endpoints, `onEdit` for phone "Got it".
- Tests (fake Google services) for: all-day single and multi-day events, cross-midnight, both DST changes, the UTC Family calendar, duplicates across calendars, observance hiding, sports never-busy and late games, busy-only, hidden words, travel stripping, weather shaping and the wear call, idempotent need, the undo window, got-it clearing, keys, JSONP fallback.
- `encrypt-config` + `decrypt-check`; workflow encrypts on deploy.
- **Done when:** Zuk's script returns his real board, and the deployed `config.enc.json` passes `decrypt-check`.

**M2 — Dashboard v1 (paper planner)**
- Unlock screen, header, Today, Next Up, This Week, day agenda, Tomorrow peek, Dad's-away banner, game-day tape, holiday chips, weather.
- Auto-refresh, night mode, stale/offline states.
- **Done when:** it looks right in screenshots at the fridge's resolution and works on the real fridge.

**M2.5 — Kitchen list board (v1.5)**
- The board UI, Need-list panel, undo toast, offline queue, sync badge. (The script side ships in M1.)
- **Done when:** a tap on the fridge shows up in the Sheet on Zuk's phone within seconds, and a "Got it" on the phone clears the fridge within about a minute.

**M3 — Hardening**
- Error states for each source, and a performance check on the fridge (unlock + first render under 2 seconds).
- README for "how to add a calendar" and "how to update the script".
