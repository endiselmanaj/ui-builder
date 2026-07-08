# OUTPUT_NOTES — Agent 3 (+ Design System)

## What was built

A complete, single-file HTML/CSS/JS prototype of the VW online trade-in value request tool (Inruilwaarde). No framework, no build step — open `index.html` directly in a browser.

### Screens implemented

1. **License plate lookup** — NL-style plate input (EU blue strip + yellow body), mock vehicle API returning 5 demo cars, manual make/model/year fallback on miss
2. **Mileage entry** — numeric input with plausibility ceiling (500,000 km)
3. **Path choice** — two choice cards: "Online inruilvoorstel" vs "Taxatie bij uw dealer"
4. **Photo upload (online path)** — 8 labeled slots with angle hints (Voorkant, Achterkant, etc.), active preview area, real file upload via FileReader, 10 MB cap, remove button, minimum 1 photo required
5. **Dealer selection + appointment (dealer path)** — searchable dealer list (5 mock dealers), full calendar component (Monday-first, weekends disabled, past disabled, circular selection), multi-select time slots
6. **Contact details + consent** — name, email, phone, postcode, optional message, explicit unticked consent checkbox with full-sentence label, privacy policy link, blocked-notice banner about TX-4.3
7. **Confirmation** — icon+text rows showing vehicle, photos/appointment details, email, phone

### Design system applied

All values from DESIGN-SYSTEM.md were applied faithfully:
- Color tokens: navy #001e50, accent blue #00aff0, plate yellow #f7ca45, plate blue #0032ab, all text/border/bg colors
- Typography: Inter font family, exact sizes/weights/line-heights for panel-title (24/32/700), section-title (20/24/400), field-label (16/24/700), body (16/24/400), secondary (14/20-24/400), plate characters (32/700/uppercase/2px spacing)
- Spacing: panel 12px radius, 28px/16px/24px padding, 420px max-width, panel shadow
- Buttons: 44px min-height, 64px pill radius, navy primary, transparent+border secondary, blue-light upload
- Inputs: 50px height, 8px radius, 1px border, focus navy
- Components: plate with EU strip + checkmark badge, photo grid (4-col, aspect-ratio 1), choice cards (2px border, 12px radius), dealer cards (8px radius), calendar (7-col, circular days), time slots (8px radius, checkbox rows), confirmation rows (icon-left/text-right), progress bar (3px segments, 4px gap)
- Icons: inline SVG with stroke="currentColor", strokeWidth 1.5-2
- Layout: single-column, centered, #e8ecef page background

## Input materials used

| Material | Successfully read | Used |
|----------|------------------|------|
| Briefing.pdf | Yes | Yes — scope, objectives, data sources, flow structure |
| Stories_Epics_1-4.md | Yes | Yes — story-level acceptance criteria, status flags, build notes |
| readiness-review-trade-in.md | Yes | Yes — locked decisions, implied defaults, DoR |
| DESIGN-SYSTEM.md | Yes | Yes — all color tokens, typography, spacing, component patterns |

## Handling of BLOCKED / NEEDS INFO / LATER stories

| Story | Status | Decision |
|-------|--------|----------|
| TX-4.3 (consent gate) | BLOCKED | Built the consent UI (checkbox + privacy text) but added a visible yellow notice on the contact form explaining the legal basis is unresolved. Data is stored locally only (in-memory state). This follows the build note: "you can build behind it; you cannot go live without it." |
| TX-2.4 (submit online request) | BLOCKED (depends on TX-4.3) | Built submission flow end-to-end but it only stores in local JS state. The confirmation screen shows but notes it's a demo. |
| TX-2.1 (8 photo views) | NEEDS INFO (views not specified) | Invented 8 view names: Voorkant, Achterkant, Linkerzijde, Rechterzijde, Dashboard, Achterbank, Kofferbak, Motorruimte. Used readiness review decision #6 (min 1, 8 encouraged, angle hints only, no validation). |
| TX-3.2 (dealer slot availability) | NEEDS INFO (availability source undefined) | No live availability — used readiness review decision #7 (preferred date + time-window as a request, dealer confirms out-of-band). All weekday slots shown as selectable. |
| TX-2.2 (continue on another device) | LATER | Not built. |
| TX-2.3 (email confirmation of handoff) | LATER | Not built. |
| TX-3.1 (dealer search) | LATER | Built anyway since the dealer path needs it — used 5 mock dealers with search filtering, per readiness decision #8. |
| TX-3.3 (enter details + book) | LATER | Built as part of the dealer appointment flow — the contact form serves this purpose. |

## Guesses and invented behavior

1. **Photo view names** — VOORKANT, ACHTERKANT, LINKERZIJDE, RECHTERZIJDE, DASHBOARD, ACHTERBANK, KOFFERBAK, MOTORRUIMTE. The 8 required views were listed as an open question; these are reasonable automotive inspection angles.
2. **Mock vehicle data** — 5 vehicles (Golf, Polo, Tiguan, ID.4, Passat) with realistic specs and prices. Plates are fictional.
3. **Mock dealer data** — 5 dealers with Amsterdam-area addresses and distances. Names follow VW naming conventions.
4. **Mileage ceiling** — Set at 500,000 km. The stories say "bounds defined with the business" but give no number.
5. **Photo minimum** — Set to 1 per readiness review decision #6. Stories say 8 required, but readiness review resolved this to "hard minimum 1, 8 encouraged."
6. **File size limit** — 10 MB per photo, per readiness review implied default #16.
7. **Accepted formats** — JPEG, PNG, HEIC per readiness review implied default #16.
8. **Time slots** — Hourly blocks 09:00-17:00 with a lunch gap. No source specifies available times.
9. **Follow-up SLA text** — Confirmation says "zo snel mogelijk" (as soon as possible) rather than a specific timeframe, because readiness review #21 flags this as the sharpest remaining gap.
10. **Dutch language** — All UI text is in Dutch, matching the VW.nl target audience from the briefing.
11. **Plate validation** — Simple alphanumeric check (5-8 chars after stripping dashes/spaces). Real NL plate validation would use sidecodes.
