# Context Lab — workshop day checklist

Run through this ~15 min before presenting.

1. **Model check**: the demo runs on whatever the app's Settings say. Default is
   **opus** (`DEFAULT_SETTINGS.model`), which is slower/pricier. Decide before the
   room: opus for max quality, or switch to **sonnet** (gear icon) for a snappier
   run. Both tiers use the same model — that's the point.
2. **Start the app**: `./start.sh`, open http://localhost:5173/context-lab.
3. **Seeds**: the Context library should show 2 sources and the two tiers
   should show 1 / 2 chips. If empty: check `data/context-seeds/`.
4. **Briefing richness (one-time)**: confirm `briefing.pdf` is prose/requirements
   with NO UI mockups or screenshots. If it contains the finished design, tier 1
   already looks great and the "preparation matters" contrast collapses.
5. **Warm-up run**: fire one full generation end to end. This warms caches and
   validates auth. Delete the run after.
6. **During the demo**: one generation at a time — the button locks while a run
   is active. Focus a column to expand its preview and pick the result you prefer.
