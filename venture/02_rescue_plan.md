# SlimRuimte — Rescue Plan
Date: 2026-07-30 | Trigger: Founder market observation (competitor ecosystem signal)
Mode: FOUNDER-INITIATED PIVOT REVIEW
Note: Gate score was 4.10 (above BUILD 3.8). This rescue was triggered by a real-world
signal — founder observed Home Planner app ecosystem during Week 2 user testing — not
by gate arithmetic. The gap table is included for completeness but the pivot driver
is strategic, not numeric.

---

## SCORE GAP TABLE

| Criterion             |  W | Avg | Contrib | Ideal | Gap   | +1 gain |
|-----------------------|----|-----|---------|-------|-------|---------|
| problem_severity      | 15 | 4.5 |   67.5  |  57.0 | -10.5 |  0.150  |
| market_demand         | 12 | 4.0 |   48.0  |  45.6 |  -2.4 |  0.120  |
| customer_acquisition  | 12 | 4.0 |   48.0  |  45.6 |  -2.4 |  0.120  |
| revenue_potential     | 10 | 3.5 |   35.0  |  38.0 |  +3.0 |  0.100  |
| competition           | 10 | 4.5 |   45.0  |  38.0 |  -7.0 |  0.100  |
| personal_fit          |  8 | 4.0 |   32.0  |  30.4 |  -1.6 |  0.080  |
| technical_feasibility |  8 | 4.5 |   36.0  |  30.4 |  -5.6 |  0.080  |
| time_to_mvp           |  8 | 3.5 |   28.0  |  30.4 |  +2.4 |  0.080  |
| initial_investment    |  6 | 5.0 |   30.0  |  22.8 |  -7.2 |  0.060  |
| strategic_fit         |  6 | 3.0 |   18.0  |  22.8 |  +4.8 |  0.060  |
| learning_value        |  5 | 4.5 |   22.5  |  19.0 |  -3.5 |  0.050  |
| **TOTAL**             | 90 |     | 410.0   | 342.0 | -30.0 |         |

Current weighted avg: 4.10 | BUILD threshold: 3.80 | Gap: +0.30 ABOVE threshold
Three criteria below their ideal contribution: revenue_potential, time_to_mvp, strategic_fit.

---

## MODE: PIVOT REVIEW (founder-triggered, not gate-triggered)

The gate arithmetic says BUILD. The founder signal says PAUSE.

The signal: competitor (Home Planner / Planner 5D ecosystem) has years of UI polish,
millions of users, established B2C brand. Founder also sees that the contractor
willingness-to-pay (€35/lead) is still Tier A — unvalidated. Founder independently
arrived at the same B2B pivot insight the gate's "riskiest assumption" pointed to.

Root cause of doubt (three concerns named by founder):
1. UI/UX gap vs mature competitors — SlimRuimte Week 2 looks basic
2. Market switching — homeowners may not switch from tools they already use
3. Contractor WTP — not sure contractors will pay €35/lead

Diagnosis:
- Concern 1 (UI) is solvable with time — not a kill signal
- Concern 2 (switching) is real for B2C but irrelevant for B2B — contractors
  have no incumbent tool for digital opname
- Concern 3 (contractor WTP) is the genuine validation gap — and the B2B
  opname model eliminates it entirely by charging the contractor directly for
  a subscription, not per lead

The founder's B2B opname insight is structurally sound. Proceeding.

---

## 5 RESCUE VECTORS

Ranking formula: score = (weighted_points_gained / gap_to_build) x (1 / (days + eur_cost/10))
Since we are above BUILD, "gap_to_build" is replaced with "strategic gap" = the delta
between current model risk and proposed model risk. Vectors ranked by: risk reduction x
speed x cost.

---

VECTOR 1: B2B Opname SaaS — Contractors & Designers [PIVOT — Rank 1]
Type: PIVOT
Adjustment: Abandon homeowner B2C acquisition entirely. Sell SlimRuimte directly
  to NL/BE contractors and interior designers as their opname tool — site visit
  scan, floor plan PDF, photo condition report, client brief. Charge €199/month
  subscription. Target via BouwGarant (1,300 contractors already in our data),
  VGBouw member firms, and NL interior design associations (BNI, BNSt).
  No homeowner onboarding. No lead marketplace. No contractor matching.

Criteria moved:
  revenue_potential:    3.5 -> 5.0  (+15 weighted points — €199/mo SaaS vs €35/lead)
  strategic_fit:        3.0 -> 4.5  (+9 weighted points — founder IS an interior designer)
  customer_acquisition: 4.0 -> 4.5  (+6 weighted points — BouwGarant is direct channel)
  time_to_mvp:          3.5 -> 5.0  (+12 weighted points — no two-sided marketplace needed)

New weighted_sum if confirmed: 410 + 42 = 452 | avg: 452/90 = 5.02 -> STRONG BUILD
Evidence needed: E2 — 3 NL/BE contractors or designers confirm they would pay
  €199/month for a tool that turns a 2-hour opname into a 20-minute digital workflow.
  Test: WhatsApp/email 20 BouwGarant contractors, offer a free 30-day trial in exchange
  for a signed intent-to-pay at €199/month after trial. 3 signed = confirmed.
Time to test: 7 days | Cost: €0
Constraint check: Within €6K budget and 12-week window. No new build needed —
  Week 1-2 foundation already covers the opname workflow.
Risk if wrong: Contractors satisfied with paper/WhatsApp. PIVOT to Vector 3
  (designer-only, higher price point).

---

VECTOR 2: Opname + Invoicing Bundle [PIVOT — Rank 2]
Type: PIVOT
Adjustment: Add lightweight invoicing to the opname tool — auto-generate a quote
  PDF from the opname data (room dimensions + labour rate input + materials estimate).
  Contractors already have all the data from the scan; one tap generates a professional
  quote. Charge €249/month (opname + invoicing bundle). Target ZZP contractors
  first — they have no invoicing software integrated with their field workflow.
  Integration with Moneybird API for bookkeeping export (no rebuild — just an export).

Criteria moved:
  revenue_potential: 3.5 -> 5.0  (+15 weighted points — €249/mo, stickier product)
  strategic_fit:     3.0 -> 5.0  (+12 weighted points — natural workflow integration)
  time_to_mvp:       3.5 -> 3.5  (unchanged — adds 2-3 weeks of build)

New weighted_sum: 410 + 27 = 437 | avg: 437/90 = 4.86 -> BUILD
Evidence needed: E2 — 3 ZZP contractors confirm they would pay €249/month for
  opname + auto-generated quote PDF integrated in one tool.
  Test: Same 20-contractor outreach as Vector 1, but show a mockup of the quote output.
Time to test: 14 days | Cost: €0
Constraint check: Invoicing module adds ~3 weeks build. Still within 12-week window.
Risk if wrong: Contractors already use Moneybird/Exact — don't want another tool.
  PIVOT: offer Moneybird integration only (no in-app invoicing).

---

VECTOR 3: Designer-Only Premium Tier [TWEAK — Rank 3]
Type: TWEAK
Adjustment: Keep current model but drop contractors entirely from the supply side.
  Target only NL/BE interior designers (11,430 registered, 75% solo ZZP). Sell
  SlimRuimte as their client presentation tool: scan client home, generate renders
  and floor plan, share visual brief. Charge €299/month (Professional plan).
  Designers pay for the renders + professional presentation — no lead marketplace,
  no contractor dependency. One paying customer type, no chicken-and-egg.

Criteria moved:
  revenue_potential:    3.5 -> 4.5  (+10 weighted points — €299/mo, 11K addressable)
  customer_acquisition: 4.0 -> 4.5  (+6 weighted points — BNI/BNSt association access)
  strategic_fit:        3.0 -> 5.0  (+12 weighted points — founder IS the customer)

New weighted_sum: 410 + 28 = 438 | avg: 438/90 = 4.87 -> BUILD
Evidence needed: E2 — 3 NL interior designers confirm they would pay €299/month for
  a tool that generates client-ready renders and floor plans from a LiDAR scan.
  Test: Post in BNI/BNSt LinkedIn groups or WhatsApp designer communities.
  Offer 30-day free trial in exchange for feedback session.
Time to test: 7 days | Cost: €0
Constraint check: No new build needed. Week 3-6 renders are the core product.
  This is the path of least resistance.
Risk if wrong: Designers already use Planner 5D or SketchUp for client presentations.
  Differentiator must be speed (20 min vs 3 hours) and LiDAR accuracy.

---

VECTOR 4: Hybrid — B2B First, Marketplace Later [TWEAK — Rank 4]
Type: TWEAK
Adjustment: Keep the full product vision but resequence the go-to-market.
  Months 1-3: sell to professionals only (opname + renders, €199/mo).
  Months 4-6: activate homeowner marketplace once 50+ professionals are on platform.
  This eliminates the cold-start problem — contractors come for the tool,
  homeowners come because contractors are already there.
  No homeowner acquisition cost in months 1-3.

Criteria moved:
  strategic_fit:    3.0 -> 4.0  (+6 weighted points — sequenced, de-risked)
  time_to_mvp:      3.5 -> 4.5  (+8 weighted points — B2B onboarding is 1 week not 12)
  revenue_potential: 3.5 -> 4.0  (+5 weighted points — immediate subscription revenue)

New weighted_sum: 410 + 19 = 429 | avg: 429/90 = 4.77 -> BUILD
Evidence needed: E2 — 10 professionals sign up for free trial within 30 days of
  soft launch on BouwGarant channel.
Time to test: 30 days | Cost: €0
Constraint check: No build change needed — current architecture handles both B2B
  and B2C. Just change the launch sequence.
Risk if wrong: Professionals use the tool but won't activate homeowner marketplace.
  The B2B tool becomes the product permanently — see Vector 1.

---

VECTOR 5: Kill + Learn [KILL — Rank 5, last resort]
Type: KILL
Adjustment: If Vectors 1-4 all fail validation, formally kill SlimRuimte per
  venture-os kill protocol. Document all learnings. The Week 1-2 codebase
  (auth, scan, DB) is a reusable asset for the next venture. The opname insight
  from this rescue is the most valuable output — it can be a standalone venture.

Criteria moved: N/A
Evidence needed: 0/20 contractors respond positively to any of Vectors 1-3.
Time to test: 21 days cumulative | Cost: €0
Constraint check: Within budget (€0 spent on kill decision).
Risk if wrong: You killed a venture that would have succeeded. Acceptable — the
  evidence_debt from skipping Stage 3 made this risk explicit from day one.

---

## RANKING FORMULA APPLIED

Vector 1: (42 pts / 30 gap) x (1 / (7 days + €0/10)) = 1.40 x 0.143 = **0.200**
Vector 3: (28 pts / 30 gap) x (1 / (7 days + €0/10)) = 0.93 x 0.143 = **0.133**
Vector 2: (27 pts / 30 gap) x (1 / (14 days + €0/10)) = 0.90 x 0.071 = **0.064**
Vector 4: (19 pts / 30 gap) x (1 / (30 days + €0/10)) = 0.63 x 0.033 = **0.021**
Vector 5: N/A — last resort only

Vector 1 is dominant. Vectors 2-4 are fallbacks if Vector 1 fails.

---

## RECOMMENDED FIRST ACTION — Vector 1

**B2B Opname SaaS pivot. Start today.**

The founder IS an interior designer. The founder has personally experienced the
opname pain. The founder has domain expertise and a professional network. This is
a 5/5 personal_fit scenario — the customer is the founder.

Day 1 actions:
1. Open WhatsApp or LinkedIn
2. Message 20 BouwGarant-listed contractors (bouwgarant.nl — public list)
   Message: "Ik ontwikkel een tool die een opname van 2 uur terugbrengt naar
   20 minuten — LiDAR scan, automatische plattegrond, fotoverslag en offerte in
   één klik. Gratis 30 dagen proberen. Mag ik je even bellen?"
3. Track responses in a simple spreadsheet (name, date, yes/no/maybe)
4. Target: 3 positive responses in 7 days = Vector 1 confirmed, resume build
   as B2B opname tool. 0 responses = try Vector 3 (designers only).

**Do NOT build anything new until this test is done.**
The Week 1-2 code is ready. The opname workflow exists. The question is
whether professionals will pay — and that question costs €0 and 7 days to answer.

---

## RE-GATE TRIGGER

**Resume building if:** 3+ contractors or designers confirm willingness to pay
€199+/month in writing (WhatsApp, email, or signed trial agreement) within 14 days.
→ Update brief.md with B2B opname hypothesis → Re-gate → Rebuild Week 3+ scope
   around opname workflow instead of homeowner marketplace.

**Pivot to Vector 3 if:** 0-2 contractors respond positively but designers show
interest. Run same test with 20 BNI/BNSt interior designers.

**Kill if:** 0-2 responses across both groups after 21 days.
→ Load venture-kill skill. Preserve codebase as reusable asset.
