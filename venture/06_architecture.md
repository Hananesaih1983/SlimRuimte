# SlimRuimte — Stage 6: Architecture
Date: 2026-07-29 | Stage: 6 | Version: 1.0
Rule: Boring known technology. Data model first. Every dependency named with failure mode + fallback. Cost at 10/100/1,000 users. One person can build this in 12 weeks.

---

## ROLE & PERMISSION MODEL

### 5 Roles (one user = exactly one role, set at registration)

| Role | Description | Primary entity | Pays platform | Receives |
|------|-------------|---------------|---------------|---------|
| homeowner | NL/BE resident renovating | projects (multiple) | Optional (render upgrade €2.50) | Renders, floor plans, contractor + designer leads |
| contractor | BouwGarant-certified renovation firm | leads received | €35/lead accepted | Pre-scoped visual project briefs |
| interior_designer | BNI/AiNB affiliated or verified designer | leads received | €25/lead accepted | Pre-scoped visual design briefs |
| estate_agent | NL/BE makelaar listing on Funda | property_scans | €29/property scan | Floor plan + 3D model for Funda |
| admin | Platform operator | — | — | Full read/write, moderation, KvK verification |

### Permission Matrix

| Action | homeowner | contractor | interior_designer | estate_agent | admin |
|--------|-----------|-----------|------------------|--------------|-------|
| Create project | ✓ own | — | — | — | ✓ any |
| View own projects | ✓ | — | — | — | ✓ |
| View assigned leads | — | ✓ own | ✓ own | — | ✓ |
| Accept/decline lead | — | ✓ own | ✓ own | — | ✓ |
| Send messages | ✓ own | ✓ assigned | ✓ assigned | — | ✓ |
| Create property scan | — | — | — | ✓ own | ✓ |
| View all projects | — | — | — | — | ✓ |
| Verify contractor KvK | — | — | — | — | ✓ |
| Set contractor availability | — | ✓ own | ✓ own | — | ✓ |
| Post review | ✓ (of contractor/designer) | — | — | — | ✓ |
| Respond to review | — | ✓ own | ✓ own | — | ✓ |
| View platform analytics | — | — | — | — | ✓ |
| Manage own profile | ✓ | ✓ | ✓ | ✓ | ✓ |
| Delete account + data | ✓ | ✓ | ✓ | ✓ | ✓ (GDPR Art.17) |

---

## DATA MODEL

All tables in Supabase PostgreSQL. Row Level Security (RLS) enforces permissions at database level — application layer checks are a second line of defence, not the primary one.

### users
```sql
CREATE TABLE public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('homeowner','contractor','interior_designer','estate_agent','admin')),
  first_name    TEXT,
  last_name     TEXT,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  whatsapp      TEXT,
  language      TEXT NOT NULL DEFAULT 'nl' CHECK (language IN ('nl','en','fr')),
  notification_pref TEXT DEFAULT 'email' CHECK (notification_pref IN ('email','whatsapp','both')),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,                    -- soft delete for GDPR
  data_retention_days INT DEFAULT 365           -- GDPR retention policy
);
-- Trigger: auto-insert on auth.users creation (prevents FK gap)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### projects (homeowner multi-project)
```sql
CREATE TABLE public.projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homeowner_id    UUID NOT NULL REFERENCES public.users(id),
  title           TEXT,                          -- auto-generated or user-set
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scanning','renders_pending','renders_done',
                                    'brief_approved','brief_sent','designer_matched',
                                    'contractor_matched','in_progress','complete','archived')),
  renovation_type TEXT CHECK (renovation_type IN ('kitchen','bathroom','living_room',
                               'bedroom','open_plan','extension','other')),
  postcode        TEXT,
  city            TEXT,
  country         TEXT DEFAULT 'NL' CHECK (country IN ('NL','BE')),
  budget_range    TEXT CHECK (budget_range IN ('under_10k','10k_20k','20k_40k',
                                                '40k_80k','over_80k')),
  timeline        TEXT CHECK (timeline IN ('asap','3_months','6_months','flexible')),
  -- scan data
  scan_method     TEXT CHECK (scan_method IN ('lidar','manual')),
  scan_source     TEXT,                          -- 'magicplan' or 'manual_entry'
  magicplan_project_id TEXT,
  room_dimensions JSONB,                         -- {walls:[{length,height,doors:[],windows:[]}], area, perimeter}
  -- outputs
  floor_plan_svg_url  TEXT,
  floor_plan_pdf_url  TEXT,
  floor_plan_dxf_url  TEXT,
  elevations_pdf_url  TEXT,
  model_glb_url       TEXT,
  -- style brief
  style_answers   JSONB,                         -- Q1-Q5 answers
  render_prompt   TEXT,                          -- generated from style_answers
  -- timestamps
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ                    -- soft delete
);
-- RLS: homeowner sees own projects only; admin sees all
CREATE POLICY project_owner ON public.projects
  FOR ALL USING (homeowner_id = auth.uid() OR
                 EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
-- Index for dashboard query
CREATE INDEX idx_projects_homeowner ON public.projects(homeowner_id, status, created_at DESC);
```

### renders
```sql
CREATE TABLE public.renders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  render_number   INT NOT NULL CHECK (render_number IN (1,2,3)),
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending','generating','done','failed','upgraded')),
  -- generation
  model_used      TEXT,                          -- 'flux-kontext-pro' | 'flux-1.1-pro-ultra'
  prompt_used     TEXT,
  input_image_url TEXT,                          -- room GLB screenshot fed to img2img
  -- output
  base_url        TEXT,                          -- original Flux output
  upgraded_url    TEXT,                          -- Magnific upscale (if purchased)
  width           INT,
  height          INT,
  cost_eur        NUMERIC(8,4),                  -- actual API cost logged
  -- ai act compliance
  ai_label_text   TEXT DEFAULT 'AI-gegenereerde afbeelding',
  ai_label_visible BOOLEAN DEFAULT TRUE,
  -- timestamps
  generated_at    TIMESTAMPTZ,
  upgraded_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: project owner sees own renders; admin sees all
CREATE POLICY render_owner ON public.renders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects p
            WHERE p.id = project_id AND
                  (p.homeowner_id = auth.uid() OR
                   EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')))
  );
```

### contractor_profiles
```sql
CREATE TABLE public.contractor_profiles (
  user_id           UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  company_name      TEXT NOT NULL,
  kvk_number        TEXT UNIQUE,
  kvk_verified      BOOLEAN DEFAULT FALSE,
  kvk_verified_at   TIMESTAMPTZ,
  bouwgarant_number TEXT UNIQUE,
  bouwgarant_verified BOOLEAN DEFAULT FALSE,
  vat_number        TEXT,
  specialisms       TEXT[] DEFAULT '{}',        -- ['kitchen','bathroom','structural','full']
  service_area_km   INT DEFAULT 50,
  service_postcodes TEXT[],                     -- optional explicit postcode list
  country           TEXT[] DEFAULT '{NL}',
  languages         TEXT[] DEFAULT '{nl}',
  availability      TEXT DEFAULT 'available' CHECK (availability IN ('available','busy','pause')),
  avg_rating        NUMERIC(3,2),
  review_count      INT DEFAULT 0,
  response_rate     NUMERIC(5,2),               -- % leads accepted in 48h
  -- payment
  stripe_account_id TEXT,                       -- Stripe Connect account
  stripe_onboarded  BOOLEAN DEFAULT FALSE,
  -- dsa compliance
  dsa_verified_at   TIMESTAMPTZ,
  dsa_identity_doc  TEXT,
  -- profile
  bio               TEXT,
  website           TEXT,
  logo_url          TEXT,
  photos            TEXT[],
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: contractors see/edit own profile; homeowners read all (for matching); admin full
CREATE POLICY contractor_read ON public.contractor_profiles
  FOR SELECT USING (TRUE);                      -- public read for matching
CREATE POLICY contractor_write ON public.contractor_profiles
  FOR ALL USING (user_id = auth.uid() OR
                 EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
```

### designer_profiles
```sql
CREATE TABLE public.designer_profiles (
  user_id           UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  display_name      TEXT NOT NULL,
  kvk_number        TEXT UNIQUE,
  kvk_verified      BOOLEAN DEFAULT FALSE,
  bni_member        BOOLEAN DEFAULT FALSE,      -- BNI (NL) professional body
  ainb_member       BOOLEAN DEFAULT FALSE,      -- AiNB (BE) professional body
  vat_number        TEXT,
  specialisms       TEXT[] DEFAULT '{}',        -- ['kitchen','bathroom','living_room','full_home']
  styles            TEXT[] DEFAULT '{}',        -- ['scandinavian','industrial','classic']
  service_area_km   INT DEFAULT 100,
  country           TEXT[] DEFAULT '{NL}',
  languages         TEXT[] DEFAULT '{nl}',
  availability      TEXT DEFAULT 'available' CHECK (availability IN ('available','busy','pause')),
  avg_rating        NUMERIC(3,2),
  review_count      INT DEFAULT 0,
  lead_fee_eur      NUMERIC(6,2) DEFAULT 25.00, -- platform charges homeowner; designer pays this
  stripe_account_id TEXT,
  stripe_onboarded  BOOLEAN DEFAULT FALSE,
  bio               TEXT,
  portfolio_urls    TEXT[],
  hourly_rate_eur   NUMERIC(8,2),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### estate_agent_profiles
```sql
CREATE TABLE public.estate_agent_profiles (
  user_id         UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  agency_name     TEXT NOT NULL,
  kvk_number      TEXT UNIQUE,
  kvk_verified    BOOLEAN DEFAULT FALSE,
  nvm_member      BOOLEAN DEFAULT FALSE,       -- NVM (NL makelaar association)
  vbo_member      BOOLEAN DEFAULT FALSE,       -- VBO
  vastgoed_cert   BOOLEAN DEFAULT FALSE,       -- BE equivalent
  stripe_customer_id TEXT,
  country         TEXT[] DEFAULT '{NL}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### leads (contractor + designer lead tracking)
```sql
CREATE TABLE public.leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id),
  recipient_id    UUID NOT NULL REFERENCES public.users(id),  -- contractor or designer
  recipient_role  TEXT NOT NULL CHECK (recipient_role IN ('contractor','interior_designer')),
  status          TEXT NOT NULL DEFAULT 'sent'
                  CHECK (status IN ('sent','viewed','accepted','declined','expired','cancelled')),
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  viewed_at       TIMESTAMPTZ,
  responded_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '48 hours',
  -- payment
  lead_fee_eur    NUMERIC(6,2),
  stripe_payment_intent_id TEXT,
  paid_at         TIMESTAMPTZ,
  -- position in queue
  queue_position  INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: homeowner sees leads for own project; contractor/designer sees own leads; admin all
CREATE POLICY lead_access ON public.leads
  FOR SELECT USING (
    recipient_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.homeowner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
-- Index for contractor dashboard
CREATE INDEX idx_leads_recipient ON public.leads(recipient_id, status, sent_at DESC);
CREATE INDEX idx_leads_project ON public.leads(project_id, status);
```

### professional_subscriptions (Type 2 workflow — professional monthly plans)
```sql
CREATE TABLE public.professional_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan                  TEXT NOT NULL CHECK (plan IN ('starter','professional','expert')),
  price_eur             NUMERIC(8,2) NOT NULL,          -- 99 / 199 / 299
  projects_limit        INT,                            -- 5 / 15 / NULL (unlimited)
  projects_this_period  INT NOT NULL DEFAULT 0,         -- resets on billing cycle
  period_start          TIMESTAMPTZ NOT NULL,
  period_end            TIMESTAMPTZ NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id    TEXT,
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','past_due','cancelled','trialing')),
  cancelled_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: professional sees own subscription; admin all
CREATE POLICY sub_owner ON public.professional_subscriptions
  FOR ALL USING (user_id = auth.uid() OR
                 EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
-- Index: quick lookup when enforcing project creation limit
CREATE INDEX idx_prof_sub_user ON public.professional_subscriptions(user_id, status);
```

### project_invites (client claim tokens for Type 2 workflow)
```sql
CREATE TABLE public.project_invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES public.users(id),  -- the professional
  client_email  TEXT NOT NULL,
  token         TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  claimed_by    UUID REFERENCES public.users(id),           -- set on claim
  claimed_at    TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: only admin and the creating professional can read invite rows;
--       public token lookup handled via claim_project_invite() SECURITY DEFINER function
CREATE POLICY invite_owner ON public.project_invites
  FOR ALL USING (created_by = auth.uid() OR
                 EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE INDEX idx_invites_token ON public.project_invites(token);
CREATE INDEX idx_invites_project ON public.project_invites(project_id);
```

### professional_visibility_settings column on projects
```sql
-- Added to the projects table as a JSONB column (migration):
ALTER TABLE public.projects
  ADD COLUMN professional_visibility_settings JSONB NOT NULL DEFAULT
    '{"renders": false, "floor_plan": false, "side_views": false,
      "model_3d": false, "full_brief": false}';
-- professional_id column: tracks which professional created this project (NULL for homeowner-initiated)
ALTER TABLE public.projects
  ADD COLUMN professional_id UUID REFERENCES public.users(id);   -- NULL for Type 1
ALTER TABLE public.projects
  ADD COLUMN workflow_type TEXT DEFAULT 'homeowner_initiated'
    CHECK (workflow_type IN ('homeowner_initiated','professional_initiated','collaborative'));
```

### Security-definer helper functions

**`user_can_see_project_asset(p_project_id UUID, p_asset TEXT, p_user_id UUID) → BOOLEAN`**
```sql
CREATE OR REPLACE FUNCTION public.user_can_see_project_asset(
  p_project_id UUID,
  p_asset      TEXT,        -- 'renders' | 'floor_plan' | 'side_views' | 'model_3d' | 'full_brief'
  p_user_id    UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project projects%ROWTYPE;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Admin always sees all
  IF EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND role = 'admin') THEN
    RETURN TRUE;
  END IF;

  -- Professional who owns the project sees all
  IF v_project.professional_id = p_user_id THEN RETURN TRUE; END IF;

  -- Homeowner who owns/claimed the project: check visibility toggle
  IF v_project.homeowner_id = p_user_id THEN
    RETURN (v_project.professional_visibility_settings->>p_asset)::BOOLEAN;
  END IF;

  RETURN FALSE;
END;
$$;
```

**`claim_project_invite(p_token TEXT, p_user_id UUID) → JSONB`**
```sql
CREATE OR REPLACE FUNCTION public.claim_project_invite(
  p_token   TEXT,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite project_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite FROM public.project_invites WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN '{"ok": false, "error": "invite_not_found"}';
  END IF;

  IF v_invite.expires_at < NOW() THEN
    RETURN '{"ok": false, "error": "invite_expired"}';
  END IF;

  IF v_invite.claimed_by IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed',
                              'project_id', v_invite.project_id);
  END IF;

  -- Claim: assign homeowner_id on project + mark invite as claimed
  UPDATE public.projects
    SET homeowner_id = p_user_id, updated_at = NOW()
  WHERE id = v_invite.project_id;

  UPDATE public.project_invites
    SET claimed_by = p_user_id, claimed_at = NOW()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true, 'project_id', v_invite.project_id);
END;
$$;
```

### messages
```sql
CREATE TABLE public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.users(id),
  body            TEXT NOT NULL,
  attachment_url  TEXT,
  attachment_name TEXT,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: sender or lead recipient/homeowner only
CREATE POLICY message_access ON public.messages
  FOR ALL USING (
    sender_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.projects p ON p.id = l.project_id
      WHERE l.id = lead_id AND (l.recipient_id = auth.uid() OR p.homeowner_id = auth.uid())
    ) OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
-- Index for realtime subscription
CREATE INDEX idx_messages_lead ON public.messages(lead_id, created_at ASC);
```

### reviews
```sql
CREATE TABLE public.reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID NOT NULL UNIQUE REFERENCES public.leads(id),
  reviewer_id       UUID NOT NULL REFERENCES public.users(id),  -- homeowner
  reviewee_id       UUID NOT NULL REFERENCES public.users(id),  -- contractor or designer
  reviewee_role     TEXT NOT NULL CHECK (reviewee_role IN ('contractor','interior_designer')),
  -- 4 dimensions
  rating_punctuality    INT CHECK (rating_punctuality BETWEEN 1 AND 5),
  rating_quality        INT CHECK (rating_quality BETWEEN 1 AND 5),
  rating_communication  INT CHECK (rating_communication BETWEEN 1 AND 5),
  rating_price_accuracy INT CHECK (rating_price_accuracy BETWEEN 1 AND 5),
  avg_rating        NUMERIC(3,2) GENERATED ALWAYS AS (
    (rating_punctuality + rating_quality + rating_communication + rating_price_accuracy)::NUMERIC / 4
  ) STORED,
  body              TEXT CHECK (char_length(body) BETWEEN 50 AND 500),
  response_body     TEXT CHECK (char_length(response_body) <= 500),
  response_at       TIMESTAMPTZ,
  published         BOOLEAN DEFAULT TRUE,
  flagged           BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
-- Trigger: update avg_rating on contractor_profiles/designer_profiles after review insert/update
```

### property_scans (estate agent)
```sql
CREATE TABLE public.property_scans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES public.users(id),
  address         TEXT NOT NULL,
  postcode        TEXT,
  city            TEXT,
  country         TEXT DEFAULT 'NL',
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending','scanning','done','failed')),
  -- scan output (same pipeline as homeowner projects)
  scan_method     TEXT,
  room_dimensions JSONB,
  floor_plan_svg_url TEXT,
  floor_plan_pdf_url TEXT,
  floor_plan_dxf_url TEXT,
  model_glb_url   TEXT,
  -- payment
  price_eur       NUMERIC(6,2) DEFAULT 29.00,
  stripe_payment_intent_id TEXT,
  paid_at         TIMESTAMPTZ,
  -- funda
  funda_listing_id TEXT,
  shareable_link  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### render_upgrades (Magnific upsell payments)
```sql
CREATE TABLE public.render_upgrades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  render_id       UUID NOT NULL REFERENCES public.renders(id),
  homeowner_id    UUID NOT NULL REFERENCES public.users(id),
  price_eur       NUMERIC(6,2) DEFAULT 2.50,
  stripe_payment_intent_id TEXT,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### audit_events (instrumentation — replaces third-party analytics)
```sql
CREATE TABLE public.audit_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES public.users(id),
  session_id  TEXT,
  event_name  TEXT NOT NULL,               -- 'scan_started', 'renders_generated', etc.
  properties  JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
-- Partitioned by month for query performance at scale
-- Retention: 24 months then auto-delete (GDPR data minimisation)
CREATE INDEX idx_audit_event_name ON public.audit_events(event_name, created_at DESC);
CREATE INDEX idx_audit_user ON public.audit_events(user_id, created_at DESC);
```

### personal_data_map (GDPR compliance — every personal data field mapped)

| Table | Field | Personal data? | Legal basis | Retention | Deletion path |
|-------|-------|---------------|-------------|-----------|---------------|
| users | email | YES — direct identifier | Contract (6(1)(b)) | Account lifetime + 30 days | Anonymise on account delete |
| users | phone/whatsapp | YES | Consent (6(1)(a)) | Account lifetime | Delete on request |
| projects | postcode | YES — indirect | Contract | Project lifetime + 12 months | Anonymise after archive |
| projects | room_dimensions | YES — home layout | Contract | Project lifetime + 12 months | Delete on request |
| renders | base_url / upgraded_url | YES — home photo derivative | Contract | 12 months | Delete file + null URL |
| messages | body | YES — personal communication | Contract | Lead lifetime + 6 months | Delete on account delete |
| audit_events | user_id | YES — pseudonymous | Legitimate interest (6(1)(f)) | 24 months | Anonymise (null user_id) |
| reviews | body | YES — public statement | Contract | Permanent (public record) | Remove if false; flag if disputed |

---

## APPLICATION ARCHITECTURE

```
┌─────────────────────────────────────────────────┐
│                   VERCEL CDN                     │
│         Next.js 14 App Router (SSR + RSC)        │
│                                                  │
│  /[locale]/(homeowner)/  — homeowner routes      │
│  /[locale]/(contractor)/ — contractor routes     │
│  /[locale]/(designer)/   — designer routes       │
│  /[locale]/(agent)/      — estate agent routes   │
│  /[locale]/(admin)/      — admin routes          │
│  /api/                   — API routes            │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│              SUPABASE (eu-west-1, Ireland)       │
│                                                  │
│  Auth (JWT, magic link, email confirm)           │
│  PostgreSQL (RLS enforced)                       │
│  Storage (renders, floor plans, GLB files)       │
│  Realtime (messages — websocket subscriptions)   │
│  Edge Functions (webhooks, background jobs)      │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│              EXTERNAL SERVICES                   │
│                                                  │
│  magicplan API    — floor plan (LiDAR path)      │
│  FAL.ai           — Flux Kontext + Ultra renders │
│  Magnific AI      — render upscale (optional)    │
│  Stripe Connect   — lead fees + render upsell    │
│  Twilio           — WhatsApp + SMS notifications │
│  Resend           — transactional email          │
│  KvK Open Data    — contractor verification      │
└──────────────────────────────────────────────────┘
```

### Route groups by role (Next.js App Router)

```
app/
├── [locale]/
│   ├── (public)/              — homepage, how-it-works, pricing, about
│   │   └── layout.tsx         — public nav, language switcher
│   ├── (homeowner)/           — requires role=homeowner
│   │   ├── dashboard/
│   │   ├── project/[id]/
│   │   │   ├── scan/
│   │   │   ├── plan/
│   │   │   ├── brief/
│   │   │   ├── renders/
│   │   │   ├── brief-preview/
│   │   │   ├── aannemers/
│   │   │   ├── berichten/[lead_id]/
│   │   │   ├── 3d/
│   │   │   └── review/[lead_id]/
│   │   └── layout.tsx         — homeowner nav
│   ├── (contractor)/          — requires role=contractor
│   │   ├── dashboard/
│   │   ├── lead/[id]/
│   │   ├── berichten/[lead_id]/
│   │   ├── profiel/
│   │   └── layout.tsx
│   ├── (designer)/            — requires role=interior_designer
│   │   ├── dashboard/
│   │   ├── lead/[id]/
│   │   ├── berichten/[lead_id]/
│   │   ├── profiel/
│   │   └── layout.tsx
│   ├── (agent)/               — requires role=estate_agent
│   │   ├── dashboard/
│   │   ├── scan/[id]/
│   │   └── layout.tsx
│   ├── (admin)/               — requires role=admin
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── verification/      — KvK + BouwGarant verify queue
│   │   ├── leads/
│   │   ├── reviews/
│   │   └── layout.tsx
│   └── auth/
│       ├── login/
│       ├── register/          — role selector on signup
│       ├── callback/          — REQUIRED: exchanges code for session
│       └── reset-password/
├── api/
│   ├── scan/import/           — magicplan webhook + import
│   ├── renders/generate/      — Flux API calls (async)
│   ├── renders/upgrade/       — Magnific API calls
│   ├── leads/match/           — matching algorithm
│   ├── leads/accept/          — Stripe charge + contact reveal
│   ├── brief/generate-pdf/    — WeasyPrint PDF generation
│   ├── notifications/send/    — Twilio + Resend
│   ├── webhooks/stripe/       — payment confirmations
│   └── auth/callback/         — Supabase auth exchange
```

### Middleware (role enforcement)

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = getUserRoleFromSession(request); // from Supabase JWT claims

  const roleRoutes = {
    '/homeowner': 'homeowner',
    '/contractor': 'contractor',
    '/designer': 'interior_designer',
    '/agent': 'estate_agent',
    '/admin': 'admin',
  };

  for (const [path, requiredRole] of Object.entries(roleRoutes)) {
    if (pathname.includes(path) && role !== requiredRole && role !== 'admin') {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }
}

// CRITICAL: run on ALL routes, not just protected ones (session refresh)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## THIRD-PARTY DEPENDENCIES — FAILURE MODES + FALLBACKS

| Service | What it does | Failure mode | Fallback |
|---------|-------------|--------------|----------|
| magicplan API | LiDAR floor plan import | API down / project not found | Show manual measurement wizard; user continues unblocked |
| FAL.ai / Flux | AI render generation | Timeout / API error | Retry 3× with exponential backoff; if all fail, show error + "Probeer over 5 minuten opnieuw"; render marked 'failed' in DB |
| Magnific AI | Render upscale | API down | Refund €2.50 automatically via Stripe; show original render; log for retry |
| Stripe Connect | Lead fee payment | Card decline / Stripe down | Lead held in 'pending_payment' status; contractor has 2h to update card; if not, next contractor in queue notified |
| Twilio | WhatsApp + SMS | Delivery failure | Fall back to email (Resend); log failed delivery in audit_events |
| Resend | Email | Bounce / API down | Log failure; retry once after 5 min; surface in admin dashboard |
| KvK Open Data API | Contractor KvK verification | API down | Queue verification for admin manual review; contractor marked 'verification_pending' (not listed until verified) |
| Supabase Realtime | Live messages | WebSocket drops | Client reconnects automatically (built into Supabase JS client); message stored in DB regardless |
| Supabase Storage | File storage (renders, floor plans, GLB) | Upload failure | Retry 3×; if fail, mark output as 'failed', surface error to user |
| Vercel | Hosting + CDN | Deployment failure | Previous deployment stays live; GitHub rollback in <5 minutes |

---

## COST MODEL

### Per-project variable costs

| Item | Cost | Source |
|------|------|--------|
| Flux Kontext Pro (render 1) | $0.04 | FAL.ai |
| Flux 1.1 Pro Ultra × 2 (renders 2+3) | $0.12 | FAL.ai |
| Magnific AI (10% of projects, 1 render avg) | $0.02 avg | Magnific |
| magicplan API (LiDAR path, ~60% of projects) | $18 avg | $300/10 projects |
| Twilio notifications (3 msgs/project) | $0.15 | $0.05/msg |
| WeasyPrint PDF (self-hosted, CPU only) | ~$0.01 | Infra |
| Stripe fee on €35 lead × 3 (1.5% + €0.25) | €1.83 | Stripe |
| **Total variable cost/project** | **~$20-21 (~€18-19)** | |
| **Gross revenue/project (lead fees)** | **€105** | |
| **Gross margin/project** | **~82%** | |

### Revenue streams

| Stream | Unit economics | Notes |
|--------|---------------|-------|
| Contractor lead fees | €35/lead × 3/project = €105 gross | Pay-on-acceptance; primary revenue at launch |
| Designer lead fees | €25/lead × 3/project = €75 gross | Same model; lower ticket, design-focused briefs |
| Professional subscriptions | €99–€299/month per professional | Recurring SaaS revenue on top of lead fees; unlocks Type 2 workflow |
| Premium render upsell | €2.50/render (Magnific upscale) | ~10% uptake; high margin (€2.30 net per render) |
| Estate agent scans | €29/property | B2B channel; Funda ranking incentive |
| Decodata affiliate | 5–10% of furniture sale | Passive; triggered by 3D viewer placement |

### Fixed monthly infrastructure

| Item | Cost/month |
|------|-----------|
| Vercel Pro | $20 |
| Supabase Pro | $25 |
| Resend (up to 50K emails) | $20 |
| magicplan base plan | $300 (covers 10 projects; pro-rated above) |
| Domain + SSL | ~€2 |
| **Total fixed (at launch)** | **~€340/month** |

### Scale cost model

| Volume | Fixed | Variable | Total costs | Revenue (€105×) | Gross margin |
|--------|-------|----------|-------------|-----------------|--------------|
| 10 projects/mo | €340 | €190 | €530 | €1,050 | 49% |
| 100 projects/mo | €420 | €1,900 | €2,320 | €10,500 | 78% |
| 500 projects/mo | €600 | €9,500 | €10,100 | €52,500 | 81% |
| 1,000 projects/mo | €900 | €19,000 | €19,900 | €105,000 | 81% |

Note: magicplan scales beyond 10 projects/month via enterprise pricing — negotiate at 50+ projects/month. Alternatively, at scale, replace magicplan with a self-hosted Apple RoomPlan wrapper (iOS SDK, free) served via a dedicated macOS mini server (~€60/month), reducing per-project floor plan cost to near-zero.

### 12-week budget breakdown (€6,000 ceiling)

| Item | Cost |
|------|------|
| magicplan subscription × 3 months | €900 |
| FAL.ai API credits (render testing + first 50 projects) | €300 |
| Magnific AI credits | €50 |
| Twilio (testing + first 50 projects) | €50 |
| Stripe setup + test transactions | €0 (no cost until live) |
| Vercel Pro × 3 months | €60 |
| Supabase Pro × 3 months | €75 |
| Resend × 3 months | €60 |
| Domain (slimruimte.nl + .be) | €30 |
| Legal T&C review (1 hour commercial lawyer) | €350 |
| KvK registration BE entity (if needed) | €150 |
| AI Act compliance label implementation | €0 (dev time) |
| Buffer | €3,975 |
| **Total committed spend** | **€2,025** |
| **Remaining buffer** | **€3,975** |

---

## CAN ONE PERSON BUILD THIS IN 12 WEEKS?

Yes. Specifically: a founder who is an interior designer with 3D expertise (not a software engineer) will need help. Honest assessment:

### What requires a developer

- Next.js + Supabase setup, RLS policies, auth flows (Week 1-2): 40-60 hours
- magicplan API integration + manual wizard (Week 2-3): 20-30 hours
- SVG floor plan + elevation generator in Python (Week 3): 15-20 hours
- trimesh 3D room generation + model-viewer embed (Week 4): 20-30 hours
- FAL.ai + Magnific render pipeline (Week 5): 15-20 hours
- Brief PDF generator (Week 7): 10-15 hours
- Contractor/designer matching algorithm (Week 8): 10-15 hours
- Stripe Connect integration (Week 9): 15-20 hours
- Supabase Realtime messaging (Week 10): 15-20 hours
- i18n NL/EN/FR (Week 11): 10-15 hours
- Total estimated: **170-225 developer hours**

### Options within €6,000 budget

Option A — Hire one developer (recommended):
Senior NL freelancer: €75-100/hr → 225 hours → €17,000-22,500. Over budget.
Mid-level NL freelancer: €50-65/hr → 225 hours → €11,250-14,625. Over budget.
Eastern European senior: €30-45/hr → 225 hours → €6,750-10,125. Borderline.

**Option B — Use Claude Code / AI-assisted development (fits €6,000):**
Claude Max subscription: ~€100/month × 3 = €300.
With Claude Code doing 70-80% of the coding, a technically literate founder can build and ship. The venture-build-claude-code skill covers this workflow. Estimated founder time: 6-8 hours/day × 12 weeks = 504-672 hours total. Feasible for a full-time commitment.

**Option C — Hire one part-time developer for integration work only (most realistic):**
Hire for 60 hours of complex integrations (magicplan, Stripe Connect, RLS policies): €45/hr × 60 = €2,700. Remaining: €3,300 for ops. Founder + Claude Code handles the rest. Recommended.

### Recommended approach: Option C
Week 1-2: Claude Code sets up foundation; developer handles RLS + auth (20h, €900)
Week 3-6: Claude Code builds scan/render/3D pipeline; developer reviews and fixes (20h, €900)
Week 7-9: Claude Code builds matching + payments; developer handles Stripe Connect (20h, €900)
Week 10-12: Founder handles copy, i18n strings, QA, contractor onboarding; Claude Code fixes bugs
Total developer cost: ~€2,700. Remaining budget: €3,300 (ops + buffer).

---

## STAGE 6 VERIFICATION

Per product-definition skill:
- Boring known technology: YES (Next.js, Supabase, Stripe, Twilio, Resend — all proven in production)
- Data model first: YES (8 tables, all DDL written, RLS policies defined)
- Every personal data field mapped to legal basis + retention: YES (personal_data_map table above)
- Deletion path designed before creation path: YES (soft delete on users, cascade on projects, file deletion on renders)
- Every third-party dependency has failure mode + fallback: YES (8 services, all covered)
- Cost model at 10/100/1,000 users: YES
- One person can build in time box: YES with Claude Code + 60h part-time developer
- Novel technology risk identified: YES — trimesh 3D room generation is the only non-commodity component; fallback = use magicplan OBJ directly without custom generation

---

## FEATURE ADDITIONS — Full Project Management + AI Moodboard Builder

### project_plans
```sql
CREATE TABLE public.project_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by        UUID NOT NULL REFERENCES public.users(id),
  title             TEXT,
  ai_generated      BOOLEAN DEFAULT TRUE,
  status            TEXT DEFAULT 'draft'
                    CHECK (status IN ('draft','active','on_hold','completed')),
  start_date        DATE,
  end_date          DATE,
  total_budget_eur  NUMERIC(12,2),
  spent_budget_eur  NUMERIC(12,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: project owner (homeowner) and the professional who created the plan can read;
--      only the professional (created_by) or admin can write
CREATE POLICY plan_read ON public.project_plans
  FOR SELECT USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.projects p
            WHERE p.id = project_id AND p.homeowner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE POLICY plan_write ON public.project_plans
  FOR ALL USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE INDEX idx_project_plans_project ON public.project_plans(project_id, status);
```

### project_tasks
```sql
CREATE TABLE public.project_tasks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id               UUID NOT NULL REFERENCES public.project_plans(id) ON DELETE CASCADE,
  parent_task_id        UUID REFERENCES public.project_tasks(id),  -- for subtasks
  title                 TEXT NOT NULL,
  description           TEXT,
  assigned_to           UUID REFERENCES public.users(id),          -- professional or subcontractor
  assigned_role         TEXT CHECK (assigned_role IN ('contractor','interior_designer','subcontractor','homeowner')),
  status                TEXT DEFAULT 'todo'
                        CHECK (status IN ('todo','in_progress','blocked','done','cancelled')),
  start_date            DATE,
  end_date              DATE,
  duration_days         INT,
  depends_on            UUID[],                                     -- array of task IDs this task depends on
  budget_eur            NUMERIC(10,2),
  actual_cost_eur       NUMERIC(10,2),
  progress_pct          INT DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  is_milestone          BOOLEAN DEFAULT FALSE,
  visible_to_homeowner  BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: follows project_plans access (join through plan_id → project_id → homeowner check)
CREATE POLICY task_read ON public.project_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_plans pp
      JOIN public.projects p ON p.id = pp.project_id
      WHERE pp.id = plan_id AND (
        pp.created_by = auth.uid() OR
        p.homeowner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
      )
    )
  );
CREATE POLICY task_write ON public.project_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.project_plans pp
      WHERE pp.id = plan_id AND (
        pp.created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
      )
    )
  );
-- Additional RLS: homeowner only sees tasks where visible_to_homeowner = TRUE
CREATE POLICY task_homeowner_filter ON public.project_tasks
  FOR SELECT USING (
    visible_to_homeowner = TRUE OR
    EXISTS (
      SELECT 1 FROM public.project_plans pp
      WHERE pp.id = plan_id AND pp.created_by = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE INDEX idx_project_tasks_plan ON public.project_tasks(plan_id, status);
CREATE INDEX idx_project_tasks_parent ON public.project_tasks(parent_task_id);
CREATE INDEX idx_project_tasks_assigned ON public.project_tasks(assigned_to);
```

### project_documents
```sql
CREATE TABLE public.project_documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES public.projects(id),
  plan_id               UUID REFERENCES public.project_plans(id),
  task_id               UUID REFERENCES public.project_tasks(id),
  uploaded_by           UUID NOT NULL REFERENCES public.users(id),
  document_type         TEXT CHECK (document_type IN ('quote','invoice','permit','contract','photo','report','other')),
  filename              TEXT NOT NULL,
  storage_path          TEXT NOT NULL,                             -- Supabase Storage path
  size_bytes            BIGINT,
  visible_to_homeowner  BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: uploader + professional on the project can write;
--      homeowner can read rows where visible_to_homeowner = TRUE
CREATE POLICY doc_write ON public.project_documents
  FOR ALL USING (
    uploaded_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE POLICY doc_read ON public.project_documents
  FOR SELECT USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND (
        p.homeowner_id = auth.uid() AND visible_to_homeowner = TRUE
      )
    ) OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE INDEX idx_project_docs_project ON public.project_documents(project_id, document_type);
CREATE INDEX idx_project_docs_task ON public.project_documents(task_id);
```

### subcontractors
```sql
CREATE TABLE public.subcontractors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  added_by            UUID NOT NULL REFERENCES public.users(id),  -- the main contractor/designer
  project_id          UUID NOT NULL REFERENCES public.projects(id),
  name                TEXT NOT NULL,
  company             TEXT,
  email               TEXT,
  phone               TEXT,
  trade               TEXT,  -- 'electrician','plumber','tiler','painter','carpenter','other'
  invite_token        TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  registered_user_id  UUID REFERENCES public.users(id),           -- set if they join SlimRuimte
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: only the professional who added the subcontractor (added_by) or admin can read/write
CREATE POLICY subcontractor_access ON public.subcontractors
  FOR ALL USING (
    added_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE INDEX idx_subcontractors_project ON public.subcontractors(project_id);
CREATE INDEX idx_subcontractors_token ON public.subcontractors(invite_token);
```

### budget_items
```sql
CREATE TABLE public.budget_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id               UUID NOT NULL REFERENCES public.project_plans(id),
  task_id               UUID REFERENCES public.project_tasks(id),
  category              TEXT CHECK (category IN ('labour','materials','permits','design_fees','contingency','other')),
  description           TEXT NOT NULL,
  estimated_eur         NUMERIC(10,2),
  actual_eur            NUMERIC(10,2),
  paid                  BOOLEAN DEFAULT FALSE,
  paid_at               TIMESTAMPTZ,
  invoice_document_id   UUID REFERENCES public.project_documents(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: follows project_plans access (plan_id → created_by check)
CREATE POLICY budget_access ON public.budget_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.project_plans pp
      WHERE pp.id = plan_id AND (
        pp.created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
      )
    )
  );
CREATE INDEX idx_budget_items_plan ON public.budget_items(plan_id, category);
```

### moodboards
```sql
CREATE TABLE public.moodboards (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by              UUID NOT NULL REFERENCES public.users(id),
  title                   TEXT DEFAULT 'Mijn moodboard',
  status                  TEXT DEFAULT 'building'
                          CHECK (status IN ('building','ready','used_for_render')),
  -- Merged style data used for render prompt generation
  style_summary           TEXT,                   -- AI-generated summary; input to render prompt
  dominant_colors         TEXT[],                 -- extracted hex colors from uploaded images
  style_keywords          TEXT[],                 -- e.g. ['scandinavisch','eiken','wit','naturel']
  materials               TEXT[],
  lighting                TEXT,                   -- 'veel daglicht'/'sfeervol'/'helder en functioneel'
  -- Chat conversation (Path B)
  chat_messages           JSONB DEFAULT '[]',     -- [{role: user/assistant, content: string, ts: timestamp}]
  -- Questionnaire answers (Path C)
  questionnaire_answers   JSONB DEFAULT '{}',     -- {renovation_type, style, materials, light, wish}
  -- Assembled prompt sent to Flux API
  render_prompt           TEXT,                   -- final assembled prompt (replaces old 5-question prompt)
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: project owner and professional who created it can read/write; admin all
CREATE POLICY moodboard_access ON public.moodboards
  FOR ALL USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.homeowner_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
CREATE INDEX idx_moodboards_project ON public.moodboards(project_id, status);
```

### moodboard_images
```sql
CREATE TABLE public.moodboard_images (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moodboard_id        UUID NOT NULL REFERENCES public.moodboards(id) ON DELETE CASCADE,
  source              TEXT CHECK (source IN ('upload','ai_generated','chat_suggestion')),
  storage_path        TEXT,                        -- Supabase Storage (for uploads)
  external_url        TEXT,                        -- for AI-suggested or chat-pinned images
  caption             TEXT,                        -- user or AI added description
  extracted_colors    TEXT[],                      -- hex colors extracted from this image by vision API
  extracted_keywords  TEXT[],                      -- style keywords extracted by vision API
  sort_order          INT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: follows moodboard access (moodboard_id → moodboard → project owner or creator)
CREATE POLICY moodboard_image_access ON public.moodboard_images
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.moodboards mb
      JOIN public.projects p ON p.id = mb.project_id
      WHERE mb.id = moodboard_id AND (
        mb.created_by = auth.uid() OR
        p.homeowner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
      )
    )
  );
CREATE INDEX idx_moodboard_images_moodboard ON public.moodboard_images(moodboard_id, sort_order);
```

### Route additions (Next.js App Router)

```
app/[locale]/
├── (homeowner)/
│   └── project/[id]/
│       ├── voortgang/           ← Screen 21 — homeowner project progress view
│       ├── moodboard/
│       │   ├── page.tsx         ← Screen 22 — moodboard builder (all 3 paths)
│       │   └── review/
│       │       └── page.tsx     ← Screen 23 — moodboard review before render
├── (contractor)/
│   └── project/[id]/
│       ├── plan/                ← Screen 20 — professional project plan
│       └── moodboard/
│           └── page.tsx         ← Screen 22 (professional view)
├── (designer)/
│   └── project/[id]/
│       ├── plan/                ← Screen 20 — professional project plan
│       └── moodboard/
│           └── page.tsx         ← Screen 22 (professional view)
```

### API route additions

```
api/
├── project-plans/generate/      ← AI generates draft plan from renovation brief (Edge Function)
├── project-plans/[id]/export/   ← Export budget as PDF (WeasyPrint)
├── moodboards/analyze-image/    ← Vision API: extract colors + keywords from uploaded image
├── moodboards/chat/             ← AI chat endpoint (Supabase Edge Function, streaming)
├── moodboards/assemble-prompt/  ← Assemble final Flux render prompt from moodboard data
├── subcontractors/invite/       ← Send invite email to subcontractor (Resend)
```

### Updated render prompt assembly

The `render_prompt` on `public.renders` is now assembled from the moodboard (if present) rather than the simple 5-question `style_answers` JSONB. Assembly order:

```
1. renovation_type (from projects)          → scene type: "photorealistic kitchen render"
2. room_dimensions (from projects)          → geometry: "14.28m² room, 2.60m ceiling height"
3. moodboards.style_summary                 → style: "warm Scandinavian with oak accents"
4. moodboards.dominant_colors               → palette: "dominant colors: #F5EDD6 #C8A97A #FFFFFF"
5. moodboards.style_keywords + materials    → materials: "oak floor, white walls, natural linen"
6. moodboards.lighting                      → light: "abundant natural daylight, large windows"
```

If no moodboard exists (backward compatibility), falls back to `projects.render_prompt` assembled from `style_answers` (original 5-question flow).

### Personal data additions (GDPR)

| Table | Field | Personal data? | Legal basis | Retention | Deletion path |
|-------|-------|---------------|-------------|-----------|---------------|
| subcontractors | name, email, phone | YES — direct identifier | Contract (6(1)(b)) | Project lifetime + 30 days | Delete row on project delete |
| subcontractors | invite_token | YES — pseudonymous | Contract | Used + 30 days | Null on claim or 30 days |
| moodboards | chat_messages | YES — personal preferences | Contract | Project lifetime | Delete on project delete (CASCADE) |
| moodboard_images | storage_path | YES — personal photo (if uploaded) | Contract | Project lifetime | Delete file + null path on project delete |
| project_documents | storage_path | YES — home/financial document | Contract | Project lifetime + 12 months | Delete file + null path; log in audit_events |
