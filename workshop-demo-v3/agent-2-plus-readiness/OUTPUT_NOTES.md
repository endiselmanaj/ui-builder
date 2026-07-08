# OUTPUT_NOTES — Agent 2 (Tier 2: Briefing + Stories + Readiness Review)

## What was built

A single-file HTML/CSS/JS prototype implementing the VW online trade-in value request flow. No build step, no dependencies — open `index.html` in a browser.

### Implemented flow (5 steps)

1. **License plate lookup** (TX-1.1) — enter a Dutch plate, mock API returns vehicle data (make, model, type, engine, year, fuel, transmission, color, original price). Invalid format blocked before lookup. "Not found" triggers a manual make/model/year fallback (per readiness review decision #10/#12).
2. **Mileage entry** (TX-1.2) — numeric only, plausibility bounds 0–999,999 km.
3. **Path choice** (TX-1.3) — "Online inruilvoorstel" (photos) or "Taxatie bij uw dealer" (appointment).
4. **Online path: Photo upload** (TX-2.1 / TX-4.1) — 8 labeled photo slots with angle hints. Min 1 required (per readiness review decision #6). Accepts JPEG/PNG/HEIC, 10 MB cap (per readiness implied default #16). Photos stored in-memory only.
5. **Dealer path: Dealer search + appointment** (TX-3.1 / TX-3.2) — search by name/place (mock iDNAW data, sorted nearest-first per readiness decision #8). Select dealer, pick preferred date + time window(s) as a request — dealer confirms out-of-band (per readiness decision #7, no live calendar).
6. **Contact details + consent** — name, email, phone, postcode, optional message (per readiness decision #9). Explicit unticked consent checkbox with privacy-policy link (per readiness decision #10). Consent gates submission (TX-4.3 requirement).
7. **Confirmation** — summary of everything submitted, clear message that the dealer will follow up.

### Stories coverage

| Story | Status | What was built |
|-------|--------|---------------|
| TX-1.1 | READY | Plate lookup with mock API, format validation, not-found handling, manual fallback |
| TX-1.2 | READY | Mileage entry with numeric validation and plausibility bounds |
| TX-1.3 | READY | Two-path choice (online / dealer) |
| TX-2.1 | NEEDS INFO | Photo upload with 8 labeled slots, min 1 (readiness review resolved the "which 8 views" question with angle hints) |
| TX-2.2 | LATER | Not built (out of MVP, "continue on another device") |
| TX-2.3 | LATER | Not built (email confirmation of link handoff) |
| TX-2.4 | BLOCKED | Submission UI built with consent gate; a notice explains TX-4.3 must be resolved before go-live |
| TX-3.1 | LATER | Built anyway — dealer search with mock data, nearest-first sort |
| TX-3.2 | NEEDS INFO | Built with preferred date + time windows as a request (readiness review resolved: no live calendar) |
| TX-3.3 | LATER | Partially built — contact details + confirmation, but no real booking |
| TX-4.1 | READY | Photos displayed in-memory (no real storage) |
| TX-4.2 | READY | Not applicable in a front-end prototype (6-month auto-delete is a backend concern) |
| TX-4.3 | BLOCKED | Consent checkbox + privacy link built as UI gate; yellow notice explains the legal/DPIA dependency |

## Handling of BLOCKED / NEEDS INFO / LATER stories

- **BLOCKED (TX-2.4, TX-4.3):** Built the UI including the consent checkbox as a hard gate on submission, per the readiness review's decision (#10). Added a visible notice explaining this is simulated and that personal data storage must not go live until the lawful basis and DPIA are resolved. The prototype does not actually persist any data — everything is in-memory.
- **NEEDS INFO (TX-2.1):** The readiness review resolved the "which 8 views" question: 8 labeled slots with angle hints, minimum 1 photo required, no angle validation. I used this to build the photo UI.
- **NEEDS INFO (TX-3.2):** The readiness review resolved this: appointment is a preferred date + time window request, dealer confirms out-of-band. No live availability source needed.
- **LATER (TX-2.2, TX-2.3, TX-3.1, TX-3.3):** TX-3.1 (dealer search) and parts of TX-3.3 were built because they are needed for the dealer path to be usable. TX-2.2 and TX-2.3 (device handoff) were not built as they require backend infrastructure.

## Where I had to GUESS or INVENT

1. **Mock vehicle data:** Invented 5 mock vehicles with Dutch-format plates (AB-123-CD etc.) since no real API exists. Included one non-VW brand (Audi) to test the "all makes eligible" rule from readiness decision #10.
2. **Mock dealer data:** Invented 5 dealers with realistic Dutch names, addresses, and distances.
3. **Photo slot labels:** Invented 8 specific labels (Voorkant, Achterkant, Linkerzijde, Rechterzijde, Dashboard, Interieur achter, Kofferbak, Velgen/banden) — the readiness review says "angle hints" but doesn't name the exact 8.
4. **Time windows:** Invented 3 time slots (Ochtend 9-12, Middag 12-15, Laat 15-17) — the materials say "time-window(s)" but don't specify which windows.
5. **Plate format:** Used XX-999-XX (sidecode 9) as the hint format, but the validation accepts any 6-character alphanumeric string. Real NL plate validation is more complex.
6. **Follow-up SLA:** The readiness review identifies this as the "sharpest remaining gap" (#21) — no follow-up time promise exists. The confirmation says "de dealer neemt contact met u op" without a specific timeframe, deliberately leaving this unresolved since no number was decided.
7. **Lead routing (#24):** The readiness review flags that where a lead lands is undecided. This prototype stores nothing — it's purely client-side. The confirmation screen is the end of the flow.
8. **Auto-format for plate input:** Invented a simple auto-dash formatter for better UX.
9. **Dutch language:** Used Dutch for all UI text since it's VW.nl. The materials mix Dutch and English; I defaulted to Dutch for the customer-facing tool.

## What the readiness review added

The readiness review resolved several ambiguities that would have been guesswork without it:
- Photo minimum: 1 (not 8) — the briefing says "8 photos" but readiness clarified minimum 1, 8 encouraged
- No angle validation — just hints
- Dealer appointment is a request, not a booking — no live calendar needed
- Manual fallback on plate lookup miss — never lose a lead
- Consent: explicit unticked checkbox + privacy link (not just implied)
- File limits: JPEG/PNG/HEIC, ~10 MB cap
- Anonymous flow, no auth required

## Input materials used

- **Briefing.pdf** — business context, objectives, system landscape
- **Stories_Epics_1-4.md** — detailed stories with acceptance criteria and status flags
- **readiness-review-trade-in.md** — resolved ambiguities, locked decisions, identified remaining gaps
