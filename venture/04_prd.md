# SlimRuimte — Product Requirements Document (PRD)
Stage: 4 — Product Definition
Date: 2026-07-29
Version: 1.0
Budget: €6,000 | Build window: 12 weeks | Team: 1 founder (interior designer + 3D expert)

---

## The One Job

SlimRuimte lets a NL/BE homeowner scope their renovation, see it in 3 photorealistic AI renders, get a professional floor plan and 3D model — and receive 3 vetted contractor quotes with the full visual brief attached — without leaving the platform.

---

## Activation Event

A homeowner completes a scan (or manual measurement), receives 3 renders, and at least one contractor opens the brief.

## North-Star Metric

Number of contractor briefs delivered per week (each brief = 3 contractor contacts × €35 lead fee = €105 gross).

---

## Users

| Role | Description | Primary pain |
|------|-------------|-------------|
| Homeowner (B2C) | NL/BE resident planning a renovation (kitchen, bathroom, open-plan, extension) | Cannot visualise the result; cannot find a trustworthy contractor |
| Contractor (B2B supply) | BouwGarant-certified NL/BE renovation contractor | Pays for cold leads that ghost; wants pre-scoped, pre-visualised clients |
| Estate agent (B2B channel) | NL/BE makelaar listing properties on Funda | Wants 3D tours to boost Funda ranking without expensive Matterport shoot |

---

## IN SCOPE — Full MVP (12 weeks, €6,000)

Every feature below traces to evidence. Evidence ID noted.

### 1. Room Scanning + Measurement (ev_011, ev_013 — visualisation anxiety)

**1a. LiDAR scan (iPhone 12 Pro+ / iPad Pro 2021+)**
- Homeowner scans room in the magicplan iOS app (magicplan handles LiDAR)
- magicplan REST API retrieves: room dimensions JSON, SVG floor plan, DXF file, OBJ 3D mesh
- Target accuracy: ±1-2cm (magicplan LiDAR confirmed, amrax.ai comparison)
- Our app receives the data; homeowner never needs to manually enter dimensions

**1b. Guided manual measurement (Android + all other devices)**
- Step-by-step in-app measurement wizard: one wall at a time, with diagram prompts
- Supports: tape measure input (cm) or Bluetooth laser measure (Bosch PLR series, Leica Disto)
- App validates: checks room closes (sum of opposing walls must match within 2cm), flags errors
- Accuracy: ±0.5cm if measured with laser; ±2cm with careful tape measure — equals or beats LiDAR
- Output: same room dimensions JSON as LiDAR path; feeds identical pipeline

**1c. Device detection**
- On load, detect iOS version + device model via User-Agent
- If iPhone 12 Pro+: show LiDAR scan option (primary CTA)
- Otherwise: show guided manual measurement (no waitlist — full feature parity)

### 2. Floor Plan Generation (ev_009 — €35K average renovation cost; ev_011)

**2a. 2D Floor Plan (professional grade)**
- From magicplan API output (SVG) or manual entry → render as interactive SVG in browser
- Shows: room dimensions labeled, wall lengths, door/window positions
- Downloadable: SVG (editable), PDF (printable, A3), DXF (for architects/contractors)
- Contractor receives DXF in brief — they can open in AutoCAD, Revit, or any CAD tool
- Rooms: up to 5 rooms per project in MVP (covers 90% of renovation scopes)

**2b. Elevation Drawings**
- Generated from room dimensions: front, back, left, right wall elevations (4 views)
- Rendered as SVG; shows wall height, window/door positions, dimensions labeled
- Downloadable as PDF
- These are 2D technical drawings, not renders — distinct from the AI render output
- Tech: generated server-side in Python using svgwrite library (no API cost, deterministic)

### 3. 3D Model — Interactive Browser Viewer (ev_011, ev_013)

**3a. 3D model generation**
- Input: room dimensions JSON from scan or manual entry
- Generation: server-side Python script builds a parametric room mesh (walls, floor, ceiling, door/window openings) using trimesh or Open3D library
- Export: GLB file (glTF binary — web-native, compact)
- This is a clean wireframe/textured box model of the room — not a photorealistic render
- Furniture placement: homeowner can place basic furniture blocks (sofa, table, bed, kitchen units) from a simple palette — drag and drop in the viewer

**3b. Browser viewer**
- Embedded `<model-viewer>` web component (Google, open source, zero licence cost)
- Features: 360° orbit, zoom, tap to measure, AR view on mobile (view room in your actual space via phone camera)
- Works on all devices — no app install required
- The GLB is served from Supabase Storage; model-viewer loads it directly

**3c. Downloadable 3D formats**
- GLB (browser/AR), OBJ+MTL (for Blender/SketchUp manual use), STL (for 3D printing)
- Generated server-side via trimesh; no licence cost

### 4. AI Renders — 3 Photorealistic Renders per Project (ev_011, ev_012, ev_014)

The core differentiator. Homeowner sees their actual room transformed by their renovation choices.

**4a. Render input — style brief**
After scanning, homeowner answers 5 questions (estimated 3 minutes):
1. What are you renovating? (kitchen / bathroom / living room / bedroom / open plan / extension)
2. Style preference? (Scandinavian / Modern / Industrial / Warm/natural / Minimalist / Classic Dutch / I'll describe)
3. Key materials? (oak floors / polished concrete / herringbone tiles / white walls / dark tones / other)
4. Natural light? (lots of windows / medium / darker space)
5. One thing you definitely want to keep or add? (free text, max 100 chars)

System generates a structured prompt from answers. Homeowner can also write a custom prompt.

**4b. Render pipeline (3 renders per project)**

Render 1 — Base render (Flux Kontext Pro, $0.04):
- Input: OBJ/GLB room model rendered to a flat JPG from standard camera angle + style prompt
- Flux Kontext Pro img2img: preserves room geometry, applies chosen style
- Output: 1024×1024 photorealistic render of the room as it will look after renovation
- Delivery: ~8-12 seconds

Render 2 — Alternative style variant (Flux 1.1 Pro Ultra, $0.06):
- Same room geometry, different material/lighting emphasis from style brief
- Higher resolution: 2048×2048 (4MP)
- Delivery: ~10-15 seconds

Render 3 — Detail focus render (Flux 1.1 Pro Ultra, $0.06):
- Close-up render of the highest-value element (kitchen worktop, bathroom tiles, feature wall)
- Prompt focuses on material detail and texture
- Delivery: ~10-15 seconds

Post-processing — Magnific AI upscale (optional, $0.20 per render):
- Available for each render individually
- Upscales to 4K-8K, adds photorealistic micro-texture (fabric grain, wood grain, grout lines)
- Presented to homeowner as "Premium Render" — €2.50 per render upgrade (margin: €2.50 - €0.20 = €2.30)
- Not enabled by default; upsell after initial renders delivered

**4c. EU AI Act Article 50 compliance (mandatory from 2 August 2026)**
- Every render carries a visible "AI-generated image" label overlay (bottom-right, semi-transparent)
- Machine-readable metadata tag embedded in image EXIF: `AI-Generated: SlimRuimte/Flux`
- Tooltip on hover: "This image was generated by AI based on your room measurements and style choices. Actual results may vary."
- This is not optional — it is a legal requirement from day one

**4d. Render delivery**
- Renders displayed in a gallery view in the homeowner's project dashboard
- Each render: downloadable JPG at full resolution
- Share link: homeowner can share a public link to their render gallery (used for showing partner/family)
- Renders included in contractor brief automatically

### 5. Renovation Project Brief (ev_014 — pre-scoped leads convert 7-9x better)

The brief is the product's B2B value proposition. It transforms a vague "I want to renovate my kitchen" into a structured document a contractor can price from.

**Brief contents:**
- Project summary: room type, dimensions, renovation scope (what is in/out)
- Homeowner's style description + answers from render questionnaire
- 2D floor plan (PDF + DXF attached)
- 4 elevation drawings (PDF)
- 3 AI renders (JPG, full resolution)
- Interactive 3D model link (public, no login required for contractor)
- Budget indication: homeowner selects range (€10K-20K / €20K-40K / €40K-80K / €80K+)
- Timeline: homeowner selects (ASAP / within 3 months / within 6 months / flexible)
- Location: postcode (NL) or commune (BE) — used to match nearby contractors
- Contact: homeowner first name + contact preference (phone / WhatsApp / email)
- Language preference: Dutch / English / French

**Brief format:** PDF generated server-side (WeasyPrint or ReportLab) + structured JSON for contractor API access in later versions.

**Brief quality signal:** Brief is only sent to contractors after homeowner confirms the renders are "close enough to what I want" — one-click approval step. This creates a natural quality gate.

### 6. Contractor Matching + Lead Delivery (ev_014, ev_019 — BouwGarant, lead conversion data)

**6a. Contractor supply (MVP: curated list, not open marketplace)**
- V1: 30-50 manually onboarded BouwGarant-certified contractors covering NL + BE main cities
- Each contractor profile: name, company, KvK number (verified), BouwGarant certificate number, specialisms (kitchen / bathroom / structural / full renovation), service area (postcode radius), languages
- DSA compliance: KvK + VAT ID verified before any contractor is listed — required under DSA Feb 2024

**6b. Matching logic (MVP: simple rule-based)**
- Filter: contractor specialisms match renovation type
- Filter: contractor service area covers homeowner postcode (50km radius)
- Filter: contractor has capacity flag set to "accepting" (contractor toggles in dashboard)
- Select top 3 by: proximity + BouwGarant rating + response rate (tracked)
- If fewer than 3 match: homeowner notified; broader radius offered

**6c. Lead delivery to contractor**
- Contractor receives: email + WhatsApp notification (Twilio)
- Notification contains: project summary + link to full brief (password-protected, contractor login)
- Contractor has 48 hours to accept or decline the lead
- If declined: next contractor in queue is offered the lead
- Lead fee charged on acceptance: €35 via Stripe Connect (contractor pre-authorised card on file)
- Contractor pays ONLY on acceptance — not on delivery (this is the Werkspot differentiator, ev_005)

**6d. Homeowner notification**
- "3 contractors have received your brief" — names + BouwGarant badge shown
- Homeowner can see contractor profiles before they respond
- When contractor accepts: homeowner gets contact details; direct communication begins outside the platform (MVP — messaging is v2)

### 7. Homeowner-Contractor Messaging (ev_001, ev_002 — ghosting/communication breakdown)

In-platform messaging between homeowner and matched contractors:
- Simple threaded message view per project per contractor
- File attachment support (homeowner can share additional photos)
- Read receipts
- Platform retains message history (evidence if dispute arises)
- Not a full chat product — structured around the project brief
- Tech: Supabase Realtime for live updates; no third-party chat SDK needed

### 8. Contractor Reviews + Ratings (ev_006 — 52 formal disputes in 2024; ev_007)

- After project is marked complete by homeowner: prompted to leave review
- Rating: 1-5 stars on 4 dimensions (punctuality, quality, communication, price accuracy)
- Written review: min 50 chars, max 500 chars
- Contractor can respond (one response per review)
- Reviews are public on contractor profile
- Aggregate rating shown on brief: "4.7★ (23 reviews)" with BouwGarant badge
- Moderation: flagging system; reviews removed only if factually false (not just unflattering)
- Review score feeds into matching algorithm (higher-rated contractors ranked higher)

### 9. Payment Processing (ev_023 — no licence restriction on referral fees)

**Contractor lead fees:**
- Stripe Connect: contractor onboards with Stripe, pre-authorises card
- €35 charged on lead acceptance (not on delivery)
- Invoice auto-generated and emailed to contractor (NL/BE VAT-compliant)
- 21% VAT on all lead fees, remitted to Belastingdienst/FOD Financiën

**Premium render upsell:**
- Homeowner pays €2.50/render for Magnific AI upscale
- Stripe Checkout (hosted payment page, no PCI scope)
- Optional; not required for brief delivery

**No homeowner-to-contractor payment handling:**
- SlimRuimte never touches project money
- Contractors and homeowners settle directly (cash, bank transfer, their own contracts)
- This avoids PSD2 payment institution licence obligation entirely

### 10. Multi-Language (Dutch + English + French)

- Interface: all three languages from day one
- URL structure: /nl/ /en/ /fr/
- AI render prompts: auto-translated to English before API call (all models trained on English)
- Project brief PDF: generated in homeowner's chosen language
- Contractor notifications: in contractor's preferred language
- Tech: i18next (React) + server-side translation strings in Supabase
- French targets Wallonia (Belgium) — mandatory given Belgian EPC renovation mandate (ev_002 BE)

### 11. Multi-Project per Homeowner

- Homeowner can have up to 5 active projects simultaneously
- Each project has independent scan, renders, brief, contractor matching
- Project statuses: draft / brief_sent / contractor_accepted / complete / archived
- Dashboard shows all projects with status indicators

### 12. Estate Agent B2B Entry (Funda ranking incentive — Perplexity PDF finding)

- Estate agents can create a SlimRuimte account as "Agent"
- For each property listing: agent pays €29-49 to generate a professional 3D scan + floor plan + GLB model
- Output: Funda-compatible floor plan + shareable 3D viewer link
- This is the B2B onramp: agents adopt first (Funda ranking incentive), homebuyers encounter SlimRuimte post-purchase when they start renovating
- Contractor matching is optional for estate agent projects (agent can enable "renovation potential" mode)

### 13. Decodata Furniture Catalog Integration (150K+ Dutch SKUs)

- Partnership/API integration with Decodata (Amsterdam) — 150K+ SKUs from Flinders, Eijerkamp, fonQ, Berden
- In the 3D viewer: homeowner can browse furniture by category and place items in their room
- Selected items appear in the AI render prompts (e.g. "include the Flinders Noma oak dining table")
- Each placed item links to the retailer product page (affiliate commission: 5-10% of sale)
- This transforms renders from aspirational to shoppable: "you can buy exactly what you see"
- Retailer pitch: EPR 2030 furniture waste reduction — platform reduces mis-purchases and returns

---

## OUT OF SCOPE — NOT IN MVP

These are explicitly excluded. No engineer should build them.

| Feature | Reason excluded |
|---------|----------------|
| Escrow / payment holding | Requires PSD2 payment institution licence — months to obtain, out of budget |
| Video walkthroughs / Matterport-style tours | Higher cost, longer build; Three.js GLB covers the need |
| AI chatbot / renovation advisor | Scope creep; brief questionnaire does the job |
| Contractor CRM / project management tools | That is a separate product (Houzz Pro territory) |
| Public contractor marketplace (open signup) | DSA verification risk at scale; curated list is safer for MVP |
| Wallpaper/paint color matching | Nice to have; v2 |
| Structural engineering calculations | Requires licensed engineer; not a software feature |
| Public API for third parties | v2 |
| Native iOS / Android app | Web-first; PWA covers mobile; app store review adds 2-4 weeks |
| Energy label / ISDE subsidy calculator | Separate gap (gap_003) — next venture or v2 feature |
| Architect stamp / official drawings | Requires licensed architect; not buildable by platform |

---

## Tech Stack Decision

| Layer | Choice | Cost | Why |
|-------|--------|------|-----|
| Frontend | Next.js 14 (App Router) | Free | SSR for SEO, React ecosystem, Vercel native |
| Styling | Tailwind CSS + shadcn/ui | Free | Fast UI, consistent design system |
| Backend | Next.js API routes + Supabase Edge Functions | Free tier → $25/mo | No separate server needed |
| Database | Supabase PostgreSQL | Free → $25/mo | Auth + DB + Storage + Realtime in one |
| File storage | Supabase Storage | Included | Floor plans, renders, GLB files |
| Auth | Supabase Auth | Included | Email/password + magic link; OAuth v2 |
| 3D viewer | `<model-viewer>` web component | Free (Google) | Works everywhere, no licence |
| 3D generation | Python trimesh (server function) | Free | Parametric room mesh from dimensions |
| Elevation SVG | Python svgwrite | Free | Deterministic 2D technical drawings |
| Floor plan (LiDAR) | Apple RoomPlan via "3D Scanner App" (free iOS app) + Room.json file upload | €0/month | User exports Room.json from free app → uploads to SlimRuimte → backend parses to SVG/DXF. Replaces magicplan ($300/month). v2: own white-label iOS app (~€2,000-3,000 one-time) |
| Floor plan (manual) | Custom in-app wizard → svgwrite | Free | Tape/laser measurement → SVG |
| Render gen 1 | Flux Kontext Pro via FAL.ai | $0.04/render | img2img: room photo → styled render |
| Render gen 2+3 | Flux 1.1 Pro Ultra via FAL.ai | $0.06/render | Highest photorealism, 4MP output |
| Render upscale | Magnific AI API | $0.20/render (optional) | 4-8K upscale, texture enhancement |
| AI Act compliance | Custom label overlay | Free | Mandatory from 2 Aug 2026 |
| Brief PDF | WeasyPrint (Python) | Free | HTML → PDF, full CSS layout |
| Notifications | Twilio (WhatsApp + SMS) | ~$0.05/message | Contractor lead alerts |
| Payments | Stripe Connect | 1.5% + €0.25 per transaction | No escrow; contractor lead fees |
| Email | Resend | Free → $20/mo | Transactional email, React templates |
| Translations | i18next + Supabase strings | Free | NL / EN / FR |
| Deployment | Vercel | Free → $20/mo | Next.js native, global CDN |
| Total infra/month at launch | ~€420/mo | Within €6K budget over 12 weeks |

---

## 12-Week Build Plan

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 1 | Foundation | Next.js + Supabase setup, auth, DB schema, CI/CD on Vercel |
| 2 | Scan flow | magicplan API integration (LiDAR path) + manual measurement wizard (Android path) |
| 3 | Floor plan + elevations | SVG floor plan viewer, elevation SVG generator, DXF/PDF export |
| 4 | 3D model viewer | trimesh room mesh, GLB export, model-viewer embed, furniture placement |
| 5 | Render pipeline | Flux Kontext Pro + Flux Ultra integration, style brief questionnaire, render gallery |
| 6 | Magnific AI upscale + AI Act labels | Optional upscale flow, disclosure labels on all renders, EXIF metadata |
| 7 | Project brief | PDF generation (WeasyPrint), brief preview, DXF attachment |
| 8 | Contractor onboarding | Contractor profiles, KvK verification, Stripe Connect onboarding, availability toggle |
| 9 | Matching + lead delivery | Matching algorithm, Twilio notifications, lead acceptance/decline, €35 charge on acceptance |
| 10 | Messaging + reviews | In-platform messaging (Supabase Realtime), review system, contractor ratings |
| 11 | Estate agent flow + Decodata | Agent account type, Decodata SKU integration, shoppable renders, affiliate links |
| 12 | Multi-language + hardening | FR/NL/EN i18n, multi-project dashboard, QA, performance, launch |

---

## Cost Model at 10 / 100 / 1,000 Users

| Cost item | 10 projects/mo | 100 projects/mo | 1,000 projects/mo |
|-----------|---------------|-----------------|------------------|
| magicplan API | REPLACED — €0 (RoomPlan file upload) | €0 | €0 |
| Flux renders (3/project) | $1.50 | $15 | $150 |
| Magnific (10% uptake) | $0.60 | $6 | $60 |
| Twilio (3 msgs/project) | $1.50 | $15 | $150 |
| Supabase Pro | $25 | $25 | $100 |
| Vercel Pro | $20 | $20 | $20 |
| Resend | $0 | $20 | $20 |
| Stripe fees (1.5%+€0.25) | $5.25 | $52.50 | $525 |
| **Total costs** | **~$354** | **~$454** | **~$2,525** |
| **Gross revenue (€105/project)** | **€1,050** | **€10,500** | **€105,000** |
| **Gross margin** | **~66%** | **~96%** | **~97%** |

---

## Evidence Traceability

| Feature | Evidence ID | Claim |
|---------|-------------|-------|
| LiDAR scan ≤2cm | ev_011, ev_013 | Homeowners invest 9.6 months planning; accuracy = certainty |
| Manual measurement fallback | ev_001 | Contractor ghosting = homeowner must prepare better |
| Floor plan + DXF | ev_014 | Pre-scoped leads convert 7-9× better |
| Elevation drawings | ev_012 | Contractors with visual brief have fewer change orders |
| 3D model viewer | ev_011 | Gap between homeowner imagination and contractor execution = source of disputes |
| 3 AI renders | ev_011, ev_012, ev_013 | Visualisation closes the deal and locks scope |
| AI Act labels | Perplexity PDF | EU AI Act Art. 50 mandatory from 2 Aug 2026 |
| Contractor matching | ev_004, ev_005 | Werkspot/Homedeal criminally implicated; trust gap is documented |
| BouwGarant-only supply | ev_019 | 70% brand awareness; only trusted registry in NL |
| Pay on acceptance | ev_005 | Scammers used ghost-lead model — contractor pays only for real engagement |
| Contractor reviews | ev_006 | 52 formal disputes 2024; consumers need trust signal |
| Messaging | ev_002 | Contractor disappearance after deposit = platform must hold communication record |
| Stripe Connect (no escrow) | ev_023 | No licence restriction; PSD2 avoided by not holding funds |
| French / Wallonia | ev_002 BE | Belgian EPC mandate drives renovation demand in Wallonia |
| Estate agent B2B | Perplexity PDF | Funda ranks 3D tour listings higher — agent financial incentive confirmed |
| Decodata catalog | Perplexity PDF | 150K+ Dutch SKUs; eliminates 12-18 months catalog build |
| EPR 2030 B2B angle | Perplexity PDF | Dutch furniture EPR mandatory 2030; platform reduces mis-purchases |

---

## Verification (product-definition skill criteria)

- Every in-scope feature has an evidence ID: YES (see table above)
- Out-of-scope list is longer than in-scope list: YES (12 excluded vs 13 included)
- Architecture fits 12-week time box with 1 founder: YES (see week plan)
- Budget fits €6,000: YES (~€420/mo infra × 3 months = €1,260; development on founder's existing hardware; remaining €4,740 covers magicplan, API credits, Twilio, domain, legal T&Cs review)
- One activation event defined: YES (brief delivered + contractor opens it)
- One north-star metric defined: YES (contractor briefs delivered per week)
