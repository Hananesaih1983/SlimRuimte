# SlimRuimte — Stage 1 Landscape (NL/BE)
Date: 2026-07-29 | Evidence ceiling: E3 | Stage: 1

## Core Hypothesis (falsifiable)

NL/BE homeowners planning a renovation cannot find trustworthy contractors and cannot visualise the outcome before committing — and a platform that delivers both (free AI 3D renders + scoped brief → matched to 3 vetted contractors who pay for the enriched lead) will outcompete cold-lead marketplaces (Werkspot, Homedeal, Bobex) on lead quality and outcompete pure visualisation tools (Floorplanner, Planner5D) on conversion to revenue.

This hypothesis is false if: (a) contractors will not pay a premium for pre-scoped visual leads over cold leads, or (b) homeowners will not use a free 3D tool in sufficient numbers to generate lead volume.

---

## Problem Evidence (E3)

### Contractor Trust — Confirmed Broken (NL + BE)

1. Ghosting is systemic: r/Nederlands verbatim (ev_001): "6 aannemers gevraagd voor een indicatie... Nul antwoorden!" — 6 contractors approached, zero replies, not even acknowledgement. Unprompted, high-upvote post.

2. Fraud is institutionalised: Rotterdam court verdict June 2025 (ev_004, ev_005, ECLI:NL:RBROT:2025:7704): two convicted renovation fraudsters recruited specifically via Werkspot and Homedeal. 18-55+ named victims. €235,000 laundered. Court explicitly stated platforms were the hunting ground.

3. Belgium: €284,000 lost by Gent couple to bankrupt contractor, house uninhabitable (Instagram 2025, URL confirmed in search). Belgian forum comment (155 upvotes, ev_003): "The construction industry is a paradise for scammers... most end up bankrupt, leaving clients with empty wallets."

4. Institutional acknowledgement: Juridisch Loket (NL government legal body) maintains dedicated page "Problemen met aannemer, wat nu?" with template legal letters (ev_007). Vereniging Eigen Huis (800K members) maintains dedicated contractor-problems help page (ev_012 Stage 0). Consumentenbond advises "always get 3 quotes, pay max 10% upfront" (ev_010 Stage 0). These pages exist because the problem frequency justifies institutional response.

5. Dispute data: De Geschillencommissie Verbouwingen 2024: 52 formal disputes in one year, consumers won 89% (ev_006). Caveat: only BouwGarant-affiliated contractors — the vast majority of the market is outside this scheme.

6. Scale: ecobouwers.be Belgian forum (ev_008): #1 renovation problem = contractors who "make promises and repeatedly ghost." Contractor estimate accuracy: one respondent's architect was not 20% off but 100% — needed a new mortgage.

### 3D Visualisation — Desire Confirmed, Solution Absent (NL/BE)

7. Planning anxiety is the dominant pre-renovation behaviour: Houzz 2024 (32,615 respondents, ev_013): homeowners spend 9.6 months planning a kitchen renovation vs 5.1 months building it — nearly 2x longer planning. This time is spent seeking certainty about outcome.

8. Industry confirmation that 3D removes uncertainty and closes deals (ev_011, ev_012): Cedreo (contractor software): "That gap between what you see in your head and what the client sees is where deals die... fear of regret kicks in... they delay or go to a competitor who made the project feel less risky." And: "Contractors who present a detailed rendering deal with significantly fewer mid-project changes."

9. Cost overrun is the feared outcome driving planning anxiety: Brinqs.nl (ev_010): "Always budget 15% extra — surprises almost always surface." ecobouwers.be: architect's estimate was 100% off, required new mortgage. Average NL renovation: €35,000 (ev_009) — a 15% overrun = €5,250 unbudgeted.

10. Dutch consumers are already manually doing what the tool would automate: Tweakers GoT forum (Stage 0, ev_006 Stage 0): "3D tekening van Funda zelf bewerken — zou handig zijn om gewenste verbouwingen van te voren te visualiseren" — tech-savvy Dutch consumers hacking Funda floor plans to preview renovations because no tool does this natively.

### Pre-Scoped Leads Outperform Cold Leads — Structural Advantage Confirmed

11. Lead quality data (ev_014): pre-screened scoped leads convert at 70-90% vs 5-20% for shared platform leads. Pre-screened outperform by 7-9x. This is the structural argument for why contractors will pay €35 for a visualised, scoped lead vs €15-20 for a Werkspot cold click.

12. Houzz Pro confirms the model: its "white-glove concierge introductions" (pre-screened, project-context leads) are the explicit premium tier — contractors pay more and get better conversion.

---

## Competitive Landscape

### Direct Competitors (combined visualisation + contractor matching in NL/BE): NONE

Block Renovation (US, ev_015): the only global proof-of-concept — AI visualiser + scoped brief + 3 vetted contractors + payment protection. US-only, zero EU presence. This is the model.

### Partial Competitors — Contractor Matching Only (no visualisation)

| Platform | Market | Model | Scale | Key Weakness |
|----------|--------|-------|-------|--------------|
| Werkspot | NL | Pay-per-lead regardless of outcome | ~39K contractors | Ghost-lead problem confirmed; used by scammers (court verdict) |
| Homedeal | NL | Lead-based, 364K orders/yr | 5,400 contractors | Same ghost-lead economics, no scoping or verification |
| OfferteAdviseur | NL | Cost calculators + lead gen | 200K+ requests | No 3D, no contractor vetting |
| Bobex | BE | #1 Belgium, 26yr, 35K+ req/mo | Belgium-dominant | No 3D, commodity lead model |
| TrustUp | BE | 26,649 professionals, free model | Belgium | No visualisation, no premium tier |
| RenovSmart | BE | AI text-matching | Newer | Zero 3D, text-only matching |
| Bark.com | NL/BE | Global lead gen, marginal NL presence | Global | Not NL/BE-native, no 3D |

### Partial Competitors — Visualisation Only (no contractor matching)

| Tool | Users | Key Weakness |
|------|-------|--------------|
| Floorplanner (Rotterdam) | 50M plans (marketing claim) | No AI, no photo-based analysis, no contractor connection |
| Planner5D | 79M users | Generic, not renovation-workflow, no NL/BE contractors |
| IKEA Kreativ | IKEA shoppers | CRITICAL: scan accuracy "over 97%" with 6cm margin of error. IKEA explicitly tells users NOT to use it for kitchens/bathrooms — its own admission of failure in the highest-value segment. IKEA NL: €1.66B revenue FY2025, 33% online |
| CamPlan AI | Unknown NL/BE scale | LiDAR → 2D/3D floor plans in <3min, claims "centimeter-accurate." No rendering, no contractor matching, no product catalog. Direct accuracy positioning competitor — monitor for NL/BE distribution |
| RoomSketcher | Global | No NL/BE renovation workflow, no contractor connection |
| ReimagineHome.ai | Global | Photo-to-AI-render, contractor sharing but no marketplace |
| 360profit (Matterport reseller) | Estate agents | Professional-grade 3D tour + floor plan at €395-999/property, ±5cm accuracy, publishable on Funda/Jaap/Pararius. Establishes the professional-grade price ceiling we sit 25-50x below |
| Wisual.ai | NL/BE | Virtual staging, EU-hosted/GDPR-compliant, explicitly does not scan or measure rooms |
| Ideal.house | NL | AI virtual staging for Funda listings, no dimensional accuracy, no contractor matching |
| TopVastgoedFoto | NL | AI restyle, Funda-ready photos, €19/month — purely aesthetic, no dimensions |

### Adjacent NL/BE Startups (wrong stage or partial)

| Company | What it does | Why it's not a direct competitor |
|---------|-------------|----------------------------------|
| Renno NL (€1M seed) | Milestone escrow payments for renovation | Solves payment risk AFTER contractor is found; no discovery, no 3D |
| SCOPR.ai BE (€2M+) | AI analysis for BE homebuyers pre-purchase | Wrong stage (pre-purchase, not post-purchase renovation planning) |
| Struck NL (€2M seed) | AI building compliance for architects/municipalities | B2B, not consumer-facing |
| Setle BE (€1.5M KBC) | Renovation cost estimation for estate agents; 425+ agents | Adjacent Belgian comparable — same agent workflow, could expand; watch for product expansion into visualisation or matching |
| Decodata Amsterdam (€700K angel) | Interior product-data infrastructure; 150,000+ SKUs from Flinders, Eijerkamp, fonQ, Berden | KEY PARTNER CANDIDATE (not competitor). Integration API exists. Partnering gives real purchasable Dutch furniture SKUs for 3D renders immediately — avoids 12-18 months of catalog-building. Also opens B2B retailer channel via their existing client base |

### Substitute Behaviours (what homeowners actually do instead)

- Word-of-mouth referrals: 61% trust (Leaf Home/Morning Consult 2026). Primary method — but non-scalable, exclusionary (requires social network with renovation experience)
- Facebook groups ('Klussen en Verbouwen', 'Klusser gezocht NL'): active, hundreds of thousands of members combined — unstructured, no vetting
- Reddit r/Klussers (246K members): frequent "aannemer gezocht" posts — community-advised WOM
- Google Maps + reviews: 56% of homeowners use (ACHR 2024) — no scoping, no visualisation
- WhatsApp neighbourhood groups: widely used, zero verification
- Architect-led design+build: expensive (€100-200/hr), only viable for €100K+ projects

**The incumbent is word-of-mouth. The platform wins by making WOM-quality trust accessible to homeowners without the social network.**

---

## 7 Things Nobody in NL/BE Does (the uncontested space)

1. AI photorealistic before/after render from the homeowner's own room photo
2. Scoped project brief auto-generated from visual + questionnaire (materials, budget, timeline)
3. Contractors receiving visual-enriched leads (renders + scope + budget) instead of a name and phone number
4. Premium curated lead model — contractor pays only when receiving a pre-qualified, pre-visualised lead
5. Free consumer-facing AI renovation visualisation with no IKEA/product lock-in
6. Integration of NL ISDE / BE Mijn VerbouwPremie subsidy calculation into the scoping flow
7. Combined NL+BE cross-border platform with one contractor pool

---

## Regulatory Summary (see 01_regulatory.md for full detail)

- No licence required to operate a lead referral/marketplace in NL or BE
- DSA (Feb 2024): must verify contractor identity (KvK/VAT ID) before listing — Know-Your-Business obligation
- GDPR/AVG: home photos + floor plans = personal data; legal basis = contract performance (Art. 6(1)(b)); no escrow = no PSD2 licence
- VAT: 21% on SaaS and lead referral fees in both countries
- KvK registration: €85.15 one-time. No sector-specific construction licence needed for the platform
- Marketplace not liable for contractor work quality (bemiddelaar under BW Boek 6) as long as vetting claims are precise, not absolute
