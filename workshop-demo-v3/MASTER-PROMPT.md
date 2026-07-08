# Master prompt: 3-subagent context-tiering demo

Self-contained. Paste the block in "The prompt to run" into a **fresh**
Claude Code session — it assumes no memory of any prior conversation.
No Figma MCP is used anywhere in this version — it's not available, so
this doesn't reference it, detect it, or fall back to it live.

## What this demonstrates

Three subagents build the SAME app from the SAME instruction, with
progressively richer context. Opening all three side by side shows what
more context actually buys — and that the payoff is in *judgment*
(what gets flagged as still-undecided, what compliance gates get
respected) more than in scope or visual polish.

## Required input files (check these exist before running)

- `/Users/endi/Downloads/PON/Briefing.pdf` — business briefing
- `/Users/endi/Downloads/Stories_Epics_1-4.md` — groomed backlog with
  READY/NEEDS INFO/LATER/BLOCKED story statuses and acceptance criteria
- `/Users/endi/Downloads/PON/readiness-review-trade-in.md` — build-readiness
  review with locked scope decisions
- `/Users/endi/Downloads/PON/workshop-demo-v3/DESIGN-SYSTEM.md` — a
  design system already extracted (by hand, ahead of time) from a prior
  prototype that genuinely pulled real Figma design context via MCP
  before that access became unavailable. It documents real VW colors,
  typography, spacing, and component patterns with exact values — this
  is Agent 3's unique material, standing in for live Figma access.

## The three tiers

- **Agent 1:** Briefing.pdf + Stories_Epics_1-4.md
- **Agent 2:** Agent 1's materials + readiness-review-trade-in.md
- **Agent 3:** Agent 2's materials + DESIGN-SYSTEM.md — apply its
  documented colors/typography/spacing/components faithfully; it's
  already a real extraction, don't re-guess values it already specifies.

---

## The task text (identical for all three agents in a run)

```
You are building a throwaway front-end prototype for a live workshop demo.
This is a test run — build something real, don't ask clarifying questions,
just make reasonable calls and move forward.

TASK (identical across all variants in this workshop set — do not skip
this): Build a working, clickable, front-end-only web app (no backend, no
server, no real network calls — use mock/local data and in-memory state
only) that implements the flow described in the attached materials for a
Volkswagen online car trade-in value request tool. Read ALL attached
materials fully before writing any code — if a listed input file appears
missing or unreadable, try reading it exactly once more before concluding
it doesn't exist; if you still can't use it, flag that clearly as a
WARNING in OUTPUT_NOTES.md (not a footnote) since the fairness of this
comparison depends on every tier actually getting what it was promised.
Use plain HTML/CSS/JS or a minimal React+Vite app — whichever gets you to
something runnable fastest with zero backend and zero external API keys.
Implement as much of the real flow as you reasonably can in one focused
session; prioritize matching what's actually specified in your materials
over visual polish. Where the materials don't specify something you need,
make a reasonable assumption and keep moving — don't stop to ask.

The stories doc contains binding constraints, including an explicit rule
that submission/storage of personal data must not ship until story TX-4.3
(consent) is resolved, and marks certain stories BLOCKED/NEEDS
INFO/LATER. Use your own judgment on how to handle these — there's no
single correct answer, just be deliberate and explain your call in
OUTPUT_NOTES.md.

When done: (1) make sure the app runs with a single simple command and
state that command in your final message; (2) write OUTPUT_NOTES.md in
your output directory describing what you built, and every place you had
to GUESS or INVENT behavior because the materials didn't specify it; (3)
add a small, unobtrusive banner visible on every screen of the app itself
(fixed footer or top strip, low visual weight, not blocking content)
stating exactly which input materials were used to build this generation
— e.g. "Demo build — inputs: Briefing.pdf + Stories.md". This must be
factually exact to what you actually read; don't list a source you didn't
successfully use.
```

Agent 3 additionally gets this appended to its task text: *"You also have
DESIGN-SYSTEM.md — a real design-system extraction with exact colors,
typography, spacing, and component patterns. Apply it faithfully to your
build; it replaces the need to guess VW brand styling."*

---

## The prompt to run (paste this whole block into a fresh Claude Code session)

```
Read /Users/endi/Downloads/PON/workshop-demo-v3/MASTER-PROMPT.md in full
first — it has the exact materials list per agent and the exact task text
to give all three agents. Follow it exactly, don't improvise a different
tiering.

Create three output directories:
/Users/endi/Downloads/PON/workshop-demo-v3/agent-1-briefing-stories
/Users/endi/Downloads/PON/workshop-demo-v3/agent-2-plus-readiness
/Users/endi/Downloads/PON/workshop-demo-v3/agent-3-plus-design

Then launch three subagents in parallel (single message, three Agent tool
calls, subagent_type "general-purpose" so they have Bash/Write access),
each given the task text from MASTER-PROMPT.md verbatim plus their tier's
specific materials list and output directory as described above. Run them
in background and tell me when all three are done.
```

---

## Presenter checklist once all three finish

- [ ] Every app's banner shows the correct, honest input list
- [ ] Each `OUTPUT_NOTES.md` guess table compared side by side
- [ ] Agent 1 vs Agent 2: does Agent 2 explicitly cite readiness-doc
      decisions instead of re-inventing rules from nothing?
- [ ] Does anyone confidently state a follow-up-SLA number that nobody
      actually decided? (Readiness review flags this as still open —
      inventing one anyway is the "confident but wrong" tell.)
- [ ] BLOCKED story TX-4.3 (consent): does the app build the flow
      *behind* a working, blocking consent checkbox with a visible
      warning it can't go live — or does it silently skip the gate, or
      silently skip the whole submit flow? All three are defensible
      readings; what matters is that the agent made a deliberate,
      visible choice, not an invisible one.
- [ ] Agent 3: does its styling actually match DESIGN-SYSTEM.md's real
      values (navy `#001e50`, plate yellow `#f7ca45`, pill buttons,
      50px/8px-radius inputs, etc.) rather than a generic blue guess?
      That fidelity is the whole point of this tier.
