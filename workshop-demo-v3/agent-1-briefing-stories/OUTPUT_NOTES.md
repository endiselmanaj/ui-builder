# OUTPUT_NOTES — Agent 1 (Briefing + Stories)

## What was built

A single-file HTML/CSS/JS prototype of the Volkswagen online trade-in value request tool. No build step, no dependencies — open `index.html` in a browser.

### Screens implemented

1. **License plate entry** (TX-1.1) — validates format, simulates Vehicle API lookup with 5 mock vehicles, shows "not found" and error states
2. **Vehicle data display + mileage entry** (TX-1.2) — shows retrieved vehicle details, accepts mileage with range validation (0–500,000 km)
3. **Path choice** (TX-1.3) — online offer vs. dealer appraisal, card-based selection
4. **Photo capture** (TX-2.1, NEEDS INFO) — 8-slot grid with simulated photo upload, blocks submission if <8
5. **Dealer search** (TX-3.1, LATER) — mock iDNAW API with 3 dealers, selectable
6. **Appointment booking** (TX-3.2, NEEDS INFO) — date picker + time slots, some marked unavailable
7. **Review & submit** (TX-2.4/TX-3.3 + TX-4.3) — summary, contact details, consent checkboxes, submit button
8. **Confirmation** — request number, status, next-steps explanation
9. **Dealer dashboard** (TX-4.1 + TX-4.2) — view submitted request + photos, retention countdown bars, forward-to-platform button

### Story coverage

| Story | Status | Implementation |
|-------|--------|---------------|
| TX-1.1 Plate lookup | READY | Full — format validation, API simulation (5 plates), not-found + error states |
| TX-1.2 Mileage | READY | Full — numeric validation, range bounds (0–500k) |
| TX-1.3 Choice | READY | Full — two paths, card UI |
| TX-2.1 Photo capture | NEEDS INFO | Built with assumed 8 views (front/rear/left/right/dashboard/front seats/rear seats/odometer). Size/format rules not specified — no enforcement beyond count. Banner explains the gap. |
| TX-2.2 Device handoff | LATER | Not built — cross-device link flow is out of MVP scope |
| TX-2.3 Email confirmation | LATER | Not built |
| TX-2.4 Submit request | BLOCKED | UI built; consent gate shown with TX-4.3 banner. Submit works for demo but banner warns it's blocked in production. |
| TX-3.1 Dealer search | LATER | Built anyway as lightweight mock — enables the dealer path to be clickable |
| TX-3.2 Dealer slot | NEEDS INFO | Built with mock availability. Some slots shown as unavailable. Banner explains the gap (availability source undefined). |
| TX-3.3 Book appointment | LATER | Built as part of the dealer flow for demo completeness |
| TX-4.1 Photo display | READY | Full — dealer dashboard shows all submitted photos |
| TX-4.2 Auto-delete 6mo | READY | Visual — retention bars show days remaining per photo, cleanup explanation |
| TX-4.3 Consent gate | BLOCKED | Consent checkboxes built; submit disabled until all checked. Prominent banner explains this is blocked pending lawful basis/DPIA. |

## Handling of BLOCKED / NEEDS INFO / LATER stories

**TX-4.3 (Consent — BLOCKED):** The stories say "do not ship anything that stores personal data until TX-4.3 is resolved." Since this is a front-end-only demo with no real storage, I built the full consent UI (three checkboxes that gate the submit button) and added a prominent red banner on the review screen explaining that production submission is blocked pending the consent/DPIA decision. This lets workshop attendees see and discuss the consent flow without pretending the legal question is resolved.

**TX-2.1 (Photo views — NEEDS INFO):** I invented 8 views: Front, Rear, Left side, Right side, Dashboard, Front seats, Rear seats, Odometer. These are reasonable for a vehicle condition assessment. Format/size rules are not enforced since they're undefined. An info banner on the photo screen calls this out.

**TX-3.2 (Slot availability — NEEDS INFO):** I simulated time slots with some randomly marked unavailable. The availability source is undefined, so this is purely illustrative. Banner calls it out.

**LATER stories (TX-2.2, TX-2.3, TX-3.1, TX-3.3):** TX-3.1 and TX-3.3 were built anyway because they make the dealer path navigable. TX-2.2 and TX-2.3 (device handoff, email confirmation) were skipped as they require backend infrastructure.

## Guesses and invented behavior

1. **Mock vehicle data** — invented 5 Dutch-format plates with realistic VW vehicle specs and prices
2. **8 photo views** — invented: Front, Rear, Left side, Right side, Dashboard, Front seats, Rear seats, Odometer
3. **Photo simulation** — clicking a slot generates a colored placeholder canvas (no real camera/upload)
4. **Mileage bounds** — set at 0–500,000 km (business hasn't defined "plausible" range)
5. **Mock dealers** — 3 fictional Amsterdam-area VW dealers with plausible addresses
6. **Time slot availability** — hardcoded list with 3 slots marked unavailable
7. **Dealer dashboard** — invented a simple view to demonstrate TX-4.1 (photo display) and TX-4.2 (retention). Not specified in the stories but needed to show those features.
8. **Retention visualization** — showed days-remaining bars per photo. Actual cleanup mechanism would be a backend job.
9. **Forward to trading platform** — simulated as a button click with success message. The trading platform integration is referenced in the briefing but has no story.
10. **Contact details form** — added name/email/phone on the review screen. Stories don't specify which fields, but the briefing mentions email contact.
11. **Dutch license plate format** — validated as 5–8 alphanumeric characters (simplified; real Dutch plates have specific segment patterns).
12. **VW brand styling** — used VW blue (#001E50) and a simplified VW logo. No official design assets were available.

## How to run

Open `index.html` in any modern browser. No server, no build step, no dependencies.
