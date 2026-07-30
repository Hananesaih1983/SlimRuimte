# SlimRuimte — Pause Snapshot
Slug: slimruimte
Paused at: 2026-07-30T20:00:00+02:00
Snapshot version: 1.0

---

## 1. Identification
- Venture: SlimRuimte
- Slug: slimruimte
- Repo: C:\Users\hshan\ventures\SlimRuimte
- GitHub: https://github.com/Hananesaih1983/SlimRuimte
- Production: https://slimruimte.vercel.app
- Supabase: uiqsagwikywgeiyunypg (North EU Stockholm)

---

## 2. Stage and Status at Pause
- Stage: 6 — Architecture complete, Weeks 1+2 build deployed
- Status at pause: active → frozen
- Build deployed: Yes — 26 routes live, 467/467 tests passing
- Weeks built: 1+2 (foundation + scan flow)
- Weeks remaining: 10 (Weeks 3-12)

---

## 3. Active Hypothesis at Pause

**Original hypothesis (B2C marketplace):**
Homeowner scopes renovation → gets free AI 3D renders → matched to 3 BouwGarant-verified
contractors who receive the visual brief as a premium lead and pay €35/lead.

**Rescue hypothesis (B2B opname SaaS — Vector 1, NOT yet validated):**
Contractors and interior designers pay €199/month for a tool that turns a 2-hour
opname site visit into a 20-minute digital workflow — LiDAR scan, auto floor plan PDF,
photo condition report, quote generation.

**Status of rescue hypothesis:** Tier A only — NOT validated. Rescue plan written but
the 20-contractor outreach test (Vector 1) has NOT been run yet. This is the
mandatory next action before any further building.

---

## 4. Exit Criteria Remaining

Stage 3 (SKIPPED — evidence_debt=true):
- [ ] E2: 3+ named contractors confirm willingness to pay for a pre-scoped visual lead
      OR (if B2B pivot confirmed) 3+ contractors/designers confirm €199/month WTP

Stage 4 (PRD — COMPLETE):
- [x] PRD written, scope defined, tech stack chosen

Stage 5 (UX — COMPLETE):
- [x] 23 screens documented with 4 states each, Dutch/EN/FR copy

Stage 6 (Architecture — COMPLETE):
- [x] Full data model, RLS, cost model, 4 migrations live

Stage 7 (Build — IN PROGRESS at Week 2):
- [x] Week 1: Auth, 5 roles, DB, middleware, i18n
- [x] Week 2: Scan flow (LiDAR + manual wizard), project creation
- [ ] Week 3: Floor plan SVG viewer + elevation drawings + DXF/PDF
- [ ] Weeks 4-12: 3D model, renders, moodboard, brief, contractor matching,
      messaging, reviews, Stripe, pro workflow, project management

---

## 5. Last Evidence Entry
- ID: ev_rescue_01
- Tier: A (hypothesis only — no human contact)
- Claim: Rescue plan generated — B2B opname pivot identified as dominant vector.
  Gate score 4.10 above BUILD but founder triggered pivot review after competitor observation.
- Source: null (internal analysis)
- Date: 2026-07-30

Last E3 evidence: ev_024 — Immoweb.be already embeds third-party services (precedent for
platform integration)

---

## 6. Open Tasks / Next Actions

**MANDATORY before any further building:**

1. Run the 20-contractor outreach test (Vector 1 from rescue plan):
   - Message 20 BouwGarant contractors via WhatsApp/LinkedIn
   - Offer: "Gratis 30 dagen proberen — opname tool dat 2 uur werk naar 20 min terugbrengt"
   - Pass criterion: 3+ positive responses in 7 days
   - If pass: pivot to B2B opname, update brief.md, re-gate, resume build
   - If fail: try Vector 3 (designers only) or kill

2. If Vector 1 passes — scope changes for remaining weeks:
   - Week 3: Floor plan PDF output (same tech, different positioning)
   - Week 4: Photo condition report (new feature — tag photos to walls/elements)
   - Week 5: Quote generation from opname data (new feature)
   - Weeks 6-8: Professional subscription (Stripe, already set up in Stripe)
   - Weeks 9-12: Invoicing + optional bookkeeping export (Moneybird API)

3. If continuing original B2C model (if outreach reveals contractors WILL pay €35/lead):
   - Resume at Week 3: floor plan SVG viewer
   - Follow 12-week build plan as written in 04_prd.md

---

## 7. Blockers

1. **Contractor WTP validation (evidence_debt)** — The single most important unknown.
   Nothing should be built until this is answered. Estimated time to answer: 7-14 days.

2. **iOS Share Sheet limitation** — Apple does not support Web Share Target on iOS Safari.
   "Share to SlimRuimte" does not work on iPhone. Native iOS app required (Phase 2).
   Current workaround: Save to Files or AirDrop.

3. **LiDAR scan file format** — 3D Scanner App may be subscription-gated for "All Data"
   export (post July 2025 acquisition by AI Photo Editor Lab SRL). Free tier has USDZ.
   USDZ parser not yet built — current API only accepts JSON.

4. **Migration 003 new tables** — project_plans, project_tasks, project_documents,
   subcontractors, budget_items, moodboards, moodboard_images are documented in
   architecture but NOT yet added to Supabase. Only migration 004 (RLS fix) has been
   applied since the rescue plan.

---

## 8. Hard Constraints Summary
- Budget cap: €6,000 | Spent: ~€80 (infra) | Remaining: ~€5,920
- Build window: 12 weeks | Used: 2 weeks | Remaining: 10 weeks
- First paying customer deadline: 2026-10-31 (93 days from pause)
- evidence_debt: TRUE — kill criterion active

---

## 9. Kill Criteria Status

| Criterion | Status |
|-----------|--------|
| <30% problem confirmation across 12+ contractor interviews | CLEAR (not yet run) |
| Zero contractor WTP after 25 qualified contacts | ACTIVE — must test |
| Budget >€6,250 | CLEAR (~€80 spent) |
| Build >12 weeks | CLEAR (Week 2 of 12) |
| No paying customer by 2026-10-31 AND re-gate <3.0 | APPROACHING (93 days) |
| Regulatory blocker | CLEAR (EU AI Act Art.50 compliance built in) |
| Six consecutive unavailable weeks | CLEAR |

---

## 10. Key Decisions Log

| Date | Decision | Detail |
|------|----------|--------|
| 2026-07-29 | Gate: BUILD | Score 4.10/5.0, aggressive threshold 3.0, confidence 90% |
| 2026-07-29 | Stage 3 override | Founder overrode customer validation. evidence_debt=true |
| 2026-07-29 | Budget expanded | €5,000 → €6,000. Build window 8 → 12 weeks |
| 2026-07-29 | LiDAR decision | magicplan ($300/mo) replaced by Apple RoomPlan via free 3D Scanner App |
| 2026-07-29 | Scope expansion | All originally-out-of-scope features added: messaging, reviews, project mgmt, moodboard |
| 2026-07-30 | Pro workflow | B2B pro-initiated workflow designed (migration 003) |
| 2026-07-30 | Rescue triggered | Founder observed Home Planner competitor, doubted B2C thesis |
| 2026-07-30 | B2B opname pivot | Rescue plan written. Vector 1 (€199/mo SaaS) dominant. NOT yet validated |
| 2026-07-30 | PAUSE | Founder paused to evaluate direction before continuing build |

---

## 11. Files Modified Since Last Review

Venture docs:
- venture/venture.json — all state
- venture/brief.md — gap_002 hypothesis, Stage 1 complete
- venture/02_investment_memo.md — gate decision: BUILD 4.10/5.0
- venture/02_rescue_plan.md — NEW: 5 rescue vectors, B2B opname pivot
- venture/04_prd.md — full PRD, 12-week build plan
- venture/05_ux.md — 23 screens, 4 states each
- venture/06_architecture.md — data model, RLS, cost model
- venture/evidence.jsonl — 25 entries (22 E3, 2 A, 1 rescue)

Build (C:\Users\hshan\ventures\SlimRuimte\build\):
- src/app/page.tsx — homepage (NL/EN/FR, SlimRuimte brand)
- src/app/auth/login + register — auth flow
- src/app/(homeowner)/ — all homeowner routes
- src/app/(contractor)/ + (designer)/ — role dashboards
- src/app/api/scan/ — LiDAR + manual save routes
- src/components/layout/NavBar.tsx + LanguageSwitcher.tsx
- src/components/pwa/ — InstallPrompt + ServiceWorkerRegistration
- public/manifest.json + sw.js — PWA
- src/test/ — 20 test files, 467 tests
- supabase/migrations/ — 4 migrations (001-004)

---

## 12. Git State
- Repo: C:\Users\hshan\ventures\SlimRuimte
- Branch: main
- Last commit: 3541510 — "Rescue plan: B2B opname pivot analysis"
- Git status: CLEAN (nothing uncommitted)
- Push status: Up to date with origin/main

---

## 13. Resume Instructions

**To resume this venture:**

1. Say "venture restart slimruimte" — Hermes loads this snapshot automatically

2. Load skills in this order:
   - skill_view(name='venture-os')
   - skill_view(name='venture-restart')
   - skill_view(name='opportunity-rescue') — if pivot still undecided
   - skill_view(name='venture-build-claude-code') — if resuming build

3. Read these files first:
   - venture/pause_snapshot.md (this file)
   - venture/02_rescue_plan.md (rescue vectors)
   - venture/venture.json (current state)
   - venture/04_prd.md (full PRD)

4. First action on resume:
   **Run the 20-contractor outreach test (Vector 1).**
   Do NOT resume building until WTP is validated.
   See rescue plan Section "Recommended First Action" for the exact WhatsApp message.

5. If pivot confirmed (B2B opname):
   - Update venture/brief.md with new hypothesis
   - Run venture-gate (re-score with new model)
   - Update 04_prd.md to reflect opname scope
   - Resume build at Week 3 with opname-first feature set

6. If original model confirmed (contractors pay €35/lead):
   - Clear evidence_debt
   - Resume build at Week 3: floor plan SVG viewer
   - Follow 12-week plan in 04_prd.md

7. Keys and credentials needed:
   - GitHub token: stored in ~/ventures/SlimRuimte/build/.env.local
   - Vercel token: stored in ~/ventures/SlimRuimte/build/.env.local
   - Supabase: uiqsagwikywgeiyunypg (keys in .env.local)
   - Stripe: test mode, products created, keys in .env.local + Vercel
   - All API keys documented in .env.local.example
