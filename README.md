# SlimRuimte

**AI renovation visualisation + vetted contractor matching for NL/BE homeowners**

> "Slim" = smart. "Ruimte" = space/room. SlimRuimte makes renovation smart.

---

## What it does

SlimRuimte solves two linked problems that every Dutch and Belgian homeowner faces when renovating:

1. **They cannot visualise the result before committing** — existing 3D tools (IKEA Kreativ: 6cm error, not suitable for kitchens/bathrooms per IKEA's own support pages) are inaccurate or too complex. Professional renders cost €200-5,000/image.

2. **They cannot find a trustworthy contractor** — Werkspot and Homedeal charge contractors per cold lead regardless of outcome. A Rotterdam criminal court (June 2025) found that scammers specifically recruited victims via these platforms.

**SlimRuimte bridges both**: homeowner scopes their renovation → gets free AI 3D before/after renders (accurate to within 2cm, beating IKEA Kreativ's published 6cm ceiling) → matched to 3 BouwGarant-verified contractors who receive the scoped visual brief as a premium lead.

Contractors pay for pre-qualified, pre-visualised leads. Homeowners pay nothing.

---

## Market

- NL renovation events: ~623,000/yr (57.5% owner-occupied base, CLO 2026)
- BE renovation events: ~449,000/yr
- Benelux home remodeling market: $9.61B (2024) → $15.89B (2033)
- NL renovation + maintenance total sector: €20.8B+
- No NL/BE platform combines 3D visualisation + contractor matching (confirmed)
- US proof-of-concept: Block Renovation (AI visualiser + vetted contractors) — zero EU presence

## Tech stack (planned)

- iPhone LiDAR / GPT-4o vision → room scan to floor plan
- Flux 1.1 Pro API → photorealistic renders at €0.03-0.05/image
- Planner5D or Decodata API → Dutch furniture SKU catalog
- Next.js + Supabase + Vercel → SaaS platform, <€80/month infra
- Stripe/Mollie Connect → contractor lead fee collection (no escrow/PSD2)

## Status

Stage 1 complete → Stage 2 (Venture Gate) in progress

## Venture files

- `venture/brief.md` — problem statement and hypothesis
- `venture/venture.json` — stage, status, constraints, gate inputs
- `venture/evidence.jsonl` — evidence ledger (E3 sources, all URL-verified)
- `venture/00_gap_ledger.jsonl` — gap ranking from industry scan
- `venture/00_industry_gaps.md` — full industry gap analysis
- `venture/01_landscape.md` — competitive landscape
- `venture/01_market_model.md` — bottom-up market model
- `venture/01_channels.md` — named acquisition channels
- `venture/01_regulatory.md` — regulatory analysis (no blockers)
- `venture/02_investment_memo.md` — Stage 2 gate decision *(pending)*

---

*Founder: interior designer and 3D modelling expert (V-Ray) based in Benelux*
*Budget ceiling: €5,000 | Stage: 1 complete → Gate pending*
