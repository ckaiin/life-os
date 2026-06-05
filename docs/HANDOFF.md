# Life OS — Claude Code Handoff Document
## Version 1.24 → 2.0 Migration

---

## WHO THIS IS FOR
This document is for a new Claude Code instance picking up the Life OS project. Read this fully before touching any code.

---

## ABOUT CONOR
- 22 years old, graduating Elon University (Supply Chain Management)
- Starting as Sales Associate at **Chef's Warehouse** covering **Westchester County, NY**
- Start date: **June 29, 2026** (confirmed — HR paperwork incoming)
- Comp: $70K base + $500/mo tax-free travel expense + full benefits (health, dental, vision, 401k, employee stock program)
- Draw structure: still pending in offer letter
- Living rent-free at grandparents' Greenwich, CT apartment
- Portfolio: $45K (JLPSX + JTEK via JPMorgan)
- Quit nicotine: June 16, 2025
- Currently in Greece (trip started May 28, 2026)
- Direct manager: Tim Wilder. Tim's boss (who made the hire): Patrick

## WRITING/RESPONSE PREFERENCES
- Never use em-dashes
- No AI filler phrases: "it is worth noting," "furthermore," "moreover," "in conclusion," "delve into," "this highlights"
- Natural, varied, grounded tone at all times
- Critical evaluation preference: evaluate ideas before agreeing, call out comfort-driven choices explicitly, don't lead with praise

---

## WHAT EXISTS NOW — VERSION 1.24

### Live URL
**https://ckaiin.github.io/life-os/**
GitHub repo: public, owned by ckaiin

### Tech Stack (Current)
- Single HTML file (`index.html`) hosted on GitHub Pages
- All data stored in **browser localStorage**
- No backend, no database, no authentication
- ElevenLabs pre-recorded MP3 audio files in `/audio/` folder for greeting

### File Structure in Repo
```
/index.html          — main dashboard (2,835 lines)
/audio/
  ElevenLab-GoodMorning.mp3
  ElevenLab-GoodAfternoon.mp3
  ElevenLabs-GoodEvening.mp3
```

---

## DASHBOARD ARCHITECTURE

### Persistent Header
- Title: "Life OS — Conor"

### Morning Brief Bar (always visible, above tab nav)
Three columns:
- **Left:** Date + time-based greeting ("Good morning/afternoon/evening, Conor.") in Bebas Neue
- **Center:** Today's workout (based on day of week) + cycling to-do ticker (rotates every 4s with fade)
- **Right:** Sleep shift tracker — counts down from 9:30 AM to 6:00 AM target by June 29, shifts 30 min every 7 days, shows current target wake time + bedtime (8hr sleep) + progress bar

Audio: ElevenLabs Jarvis-style greeting plays on first tap/click. Voice ID: `zNsotODqUhvbJ5wMG7Ei`

### Stats Bar (dashboard tab only)
- Days to Start (countdown to June 29, 2026)
- Nicotine Free (since June 16, 2025)
- Base Salary ($70K + $500/mo travel)
- Portfolio Value ($45K)

### Tab Navigation
Order: ⌂ Dashboard | A Work | B Finance | C Health & Fitness | D Daily Structure | E Social & Identity | ! Callouts | [Others dropdown →]

### Others Dropdown (far right)
Contains: Goals, Ideas, Notes, Offer Letter Checklist, Home Maintenance, Golf, Supplements

---

## FEATURES BUILT (full inventory)

### Dashboard Tab
- 3x2 grid of pillar cards (A Work, B Finance, C Health, D Structure, E Social, Callouts)
- Each card: tag, title, description, 4 bullet action items, progress bar
- Progress bars update live as checkboxes are checked on pillar tabs
- 4-column timeline strip below cards

### A — Work Tab
- 7 action items with persistent checkboxes
- Sections: Before day one, During 8-month training period

### B — Finance Tab
- 8 action items with persistent checkboxes
- Budget calculator: inputs salary, savings rate, Roth IRA contribution, Hydrogen Fitness tier
  - Calculates federal tax (2026 brackets), CT state tax, FICA
  - Outputs: take-home annual/monthly, savings, Roth monthly, spendable, gym cost, discretionary
  - Note: NY/CT credit explained, estimates only

### C — Health & Fitness Tab
- 6 action items with persistent checkboxes (item 1 = Hydrogen Fitness decision)
- Hydrogen Fitness: Basic $149.99/mo, Advanced $220/mo
- **Daily Weight Tracker:**
  - Input weight → auto-checks maintenance weigh-in checkbox
  - Line chart (last 30 entries, SVG)
  - Stats: current, lowest, highest, overall delta
  - Log of last 14 entries with day-over-day delta (green/red)

### D — Daily Structure Tab
- 4 action items with checkboxes
- **Weekly Training Split** (clickable, resets every Sunday via week number):
  - Monday: Upper, Tuesday: Lower, Wednesday: Rest
  - Thursday: Zone 2 Run, Friday: Upper, Saturday: Rest, Sunday: Zone 2 Run + Prep
  - Run protocol: 5 min fast walk warmup, start 5.0–5.1 mph, 0.2 mph increments only, wait 3–4 min between adjustments, target HR 143–148, drop if >150
- Running protocol notes (Phase 1 base building)
- Injury notes: plantar fasciitis, right piriformis

### E — Social & Identity Tab
- 5 items as plain text (no checkboxes — social framework is guidance, not tasks)

### ! Callouts Tab
- 7 accountability items (spending lie, present not engaged, relationship trap, sleep excuse, Sunday trap, comfortable is enemy, entrepreneur pattern)

### Goals Tab (Others)
- **To-Do section** (above goals):
  - Add tasks with priority (high/medium/low) and due date
  - Sorted by priority then due date, done items struck through
  - Persistent via localStorage
  - Feeds the cycling ticker in morning brief center
- Short term goals (5 items)
- Long term goals (3 items)

### Ideas Tab (Others)
- Placeholder text, freeform

### Notes Tab (Others)
- Placeholder text, freeform

### Offer Letter Checklist (Others)
- Confirmed (3 items): $70K base, $500/mo travel, full benefits
- Still need to confirm (4 items): draw structure, commission %, 401k match, start time
- Persistent checkboxes

### Home Maintenance Tab (Others)
- 6 sections: Bedding & Linens, Towels, Bathroom, Kitchen, Skincare Tools, Clothing, Miscellaneous
- Each item has a cycle (days), auto-resets when elapsed, shows "Xd left" or "Xd overdue" in red
- Special logic:
  - `data-no-overdue="true"`: weigh-in — never shows red, never in brief count
  - `data-sunday-reset="true"`: laundry — only overdue Mon-Sat if not done since last Sunday
- Overdue count feeds the morning brief center "X overdue" badge
- Overdue badge updates live when items are checked

### Golf Tab (Others)
- Stats: handicap (editable), best round (editable), rounds logged count, Break 90 goal
- Log a round: type (course/sim), date, location, score, holes, notes — persistent
- Round history: editable, deletable, score turns green if <90
- Swing analysis log: date, club, score, priority, passing, needs work, notes — editable, deletable
- Club distances table: name, carry (yds), notes — editable, deletable

**Current bag:**
| Club | Carry | Notes |
|------|-------|-------|
| TaylorMade SIM2 Driver | 257 | Tends to Slice — Stand far away from ball |
| TaylorMade Stealth Fairway 3 Wood | 225 | Tends to Fade |
| Stix 4 Hybrid | 213 | Tends to Fade |
| TaylorMade M6 4 Iron | 189 | — |
| TaylorMade M6 5 Iron | 182 | — |
| TaylorMade M6 6 Iron | 175 | — |
| TaylorMade M6 7 Iron | 167 | — |
| TaylorMade M6 8 Iron | 155 | — |
| TaylorMade M6 9 Iron | 138 | — |
| TaylorMade M6 Pitching Wedge 43.5 | 122 | — |
| TaylorMade M6 Approach Wedge 49 | 110 | Great for 100-110 range |
| Stix Sand Wedge 56 | 80 | Need to work on full swing confidence |
| Callaway Mack Daddy 4 (60°) | 86 | Need to work on full swing confidence |
| Stix Putter | — | Look into getting a new putter |

### Supplements Tab (Others)
**Morning stack:**
- Omega-3 Fish Oil 3,600mg — 40 servings/bottle — countdown tracker
- Vitamin C 500mg — 250 servings/bottle — countdown tracker
- Zinc Picolinate 30mg — 60 servings/bottle — countdown tracker
- Vitamin D3 5,000 IU — 360 servings/bottle — countdown tracker
- CDP Choline 300mg — 120 servings/bottle — countdown tracker (watch for anxiety)
- B-Complex #12 1 capsule — 60 servings/bottle — countdown tracker
- Lion's Mane 1,000mg — 150 servings/bottle — countdown tracker
- Rhodiola Rosea 500mg — 60 servings/bottle — countdown tracker (empty stomach)
- Creatine Monohydrate 5g — 200 servings/bottle — countdown tracker

**Night stack:**
- Magnesium Glycinate 210mg — 60 servings/bottle — countdown tracker
- Apigenin 50mg — 60 servings/bottle — countdown tracker

**Sunday fill checklist** — all 11 supplements, resets every Sunday (same week number logic as workout tracker)

Countdown logic: enter bottle open date → calculates days remaining → amber at 7 days → red at 3 days → "New bottle" button resets

### Export to Claude Button (footer)
Copies full localStorage data snapshot as formatted text to clipboard. Used to share data context with Claude when asking questions about logged data.

---

## VERSION HISTORY
- 1.0: Initial build
- 1.1: $70K salary confirmed
- 1.21: Fixed to-do ticker persistence on reload
- 1.22: Updated Hydrogen Fitness action item with tier decision
- 1.23: Corrected Advanced tier price to $220
- 1.24: Added Hydrogen Fitness dropdown to budget calculator

---

## VERSION 2.0 — WHAT WE'RE BUILDING

### The Goal
Move from localStorage to a real backend so:
1. Data persists across browsers and devices
2. Whoop, Garmin, Hevy, and MyFitnessPal data can be pulled automatically
3. A real daily stats dashboard can be shown

### Backend: Supabase
- Free tier, generous limits
- Handles auth, database, edge functions
- Safe OAuth token storage for third-party APIs

### APIs to connect (in rough priority order)
1. **Hevy** — most accessible API, workout logging
2. **Garmin** — requires OAuth, activity/HR/GPS data
3. **Whoop** — requires OAuth, recovery/HRV/sleep data
4. **MyFitnessPal** — API severely restricted since 2020, may not be possible

### Migration plan
1. Set up Supabase project
2. Create database tables mirroring current localStorage structure
3. Build auth (simple email/password or magic link)
4. Migrate frontend to read/write from Supabase instead of localStorage
5. Add third-party OAuth connections one by one
6. Build daily stats dashboard section

### Supabase setup (Conor needs to do this)
1. Go to supabase.com, create account
2. New project: name "life-os", US East region
3. Settings → API → grab Project URL and Anon public key

---

## DESIGN SYSTEM

### Colors (CSS variables)
```css
--bg: #eef0f3
--bg2: #e6e9ed
--bg3: #dde0e6
--text: #1a1e26
--text2: #5a6070
--text3: #8a92a0
--accent: #2c3a52
--accent2: #4a6080
--red: #b83030
--green: #1e8c4e
--teal: #167a60
--blue: #1e6ea8
--amber: #b86e1a
--pink: #a03060
```

### Fonts
- **Bebas Neue** — headers, stats, large numbers
- **DM Sans** — all body text, labels, UI

### Key CSS classes
- `.panel` — each tab's content area (display:none by default, `.active` shows it)
- `.action-item` — action items with checkbox, number, title, detail
- `.maint-item` — maintenance items with cycle logic
- `.supp-countdown` — supplement countdown widget
- `.workout-day` — clickable training day blocks
- `.golf-round-item` — logged round rows
- `.todo-item` — to-do list items

---

## JAVASCRIPT ARCHITECTURE

### Init order (critical — order matters)
```javascript
initWorkoutDays()
renderWeightTracker()
renderTodos()
initMorningBrief()
startTodoCycle()
initMaintenance()
initCheckboxes()
initGolf()
initSupplements()
initSundayFill()
```

### Key functions
- `switchTab(id)` — tab navigation
- `toggleDropdown()` — Others dropdown
- `initMorningBrief()` — builds brief bar content
- `updateBriefOverdue()` — updates overdue count in brief, call after any maintenance change
- `startTodoCycle()` — starts the rotating to-do ticker
- `initMaintenance()` — loads all maintenance items with cycle logic
- `initCheckboxes()` — loads all pillar action item checkboxes
- `runCalc()` — budget calculator
- `logWeight()` — logs weight AND auto-checks maintenance weigh-in
- `initGolf()` / `renderGolfLog()` / `renderClubs()` / `renderSwingLog()` — golf tab
- `initSupplements()` / `setSuppOpen(key)` / `resetSuppOpen(key)` — supplement countdowns
- `initSundayFill()` / `toggleSundayFill(id)` — Sunday supplement fill checklist
- `exportToClaude()` — copies data snapshot to clipboard

### localStorage keys (full list)
```
// Pillar checkboxes
chk-work-1 through chk-work-7
chk-finance-1 through chk-finance-8
chk-structure-1 through chk-structure-4
chk-health-1 through chk-health-6
chk-offer-1 through chk-offer-7

// Maintenance items
maint-m-pillowcase, maint-m-sheets, maint-m-duvet, maint-m-pillow
maint-m-facetowel, maint-m-bodytowel, maint-m-handtowel
maint-m-toilet, maint-m-sink, maint-m-shower, maint-m-bathmat, maint-m-razor, maint-m-toothbrush
maint-m-dishcloth, maint-m-counters, maint-m-floors, maint-m-fridge
maint-m-phone, maint-m-laundry, maint-m-weighin

// Workout days (weekly reset)
workout-monday through workout-sunday
workout-week (week number for reset)

// Weight tracker
weight-log (JSON array: [{date, weight}])

// To-dos
todos (JSON array: [{id, text, priority, due, done}])

// Golf
golf-hcp, golf-best
golf-rounds (JSON array)
golf-swings (JSON array)
golf-clubs (JSON array)
golf-equipment (string)

// Supplements (countdown)
supp-open-omega3, supp-open-vitc, supp-open-zinc, supp-open-vitd3
supp-open-cdp, supp-open-bcomplex, supp-open-lionsm, supp-open-rhodiola
supp-open-creatine, supp-open-mag, supp-open-apigenin

// Sunday fill checklist
sundayfill-sf-omega3 through sundayfill-sf-apigenin
sundayfill-week (week number for reset)

// Reorder checkboxes (any remaining)
reorder-ro-[supplement]
```

---

## CONTEXT NOTES

### Chef's Warehouse
- Specialty food distributor, primarily East Coast
- Subsidiary brands: Allen Brothers (premium proteins), Down East Seafood
- Westchester County territory = restaurants, hotels, country clubs
- Training period: 8 months inside sales before outside territory assignment
- Manager: Tim Wilder (direct). Patrick = Tim's boss, made the hire decision

### Personal health
- Running: Phase 1 base building, Zone 2 only, Thursdays and Sundays
- Lifting: Upper/Lower split, Mon/Tue/Fri (upper Mon+Fri, lower Tue)
- Injuries: plantar fasciitis history, right piriformis issue
- Acne-prone skin — affects supplement stack and maintenance cycles
- Skincare: prescription tretinoin/azelaic acid/niacinamide compound, PanOxyl 10%
- Gym: Hydrogen Fitness in Greenwich, CT (deciding Basic $149.99 vs Advanced $220)

### Financial context
- No rent (grandparents' Greenwich apartment)
- No car payment, no phone bill
- JPMorgan portfolio: JLPSX (1.39% expense ratio, F-rated), JTEK (0.65%, concentrated tech)
- Both funds not immediately moveable — revisit when possible
- Priority when income starts: Roth IRA ($7K/year), hard stop on parent spending

---

## WHAT TO DO FIRST IN CLAUDE CODE

1. Get Conor's Supabase Project URL and Anon key
2. Create the database schema (tables mirroring localStorage structure above)
3. Build a simple auth layer
4. Start migrating the most critical data first: to-dos, weight log, golf rounds
5. Then supplements, maintenance, checkboxes
6. Then tackle third-party API connections

Do NOT rewrite the entire frontend from scratch. Migrate incrementally. The design and UX stay the same.
