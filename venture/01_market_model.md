# SlimRuimte — Stage 1 Market Model (NL/BE)
Date: 2026-07-29 | All assumptions explicitly labelled A (tier A) or E3

## Bottom-Up Sizing

### Step 1: Renovation Event Pool

| Input | Value | Source / Tier |
|-------|-------|---------------|
| NL total households | 8,340,000 | CBS StatLine / E3 (updated from Perplexity PDF) |
| NL owner-occupation rate | 57.5% | CLO (Compendium voor de Leefomgeving) / E3 — revised down from 64% |
| NL owner-occupied households | 4,795,500 | derived |
| NL renovation rate (65% in 5yr = ~13%/yr) | 13%/yr | Brinqs.nl E3 |
| NL renovation events/yr | ~623,000 | derived (-10.2% vs prior; owner base smaller) |
| BE total households | 5,200,000 | CBS/Statbel 2024 / E3 |
| BE owner-occupation rate | 72% | E3 (Statbel) |
| BE owner-occupied households | 3,744,000 | derived |
| BE renovation rate | 12%/yr | Tier A — no BE-specific source |
| BE renovation events/yr | ~449,000 | derived |
| **TOTAL Benelux renovation events/yr** | **~1,072,000** | derived (NL revised down) |

### Step 2: Addressable Subset

| Filter | Rate | Result | Tier |
|--------|------|--------|------|
| Use digital channels to find contractors | 45% | ~517,000/yr | A — inferred from Werkspot+Homedeal combined volume |
| Platform capture Y1 (0.5% of digital pool) | 0.5% | ~2,583 projects | A — no comparable launch benchmark |
| Platform capture Y3 (2.5% of digital pool) | 2.5% | ~12,917 projects | A |

Sanity check: Werkspot + Homedeal combined handle ~700,000+ NL+BE quote requests/year. Capturing 2,583 in Y1 = 0.37% of their combined volume. Realistic.

### Step 3: Revenue Model

| Item | Value | Tier |
|------|-------|------|
| Lead fee per contractor | €35 | A — 2x Werkspot cold lead; unvalidated |
| Contractors matched per project | 3 | A — industry norm (Houzz uses 3-5) |
| Gross revenue per homeowner project | €105 | derived |
| Y1 gross revenue (~2,415 projects) | €253,000 | derived (revised ownership base) |
| Y3 gross revenue (~12,075 projects) | €1,268,000 | derived |

Secondary revenue streams (not included in base model):
- Affiliate commissions on materials/products linked from renders (5-10% of basket)
- Premium contractor subscription (€49/month for top placement + analytics) — additive
- ISDE/subsidy calculator referral fees (€15-50/lead to energy contractors) — additive

### Step 4: Cost Model (€5,000 Budget)

| Cost | Monthly | Notes |
|------|---------|-------|
| Vercel Pro + Supabase Pro | €80 | Infra — covers auth, DB, storage, edge |
| AI costs (GPT-4o vision + Flux renders) | ~€32 at Y1 volume | €0.15/project — E3 (Flux API pricing confirmed) |
| Domain + KvK registration | €285 one-time | |
| First 3-month paid acquisition test | €500 | Reddit Ads + Google Ads |
| **Total 6-month burn** | **~€1,374** | |
| **Budget remaining** | **~€3,626** | Buffer for freelancer, legal T&Cs, or first Batibouw stand |

### Step 5: Unit Economics at Scale

| Metric | Y1 | Y3 |
|--------|----|----|
| Projects/month | 215 | 1,076 |
| Gross revenue/month | €22,600 | €113,000 |
| AI + infra costs/month | ~€112 | ~€242 |
| Gross margin | ~99.5% | ~99.8% |
| CAC (estimated, organic-first) | A — unvalidated | target <€15/homeowner |

Note: CAC is the key unknown. Organic channels (r/Klussers, SEO on "aannemer vinden", Eigenhuis.nl partnership) must be validated before any paid spend above €500.

## Key Assumptions — All Named

| # | Assumption | Tier | What would falsify it |
|---|-----------|------|-----------------------|
| A1 | NL renovation rate 13%/yr | E3 (Brinqs.nl) | CBS household survey showing lower rate |
| A2 | BE renovation rate 12%/yr | Tier A | No BE-specific source found |
| A9 | NL rental households now 42.4% (3.54M) — larger than previously modelled | E3 (CLO via Perplexity PDF) — strengthens gap_004 (renter service) addressable market |
| A3 | 45% of renovators use digital channels | Tier A | NL/BE contractor discovery survey |
| A4 | Platform captures 0.5% in Y1 | Tier A | No NL/BE marketplace launch comparable |
| A5 | Contractors pay €35/pre-scoped lead | Tier A | Must be validated in Stage 2 (E2 — named contractor saying yes or no) |
| A6 | 3 contractors per homeowner project | Tier A | Industry norm; confirm with 5 contractor interviews |
| A7 | Free consumer tool drives sufficient volume | Tier A | CAC and activation rate unknown until MVP live |
| A8 | AI render cost €0.15/project | E3 (Flux API, GPT-4o pricing) | API pricing changes |

## Critical Question for Stage 2

A5 is the make-or-break assumption. The entire revenue model rests on contractors paying €35 for a pre-visualised, pre-scoped lead. Stage 2 must produce an E2 (named contractor, on record) confirming willingness to pay this premium — or the pricing model must be revised.

Null hypothesis: contractors perceive all digital leads the same and will not pay more for a scoped/visualised lead over a Werkspot cold lead.
