# Context Lab — workshop day checklist

Run through this ~30 min before presenting.

0. **CLI flag sanity**: `claude --help | grep -- --chrome` returns a line. If a
   CLI update dropped/renamed the flag, the Figma tier won't browse — stop and fix.
1. **Model check**: the demo runs on whatever the app's Settings say. Default is
   **opus** (`DEFAULT_SETTINGS.model`), which is slower/pricier. Decide before the
   room: opus for max quality, or switch to **sonnet** (gear icon) for a snappier
   run. All three tiers use the same model — that's the point.
2. **Chrome**: open Chrome, confirm the Claude extension is installed and
   connected (extension icon → connected state). Log into Figma.
3. **Figma renders, not a login wall**: open BOTH prototype URLs manually in that
   Chrome and confirm you see the *design*, not a "request access"/login page.
   Expired Figma sessions are the #1 silent demo-killer.
4. **Extension site permissions**: allow `figma.com` (and `www.figma.com`)
   so browser actions never block on approval.
5. **Start the app**: `./start.sh`, open http://localhost:5173/context-lab.
6. **Seeds**: the Context library should show 3 sources and the three tiers
   should show 1 / 2 / 3 chips. If empty: check `data/context-seeds/`.
7. **Briefing richness (one-time)**: confirm `briefing.pdf` is prose/requirements
   with NO UI mockups or screenshots. If it contains the finished design, tier 1
   already looks great and the "preparation matters" contrast collapses.
8. **Test Chrome**: click "Test Chrome" — must show "✓ Chrome connected". It now
   navigates the real Figma URL and screenshots it, so a green result means the
   design actually rendered. If red with a login-wall message, fix step 3.
9. **Warm-up run**: fire one full generation end to end. On opus expect the Figma
   tier to be the slow path (navigate 2 URLs, click through screens, up to ~20
   screenshots, then build) — budget **~6–12 min**, less on sonnet. This warms
   caches and validates auth. Delete the run after.
10. **During the demo**: one generation at a time — the button locks while a run
    is active (the Figma tier owns the shared browser). Don't touch Chrome while
    tier 3 is browsing.
11. **Recovery**: if tier 3 fails on browser access, it degrades to ~tier-2 output
    and still finishes; tiers 1–2 are never affected by Chrome problems. Hit Test
    Chrome, fix, and re-run.
