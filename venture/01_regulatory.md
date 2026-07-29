# SlimRuimte — Stage 1 Regulatory (NL/BE)
Date: 2026-07-29 | Evidence tier noted per claim

## Summary: No Blocking Regulation. Five Compliance Obligations.

Operating a lead referral marketplace with AI visualisation in NL+BE requires no sector licence. Five obligations apply from day one: DSA identity verification, GDPR/AVG for home photos, EU AI Act Article 50 render disclosure, VAT registration, and privacy-by-design for room scans.

---

## 1. Platform / Marketplace Licence

NL + BE: No licence is required to operate a lead referral or contractor matching platform. The platform is a bemiddelaar (intermediary) under NL Burgerlijk Wetboek Boek 6 and the equivalent Belgian Code de droit économique. E3: business.gov.nl confirms no construction-sector access regulation for intermediary platforms.

KvK registration: €85.15 one-time (NL). Required before invoicing. Belgian equivalent: Crossroads Bank for Enterprises (CBE) registration, similar cost.

---

## 2. Digital Services Act (DSA) — Active February 2024

Applies to: any online platform facilitating consumer–contractor transactions in the EU.
ACM (NL Authority for Consumers & Markets) supervises.

Key obligations:
- Know-Your-Business-User: verify contractor identity (KvK number, VAT ID, trade registration) before allowing them to list. Must store verification records.
- Transparency: publish T&Cs in plain language; explain ranking algorithm if one exists.
- Notice-and-action: must have a mechanism to receive and act on fraud reports within defined timelines.
- No dark patterns in the consumer UI.

Practical impact on €5K MVP: verification of KvK/VAT ID is a one-time API call (KvK API is free for basic lookups). Build this into contractor onboarding from day one. Cost: negligible. E3: digital-strategy.ec.europa.eu/en/policies/digital-services-act-package.

---

## 3. GDPR / AVG — Home Photos, Floor Plans, and Room Scans

Home photos, floor plans, and room scans linked to an identifiable property address = personal data under GDPR/AVG.

GDPR household exemption — does NOT apply: The GDPR Article 2(2)(c) household exemption (for purely personal/domestic use) disappears the moment scan or photo data is uploaded to our servers or used for model training. Do not plan compliance around this exemption. The AP has confirmed this boundary explicitly in IoT guidance. All uploaded home imagery is subject to full GDPR from the moment it leaves the user's device.

Additional AP warning (Perplexity PDF): The AP's IoT guidance specifically flags increased risk when a scanning device "also records data about people other than the user — housemates, neighbours, visitors" — which is inevitable in a wide-angle room scan. This requires explicit user notice about third-party capture and EU data handling.

Legal basis: Art. 6(1)(b) — performance of a contract. When a homeowner uploads photos to receive a renovation plan, the processing is necessary to perform the service they requested. Cleanest basis — no separate consent needed, no consent withdrawal risk.

Obligations:
- Privacy policy: plain-language, must describe what data is collected, how long retained, right to deletion
- Data processing agreement (verwerkersovereenkomst): required with every cloud provider (Vercel, Supabase, OpenAI, Flux API)
- Right to erasure (Art. 17): build a "delete my data" button — room scans deleted after project closes
- Data minimisation: do not retain scans beyond project completion
- EU data residency: treat as near-requirement for NL/BE market. Wisual.ai already advertises "EU servers, full GDPR compliance" as a selling point — match or exceed this
- DPIA: recommended at launch; mandatory when processing exceeds 10K users/month

Supervisory authority: AP (NL lead authority if main establishment is NL); GBA (BE).

E3: business.gov.nl/running-your-business/legal-matters/how-to-make-your-business-gdpr-compliant/

---

## 3b. EU AI Act — Article 50 Transparency Obligations (IMMINENT: 2 August 2026)

AI-generated or AI-manipulated visual content — including every room render this product produces — must be labelled as AI-generated at the point of consumer presentation. This is not a future compliance item.

Article 50 of the EU AI Act (Regulation 2024/1689) comes into force 2 August 2026. Our product generates AI-modified images of real homes. Before any user-facing demo or MVP launch, all render outputs must carry a machine-readable and human-visible disclosure label confirming the image is AI-generated. Failure to comply is a violation from day one of operation.

Positioning upside: A design output that is dimensionally verified and SKU-backed reads as a specification, not synthetic imagery — an easier position to defend under AI-content-labelling rules than pure aesthetic renders. Build disclosure labels in a way that reinforces accuracy positioning: "AI-generated, accurate to within 2cm."

Source: EU AI Act 2024/1689, Article 50; European Commission AI Act guidance.

---

## 4. Payment Handling — Avoid PSD2 Licence

Do NOT hold escrow or process payments between homeowner and contractor. This triggers Payment Institution licence obligations under PSD2 — a multi-month regulatory process incompatible with a €5K MVP.

Model instead: contractor pays the platform a referral fee directly via Stripe or Mollie. The platform never touches the homeowner-to-contractor money flow. Stripe Connect or Mollie Connect can be used to collect lead fees from contractors without holding client funds.

E3: Renno NL specifically built its escrow model because it chose to hold funds — this is why they needed VC backing and a more complex regulatory structure. We avoid this entirely. Tier A legal opinion — confirm with a Dutch commercial lawyer before launch.

---

## 5. Consumer Protection — Liability Scope

The platform is a bemiddelaar. It does not provide construction services. It is not liable for contractor workmanship under BW Boek 6 as long as:
- T&Cs clearly state the platform is an intermediary, not a party to the renovation contract.
- Vetting claims are precise and accurate (e.g. "KvK-verified" and "BouwGarant-certified" are verifiable facts), not absolute guarantees (e.g. do not promise "guaranteed quality work").
- The platform does not take a percentage of the construction contract value — only a fixed referral fee.

Tier A: legal opinion — confirm with a Belgian/Dutch commercial lawyer before launch. Budget: €300-500 for a one-hour commercial legal review of T&Cs.

---

## 6. VAT

NL: 21% VAT on SaaS subscriptions and lead referral fees. Register for BTW (NL VAT) via Belastingdienst once revenue reaches €20,000/yr (or immediately if serving B2B clients who need VAT invoices).

BE: 21% VAT on digital services and referral fees. One-stop-shop VAT registration (OSS) covers both NL and BE if the platform is registered in one EU country.

E3: business.gov.nl (VAT on digital services).

---

## 7. Contractor-Specific Regulations to Display (not platform obligations — informational)

Displaying these on contractor profiles builds consumer trust and differentiates from Werkspot:
- Wkb (NL, Jan 2024): for permit-requiring renovation projects, contractors need a Kwaliteitsborger (quality assurer). Flag in profile.
- BouwGarant/SNA certification: display prominently; non-certified contractors are visible but ranked lower.
- VAT number: required for all B2B transactions; verify and display on every contractor profile.

---

## Regulatory Risk Summary

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| DSA non-compliance (contractor not verified) | Medium | Medium — ACM enforcement | Build KvK verification into onboarding V1 |
| GDPR breach (home photos leaked) | Low | High — AP fine up to €20M | Supabase RLS + encryption at rest; delete photos after project close |
| PSD2 triggered by payment handling | Low (if Stripe/Mollie used correctly) | High — halts operations | Never hold homeowner-to-contractor funds |
| Liability for contractor fraud | Medium | High — reputational | BouwGarant-only in V1; precise T&C language |
| VAT registration delayed | Low | Low | Register on first B2B invoice |

No blocking regulation identified. Proceed to Stage 2.

---

## 8. Regulatory Tailwind — Dutch Furniture EPR (2030)

Dutch furniture waste: ~1 billion kg/year; only 10% recycled, 90% incinerated (Circonnect). Extended Producer Responsibility (EPR) for furniture is mandatory from 2030 under NL implementation of EU EPR framework.

Furniture retailers must demonstrate circular economy steps from 2030 onward. A platform that reduces impulse furniture purchases (by letting consumers visualise before buying, reducing returns and mis-purchases) is a direct EPR compliance argument for retailer partnerships.

B2B pitch angle for Decodata, Flinders, fonQ, Leen Bakker, Eijerkamp: "Our platform reduces furniture returns by showing customers exactly how items will look in their dimensionally-accurate room before purchase — a documented waste reduction step toward your 2030 EPR obligations."

This is not a product compliance obligation. It is a B2B sales enabler for retailer partnerships, relevant from 2026 onwards as retailers begin EPR compliance planning.
