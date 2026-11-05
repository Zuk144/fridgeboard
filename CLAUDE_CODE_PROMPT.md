# FRIDGEBOARD — Build prompt for Claude Code

Paste everything in the code block into Claude Code, opened in the repo folder after the kit is committed.

```
Use the dash-dev agent for this whole session. Before writing any code, read
DASHBOARD_FRAME.md, CLAUDE.md, and .claude/agents/dash-dev.md end to end. They
are the spec and the rules. If something in this prompt conflicts with them,
the frame wins; tell me about the conflict.

GOAL FOR THIS SESSION
Build FRIDGEBOARD from an empty repo through Milestone M2.5: the fridge probe,
the calendar data pipeline, the v1 dashboard (calendar + weather + Steelers
game day + holidays), and the v1.5 "We're out" kitchen list backed by a Google
Sheet. Work straight through. Don't stop between milestones unless you hit one
of the CHECKPOINTS below that truly needs me.

HOW TO WORK
- One milestone at a time, in order: M0 → M1 → M2 → M2.5.
- Commit at the end of each milestone (and at sensible points inside one) with
  a clear message. Push to main so GitHub Actions deploys.
- Keep a PROGRESS.md at the repo root: what's done, what's next, open
  questions, and anything I need to do. Update it at every commit so a fresh
  session can pick up from it.
- Use the task list so I can see where you are.
- Make small decisions yourself and note them in PROGRESS.md. Bring me only
  real decisions, with a recommendation.
- Never print, log, or commit secrets. Real calendar URLs, my email, home
  coordinates, the passphrase, and the Sheet key go only in GitHub Secrets or
  a gitignored .env.local.

CHECKPOINTS (things only I can do; don't block on them)
When you reach one, write exact click-by-click steps for me in PROGRESS.md and
in chat, then KEEP BUILDING with fixtures and assumptions. Swap in the real
thing when I say it's done.
  C1 (after M0 deploys): I open the probe URL on the fridge and send results.
     Until then, target Chrome ~63-era features and test at 1080x1920 portrait
     and 1920x1080 landscape.
  C2 (start of M1): I add the DASH_CONFIG and DASH_PASSPHRASE secrets. Until
     then, run the pipeline on fixtures. Give me a ready-to-fill DASH_CONFIG
     template based on config/dashboard.example.json.
  C3 (start of M2.5): I create the Google Sheet, paste the Apps Script, run
     setup, deploy the web app, and add the URL and key to DASH_CONFIG. Until
     then, build the board against a local mock of the endpoint.

M0 — PROBE + SKELETON
1. Scaffold: Vite + TypeScript, no framework, @vitejs/plugin-legacy, Vitest,
   eslint, shared/payload.ts (schemaVersion 1), and npm scripts from CLAUDE.md.
2. probe/index.html: big, fridge-readable report of user agent, viewport,
   screen size, devicePixelRatio, orientation, plus pass/fail for WebCrypto
   (AES-GCM round-trip; PBKDF2 at 150k iterations with timing), fetch,
   localStorage, CSS grid, flexbox gap, async/await, Intl formatting for
   America/New_York, and a text/plain POST plus a redirect-following fetch
   (to pre-check the Apps Script approach). Include a plain-text "results"
   block that's easy to photograph.
3. .github/workflows/deploy.yml: build and deploy to Pages on push to main and
   on manual run (workflow_dispatch). The schedule stays commented out until M1.
4. A test that fails if dist/ contains payload.json or any .ics file.
5. Verify: typecheck, tests, build, and screenshots of the probe at both test
   sizes. Give me the probe URL (C1).

M1 — CALENDAR + WEATHER PIPELINE
1. scripts/build-payload.ts: read config (DASH_CONFIG env, or .env.local, or
   --fixtures), fetch every enabled calendar's iCal feed, and parse with full
   RRULE / EXDATE / RECURRENCE-ID support. Normalize to America/New_York, keep
   all-day events all-day (exclusive end dates), window today through +14
   days, merge cross-calendar duplicates, apply busy-only, apply each
   calendar's kind (personal / family / sports / holidays), hide holiday
   observances when configured, and mark sports events as never-busy.
2. Travel: build away/back ranges from the travel source. Strip titles,
   locations, and descriptions in the data job. Only { start, end, label }
   reaches the payload.
3. Weather from Open-Meteo for home lat/lon: current conditions, next 12
   hours (temp + precip probability), 3-day outlook, sunrise/sunset, and the
   jacket / rain-gear call from config thresholds.
4. scripts/encrypt.ts: AES-256-GCM, PBKDF2-SHA256 with random salt and IV,
   file format { v, salt, iv, iterations, ciphertext } in base64. Add
   decrypt-check, which round-trips using the same WebCrypto code the browser
   uses (shared module), not a separate Node-only path.
5. Public feeds: confirm the Holidays and Steelers URLs in the example config
   actually return iCal. If a sports feed won't serve publicly, tell me and
   propose the fallback.
6. Tests with fake fixtures for: recurring event with an EXDATE and a moved
   instance, single and multi-day all-day events, cross-midnight, both DST
   changes, a calendar whose own time zone is UTC, duplicates across
   calendars, observance hiding, sports never-busy, and travel stripping.
   Build the sports and holiday fixtures from the reference games and
   holidays in DASHBOARD_FRAME.md section 5.5.
7. Workflow: turn on the */15 schedule (America/New_York timezone field),
   build the payload, encrypt it, put ONLY data.enc.json in dist, and deploy.
   Add a stale-guard keepalive for the 60-day inactivity rule, and document
   how to re-enable the workflow.
8. Verify: tests pass, the Action runs green on fixtures (and on real feeds
   after C2), and decrypt-check passes against the deployed file.

M2 — DASHBOARD v1
1. Unlock screen: passphrase → derive key → store the derived key (not the
   passphrase) in localStorage → decrypt. Hidden "forget this device"
   (long-press the clock).
2. Module system per frame section 9; calendar and weather are modules.
3. Layout per frame sections 5.3, 5.5, and 6: header (clock, date, weather
   now, jacket call, "updated X min ago"), Today, Next Up countdown, This
   Week strip with tap-to-open day agenda, Tomorrow peek after 6 pm,
   Dad's-away banner, Steelers game-day banner (countdown, then "Game on",
   "late game" tag), holiday chips and countdown chip, and the weather visual
   (inline SVG 12-hour strip and 3-day outlook). Text and colors only for
   teams, no logos.
4. Fridge behavior per frame section 7: 5-minute polling with cache-bust,
   re-render on change, night mode 10 pm–6 am with tap-to-wake, offline badge,
   stale banner after 2 hours, burn-in shift, 64px+ tap targets, dark theme.
5. Pass `now` into all render code. Add a dev-only ?now=2026-11-15T19:30 URL
   override so I can preview game day, night mode, and the evening peek.
6. Verify with screenshots at both test sizes for: a normal weekday, a busy
   day, an empty day, game day before kickoff, during the game, night mode,
   the 7 pm Tomorrow peek, a travel day, Thanksgiving week, stale data, and
   offline. Look at every one and fix what's off before calling M2 done. Show
   me the best few.

M2.5 — "WE'RE OUT" KITCHEN LIST (frame section 8)
1. apps-script/Code.gs (no keys committed):
   - setup(): creates the Items, Needed, and Log tabs with headers, fills the
     starter buttons from frame section 8.4, adds the "Got it" checkbox column,
     formats it to read well in the iPhone Google Sheets app (frozen header,
     wide name column), and generates a long random key in Script Properties,
     shown to me once.
   - doGet / doPost for state, need, undo, and gotit, all requiring the key.
     Use text/plain JSON bodies to avoid CORS preflight. Idempotent "need": no
     duplicate open entries. Undo is allowed within 30 seconds.
   - A Log row for every action.
2. Step-by-step setup in PROGRESS.md for C3: create the Sheet, open
   Extensions → Apps Script, paste, run setup, Deploy → Web app (execute as
   me, access Anyone), copy the URL, add the URL and key to DASH_CONFIG.
3. The key and URL ride inside the encrypted payload. The dashboard reads them
   after unlock.
4. Board UI: category tabs, big tiles (name + emoji), tap to mark needed with
   instant feedback, a 5-second Undo toast, a "+" for one-off items with a
   big on-screen-keyboard-friendly input, and a Need-list summary panel on the
   main dashboard ("Need: milk, eggs, +4") that opens the board.
5. Sync: optimistic UI, a localStorage queue with retry and backoff, a
   "Syncing…" badge, and polling every 45 seconds when open and every 2
   minutes otherwise. Server wins on conflict.
6. A local mock endpoint for dev and tests. Tests for idempotent need, undo
   window, gotit clearing, and offline queue replay.
7. Verify: screenshots of the board, the toast, and the summary panel. After
   C3, prove it end to end: a tap shows in the Sheet within seconds, and a
   "Got it" checked in the Sheet clears on the dashboard within about a
   minute.

STRETCH (only if M2.5 is fully done)
- An iPhone Shortcut ("Hey Siri, we're out of milk") that calls the same
  Apps Script endpoint. Write the build steps for me in PROGRESS.md, since I
  have to create it in the Shortcuts app myself.
- Countdowns module and trash-night module from IDEAS.md.

WHEN YOU FINISH OR RUN LOW ON ROOM
Update PROGRESS.md, commit, push, and give me a short wrap-up: what works now,
the URLs to open, screenshots, what I need to do next, and the exact prompt to
paste into a fresh session to continue.
```
