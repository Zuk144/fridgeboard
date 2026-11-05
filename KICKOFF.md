# FRIDGEBOARD — Kickoff

## 1. One-time setup (about 10 minutes)

**GitHub**
1. Create a new **public** repo (for example `fridgeboard`). Public is required for free Pages; no personal data ever goes in it.
2. Unzip this kit into the repo root and commit it (`DASHBOARD_FRAME.md`, `CLAUDE.md`, `.claude/`, `config/`, `IDEAS.md`, `.gitignore`).
3. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.

**Google (the calendar, weather, and kitchen list)**
4. Follow "Google setup" in `PROGRESS.md`: make a Sheet, paste `apps-script/Code.gs`, run `setup()`, deploy it as a web app. No secret calendar links needed (decided Nov 5, 2026; see frame §3).

**Secrets**
5. Repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `DASH_CONFIG` = `{"endpointUrl": "<web app URL>", "key": "<key from showKey()>"}` (template: `config/dash-config.example.json`)
   - `DASH_PASSPHRASE` = a passphrase you'll type once on the fridge

## 2. Prompt for Claude Code

Open Claude Code in the repo folder and paste the prompt from **`CLAUDE_CODE_PROMPT.md`**. It builds straight through M0 → M2.5 (probe, calendar pipeline, dashboard, kitchen list). It only pauses to hand you click-by-click steps for the parts only you can do (fridge probe, secrets, Google Sheet setup), and keeps building on fake data while you do them.

Progress lives in `PROGRESS.md`, so if a session runs out of room, a new one can continue with:

```
Use the dash-dev agent. Read PROGRESS.md, DASHBOARD_FRAME.md and CLAUDE.md, then continue from where PROGRESS.md says we left off.
```
