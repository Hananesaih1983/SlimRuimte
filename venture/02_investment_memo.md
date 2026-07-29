# Stage 2 Investment Memo — SlimRuimte
Date: 2026-07-29 | Gate: Venture Gate (Stage 2) | Status: AWAITING HUMAN SIGN-OFF

---

## DECISION: BUILD

Score: 4.10 / 5.00  |  Threshold (aggressive): 3.0  |  Confidence: 90%  |  Divergence: 0.56
No hard constraint breaches. No fabricated evidence IDs. No regulatory blockers.

---

## Scorer Results Side-by-Side

| Criterion           |  W | Score A | Score B | Avg  | A×W | B×W |
|---------------------|----|---------|---------|------|-----|-----|
| problem_severity    | 15 |    5    |    4    | 4.5  |  75 |  60 |
| market_demand       | 12 |    4    |    4    | 4.0  |  48 |  48 |
| customer_acquisition| 12 |    4    |    4    | 4.0  |  48 |  48 |
| revenue_potential   | 10 |    4    |    3    | 3.5  |  40 |  30 |
| competition         | 10 |    5    |    4    | 4.5  |  50 |  40 |
| personal_fit        |  8 |    4    |    4    | 4.0  |  32 |  32 |
| technical_feasibility|  8 |    5    |    4    | 4.5  |  40 |  32 |
| time_to_mvp         |  8 |    4    |    3    | 3.5  |  32 |  24 |
| initial_investment  |  6 |    5    |    5    | 5.0  |  30 |  30 |
| strategic_fit       |  6 |    3    |    3    | 3.0  |  18 |  18 |
| learning_value      |  5 |    5    |    4    | 4.5  |  25 |  20 |
| **TOTAL**           | **90** |  |  |  | **438** | **382** |

Scorer A weighted score: 4.38 (Claude Sonnet 4.6)
Scorer B weighted score: 3.82 (Claude Sonnet 4.6)
Average: 4.10 | Divergence: 0.56 (below 1.0 threshold — no escalation required)
Confidence A: 96% | Confidence B: 84% | Average: 90%

Fabricated evidence IDs: NONE (both scorers verified)

---

## Per-Criterion Evidence and Rationale

### problem_severity — Avg 4.5/5 (weight 15)
Evidence: ev_001 to ev_008, ev_013
A: 5 — Criminal convictions, government legal templates, and 9.6-month planning timelines confirm financial and emotional bleeding-neck pain with documented victim counts and monetary losses.
B: 4 — Both problems are evidenced by criminal court verdicts and high-engagement community evidence, though the 3D visualisation problem alone is closer to a frustration than a bleeding neck.
Split: B correctly notes the 3D visualisation problem is milder than the fraud/trust problem. Score 4.5 reflects that the combination is a strong 4-5, not the split average of two 2.5s.

### market_demand — Avg 4.0/5 (weight 12)
Evidence: ev_009, ev_013, ev_014, ev_017, ev_018, ev_019, ev_020
Both scorers: 4 — 65% of NL homeowners renovate within 5 years at €35K average spend; 246K-member renovation community; 800K Eigenhuis members; budget clearly allocated. Conversion from free tool to paid contractor lead funnel remains unproven (the honest constraint on not scoring 5).

### customer_acquisition — Avg 4.0/5 (weight 12)
Evidence: ev_017, ev_018, ev_019, ev_020, ev_024
Both scorers: 4 — Multiple pre-existing, concentrated channels: r/Klussers (246K), Eigenhuis.nl (800K, proven white-label model with Zoofy), BouwGarant (1,300 contractors, 70% brand awareness), Batibouw (175K visitors), Immoweb.be (third-party embedding precedent already established). Unusually strong acquisition position for a zero-marketing-budget Stage 2.

### revenue_potential — Avg 3.5/5 (weight 10)
Evidence: ev_009, ev_014
A: 4 — Y3 €1.27M (~€106K/mo) is plausible given supply and conversion data, but Y1 ramp depends on contractor adoption velocity not yet demonstrated.
B: 3 — Thin per-unit model (€105 gross per project) requires significant volume to cross €20K/month; contractor willingness to pay remains unvalidated.
Split note: this is the primary risk criterion. The €35/lead assumption is Tier A. Score 3.5 is honest.

### competition — Avg 4.5/5 (weight 10)
Evidence: ev_005, ev_015, ev_016
A: 5 — No NL/BE platform combines AI visualisation with vetted contractor matching; incumbents (Werkspot/Homedeal) are criminally implicated; US proof-of-concept (Block Renovation) confirms the model works.
B: 4 — Fragmented, disliked incumbent landscape; IKEA Kreativ's kitchen/bathroom failure opens the highest-value segment; one accuracy competitor (CamPlan AI) noted but has zero contractor matching.

### personal_fit — Avg 4.0/5 (weight 8)
Evidence: founder_has_problem=true, domain_score=3
Both scorers: 4 (capped per rules: base 3 + 1 for direct problem experience = 4)
Interior designer and V-Ray 3D modelling expert, Benelux-based, personally experienced both contractor trust failure and the visualisation gap. Domain expertise is directly applicable to both product problems.

### technical_feasibility — Avg 4.5/5 (weight 8)
Evidence: ev_015, ev_023
A: 5 — Full stack (Flux 1.1 Pro, GPT-4o, iPhone LiDAR, Planner5D white-label, Next.js/Supabase/Vercel) consists of proven commodity APIs; US precedent already in production.
B: 4 — LiDAR-to-accurate-render pipeline integration at 2cm precision is the one non-trivial engineering risk; all other components are confirmed production-grade.

### time_to_mvp — Avg 3.5/5 (weight 8)
Evidence: ev_015
A: 4 — Sub-6-week build realistic for lead-gen landing page + single render flow; BouwGarant onboarding and LiDAR integration add scope.
B: 3 — Two-sided marketplace adds complexity; sub-3-week MVP unlikely; sub-6-week viable but demanding.

### initial_investment — Avg 5.0/5 (weight 6)
Evidence: ev_023
Both scorers: 5 — €1,374 total 6-month operating cost against €5,000 ceiling. €0.03-0.05/render. <€80/month infra. No licence fees. Near-zero capital risk.

### strategic_fit — Avg 3.0/5 (weight 6)
Evidence: domain_score=3 (proxy per gate rules, no existing portfolio)
Both scorers: 3 — No existing portfolio to compound against. Builds transferable Benelux proptech positioning and contractor network. Strategic fit will improve significantly if founder's interior design practice or V-Ray clients become distribution/pilot customers.

### learning_value — Avg 4.5/5 (weight 5)
Evidence: ev_014, ev_015, ev_018, ev_019
A: 5 — Produces reusable AI render pipeline, BouwGarant network, homeowner distribution, and lead-marketplace playbook for adjacent verticals.
B: 4 — Vetted Benelux contractor network and AI spatial rendering pipeline are highly transferable; slightly less than 5 due to niche geographic focus.

---

## Constraint Check

| Constraint | Value | Breach? |
|-----------|-------|---------|
| Max cash before first customer | €5,000 | NO (6-month cost ~€1,374) |
| Max build weeks | 8 | NO (est. 6 weeks) |
| Budget ceiling | €5,000 | NO |
| First customer deadline | 2026-10-31 | On track |
| Regulatory blocker | None found | NO |
| Competing ventures in stages 5-9 | 0 | NO |

---

## What Both Scorers Agree On

1. The problem is real and evidenced — criminal court verdict, government legal pages, and documented financial losses leave zero doubt.
2. Channels are unusually strong for a Stage 2 venture — Eigenhuis.nl white-label model and BouwGarant are de-risked distribution paths.
3. Capital efficiency is best-in-class — €1,374 for 6 months is near-zero risk regardless of outcome.
4. Contractor willingness to pay €35/lead is the make-or-break unvalidated assumption.

---

## Where the Scorers Differed (divergence = 0.56)

Split criteria: revenue_potential (A:4, B:3), technical_feasibility (A:5, B:4), time_to_mvp (A:4, B:3)

The split is not a fundamental disagreement about the venture. Both scorers flag the same riskiest assumption. B is more conservative on unit economics and MVP timeline; A is more optimistic on tech commodity. Neither split exceeds 1 point — no escalation required.

The single question this divergence surfaces: can the platform sustain volume sufficient to cross €20K/month on €105/project gross? This is an execution question, not a hypothesis question. The market is large enough; the gap between Y1 €253K and €240K/yr target is reachable at 0.5% digital penetration.

---

## Riskiest Assumption and Cheapest Test

Both scorers independently identified the same riskiest assumption:

RISKIEST ASSUMPTION: Contractors will pay €35/lead for a pre-visualised brief from an unproven platform — if they treat it as a commodity or prefer lower-cost cold leads, the revenue model collapses.

CHEAPEST TEST (consensus): Contact 20 BouwGarant-listed contractors via WhatsApp or email. Offer one free pre-visualised lead. Ask for a signed commitment to pay €35 for the next one. Measure yes/no rate. Zero product required. Time: 2 weeks. Cost: €0.

Target: 5+ of 20 contractors say yes = proceed to build. Fewer than 3 = reprice or pivot revenue model to subscription.

This test produces E2 evidence (named contractor on record) which is the one evidence tier currently missing from the entire ledger.

---

## Each Scorer's Second-Riskiest Assumption

Scorer A: The 2cm accuracy claim requires LiDAR + AI pipeline integration that, if it underperforms, removes the core differentiation from IKEA Kreativ's 6cm ceiling.
Cheapest test: Build and test the LiDAR scan → Flux render pipeline in 1 week on a real room; measure dimensional accuracy before showing to any contractor.

Scorer B: Homeowners may not use a free 3D tool at sufficient volume to generate lead flow without a marketing spend that exceeds the €5K budget.
Cheapest test: Post 3 detailed renovation project cases to r/Klussers offering free 3D renders in exchange for email sign-up; measure conversion rate over 5 days at zero cost.

---

## Recommended Build Sequence (implied by scorer analysis)

Week 1-2: Contractor willingness-to-pay test (cheapest test — zero product)
Week 1:   LiDAR + render pipeline accuracy test (one room, one render)
Week 3:   If both tests pass, build MVP: scan flow + render output + contractor brief delivery
Week 4-5: Onboard 10 BouwGarant contractors as pilot supply
Week 6:   First 3 paid leads delivered. First revenue.
Week 7-8: Eigenhuis.nl partnership outreach with live proof of concept

---

## Sign-off Block

[ ] I have read both scorer reports and the divergence analysis
[ ] I accept the riskiest assumption as the first thing I will test
[ ] I commit to running the 20-contractor outreach test before writing a single line of product code
[ ] I accept the kill criteria in venture.json as pre-committed and irrevocable

Founder sign-off required before Stage 3 begins.
