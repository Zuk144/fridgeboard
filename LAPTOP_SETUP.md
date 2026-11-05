# Laptop setup prompt

Paste everything in the box into Claude on the laptop. It needs a session that can drive Chrome:
the Claude desktop app with Claude in Chrome, or Claude Code with the Chrome extension.

```
You're helping me set up FRIDGEBOARD, my family fridge dashboard, using Chrome on this laptop.
Do the clicking. Stop and ask me whenever a step needs my sign-in, a permission approval, or
something only I know. Never type my web app URL, key, or passphrase into this chat: copy them
straight from one page to the other.

PART 1: GITHUB PAGES (the repo already exists: github.com/Zuk144/fridgeboard)
1-2. Done on Nov 5 (repo created; the Claude app already covers all repositories).
3. In the fridgeboard repo: Settings → Pages → Build and deployment → Source: GitHub Actions.
   Then open the Actions tab; if the latest "Deploy to Pages" run failed, click it and
   "Re-run all jobs".

PART 2: GOOGLE SHEET AND SCRIPT
4. Open https://sheets.new (signed in to my Google account). Rename the spreadsheet Fridgeboard.
5. Extensions → Apps Script. In the new tab, rename the project Fridgeboard.
6. In another tab, open
   https://raw.githubusercontent.com/Zuk144/fridgeboard/main/apps-script/Code.gs
   Select all and copy. In the script editor, select everything in Code.gs, paste over it, and
   save (Cmd+S or Ctrl+S).
7. Pick "setup" in the function dropdown and click Run. When Google asks for permission, let me
   approve it (Review permissions → my account → Advanced → Go to Fridgeboard (unsafe) → Allow).
   Wait for "Execution completed".
8. Back in the Sheet:
   - Settings tab: ask me for my town or ZIP and type it in the value cell next to weatherPlace.
   - Calendars tab: change the label "Me" to "Dad". Show me which calendars are ticked and let
     me change them.
9. In the script editor, run setup again (it looks up the town's coordinates).
10. Deploy → New deployment → gear icon → Web app. Description: fridge. Execute as: Me.
    Who has access: Anyone. Click Deploy (I'll approve again if asked). Copy the Web app URL
    (it ends in /exec).
11. Pick "showKey" and click Run. The execution log shows "Fridge key: ..." (64 characters).

PART 3: GITHUB SECRETS
12. In the fridgeboard repo: Settings → Secrets and variables → Actions → New repository secret.
    Name: DASH_CONFIG
    Secret: {"endpointUrl": "<the Web app URL>", "key": "<the 64-character key>"}
13. New repository secret. Name: DASH_PASSPHRASE. Let me type the value myself (a few made-up
    words I'll type once on the fridge).
14. Check: in a new tab, open the Web app URL with ?action=board&k=<the key> on the end. Tell me
    whether it shows my calendar events and the weather. Don't paste what it shows here.
15. Tell me when it's all done and list anything that didn't work.
```

When it's done, go back to the cloud session and say **"Google and secrets are done"**.
