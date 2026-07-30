@AGENTS.md

# SlimRuimte — Build Context

## One Job
SlimRuimte lets a NL/BE homeowner or professional scope a renovation, see it
in 3 photorealistic AI renders, get a professional floor plan and 3D model,
and get matched to 3 vetted contractors who pay €35 for the pre-scoped lead.

## Activation Event
Homeowner sees their first AI render of their own room. Everything before that
is friction to minimise. Everything after is retention.

## Build Quality Gate (MANDATORY before any commit to main)

Claude Code is split into two independent roles per week:

BUILDER — writes the feature code. Does NOT run the full test suite.
TESTER  — separate instance, reads only the code and spec, no builder context.
           Tries to break everything. Fixes what it finds. Runs all tests.
           Only after TESTER passes does code go to main.

The TESTER reports back to Hermes with:
  - Tests: X/X pass
  - Build: clean / errors found + fixed
  - Flows tested: [list]
  - Security: RLS cross-user isolation confirmed
  - Known issues: [any intentional deferrals]

Hermes then notifies the founder: "Week N validated. Ready for your testing."

## In Scope (MVP — 12 weeks)

F01  Auth — 5 roles, JWT, RLS, middleware role routing
F02  Room scan — LiDAR (Room.json upload) + manual wizard
F03  Floor plan — SVG viewer, DXF/PDF download, elevation drawings
F04  3D model — trimesh GLB, model-viewer browser embed, AR on mobile
F05  Moodboard — 3 paths (upload / AI chat / guided questions) → merged prompt
F06  AI renders — 3× Flux Kontext/Ultra, EU AI Act Art.50 labels
F07  Renovation brief — PDF (WeasyPrint), all assets + dimensions
F08  Contractor onboarding — KvK/VAT verify (DSA), BouwGarant badge, Stripe Connect
F09  Contractor matching — rule-based, 3 leads per project, €35 pay-on-accept
F10  In-platform messaging — Supabase Realtime, threaded per project/contractor
F11  Reviews — 4-dimension, post-completion, public on contractor profile
F12  Professional subscription — Starter €99/mo, Professional €199/mo, Expert €299/mo
F13  Pro-initiated workflow — pro creates for client, visibility controls, invite email
F14  Project management — Gantt, budget tracking, documents, subcontractors
F15  Estate agent B2B — property scan, Funda 3D ranking
F16  Decodata catalog — 150K+ NL furniture SKUs, shoppable renders
F17  Trilingual — NL (default), EN, FR
F18  Multi-project — up to 5 active per homeowner (MVP), unlimited pro

## Out of Scope (do NOT build)
- Payment escrow (Renno does this)
- Native iOS/Android app (web + PWA only)
- Video walkthroughs
- BIM/IFC export (Phase 2)
- Permit assistance (Phase 2)
- Scheduling / procurement integrations (Phase 2)

## Hard Constraints
- Budget: €6,000 total
- Build window: 12 weeks
- Infra cost: <€80/month
- One developer (founder, interior designer + 3D expert)
- evidence_debt: true — Stage 3 skipped, kill criterion active:
  zero contractor paying for a lead by 2026-10-31 = venture killed

## Tech Stack
- Next.js 16 (App Router, TypeScript, Tailwind, shadcn/ui)
- Supabase (auth, postgres, realtime, storage) — uiqsagwikywgeiyunypg
- Vercel (deploy) — hanane7/slimruimte
- Flux Kontext Pro + Flux 1.1 Pro Ultra via FAL.ai (renders)
- Magnific AI (upscale, optional)
- Apple RoomPlan via 3D Scanner App (LiDAR — Room.json file upload, free)
- trimesh + model-viewer (3D viewer)
- Stripe Connect (contractor lead payments + professional subscriptions)
- Resend (transactional email)
- Twilio (WhatsApp notifications to contractors)

## Stripe Price IDs (test mode)
STRIPE_PRICE_LEAD_FEE=price_1TyoQtAKkj8LZeVQzvZuHMRM          (€35 one-time)
STRIPE_PRICE_DESIGNER_LEAD=price_1TyoQuAKkj8LZeVQ9fk4sKFL     (€25 one-time)
STRIPE_PRICE_STARTER=price_1TyoQuAKkj8LZeVQFspk1Pvp            (€99/month)
STRIPE_PRICE_PROFESSIONAL=price_1TyoQvAKkj8LZeVQhqkudIvK       (€199/month)
STRIPE_PRICE_EXPERT=price_1TyoQvAKkj8LZeVQm4HGNkKn             (€299/month)

## Env Vars Required
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
FAL_KEY
MAGNIFIC_API_KEY
RESEND_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM
NEXT_PUBLIC_APP_URL
