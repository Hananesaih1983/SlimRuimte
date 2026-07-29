-- =============================================================================
-- SlimRuimte — 001_init
-- Initial schema, RLS policies and triggers.
-- Source of truth: ../venture/06_architecture.md (Stage 6: Architecture)
--
-- Run against a fresh Supabase project (eu-west-1, Ireland):
--   supabase db push          # or paste into the SQL editor
--
-- Design notes:
--  * RLS is the primary permission boundary. Application-layer checks
--    (src/proxy.ts, src/lib/auth.ts) are a second line of defence.
--  * `public.is_admin()` is SECURITY DEFINER so admin checks inside policies on
--    `public.users` do not recurse through that table's own RLS.
--  * Soft delete (`deleted_at`) on users/projects supports GDPR Art. 17 while
--    keeping referential integrity for audit and invoicing.
-- =============================================================================

BEGIN;

-- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =============================================================================
-- SHARED TRIGGER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- users
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.users (
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

COMMENT ON COLUMN public.users.role IS
  'Authoritative role. auth.users.raw_user_meta_data.role is a mirror used for '
  'cheap routing in src/proxy.ts, but it is user-writable via auth.updateUser() '
  'and must never be trusted for authorisation.';

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role) WHERE deleted_at IS NULL;


-- Admin check. SECURITY DEFINER bypasses RLS, which is what prevents the
-- policies on public.users from recursing into themselves.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
  );
$$;

-- Role of the current user, read from the authoritative table.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() AND deleted_at IS NULL;
$$;


-- Auto-insert into public.users when an auth.users row is created.
-- Without this the FK on every other table has nothing to point at, and the
-- first insert after signup fails.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT := NEW.raw_user_meta_data->>'role';
  resolved_role  TEXT;
  requested_lang TEXT := NEW.raw_user_meta_data->>'language';
BEGIN
  -- Never let arbitrary signup metadata grant admin, and never let an invalid
  -- value abort the signup transaction via the CHECK constraint.
  resolved_role := CASE
    WHEN requested_role IN ('homeowner','contractor','interior_designer','estate_agent')
      THEN requested_role
    ELSE 'homeowner'
  END;

  INSERT INTO public.users (id, email, role, first_name, last_name, language)
  VALUES (
    NEW.id,
    NEW.email,
    resolved_role,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    CASE WHEN requested_lang IN ('nl','en','fr') THEN requested_lang ELSE 'nl' END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Block self-service role escalation. Only admins (and the service role, which
-- bypasses RLS and runs as postgres) may change a role.
CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin() THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_prevent_role_change ON public.users;
CREATE TRIGGER users_prevent_role_change
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_change();

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- projects (homeowner multi-project)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
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

CREATE INDEX IF NOT EXISTS idx_projects_homeowner
  ON public.projects(homeowner_id, status, created_at DESC);

DROP TRIGGER IF EXISTS projects_set_updated_at ON public.projects;
CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- renders
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.renders (
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
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, render_number)
);

CREATE INDEX IF NOT EXISTS idx_renders_project ON public.renders(project_id, render_number);


-- =============================================================================
-- contractor_profiles
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contractor_profiles (
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

CREATE INDEX IF NOT EXISTS idx_contractor_matching
  ON public.contractor_profiles(availability, kvk_verified);

DROP TRIGGER IF EXISTS contractor_profiles_set_updated_at ON public.contractor_profiles;
CREATE TRIGGER contractor_profiles_set_updated_at
  BEFORE UPDATE ON public.contractor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- designer_profiles
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.designer_profiles (
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

CREATE INDEX IF NOT EXISTS idx_designer_matching
  ON public.designer_profiles(availability, kvk_verified);

DROP TRIGGER IF EXISTS designer_profiles_set_updated_at ON public.designer_profiles;
CREATE TRIGGER designer_profiles_set_updated_at
  BEFORE UPDATE ON public.designer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- estate_agent_profiles
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.estate_agent_profiles (
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


-- =============================================================================
-- leads (contractor + designer lead tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.leads (
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

CREATE INDEX IF NOT EXISTS idx_leads_recipient
  ON public.leads(recipient_id, status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_project
  ON public.leads(project_id, status);


-- =============================================================================
-- messages
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.users(id),
  body            TEXT NOT NULL,
  attachment_url  TEXT,
  attachment_name TEXT,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for realtime subscription
CREATE INDEX IF NOT EXISTS idx_messages_lead ON public.messages(lead_id, created_at ASC);


-- =============================================================================
-- reviews
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.reviews (
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

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee
  ON public.reviews(reviewee_id, published, created_at DESC);


-- Keep the denormalised rating columns on the profile tables in step with
-- published reviews, so matching queries never have to aggregate at read time.
CREATE OR REPLACE FUNCTION public.refresh_reviewee_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id   UUID := COALESCE(NEW.reviewee_id, OLD.reviewee_id);
  target_role TEXT := COALESCE(NEW.reviewee_role, OLD.reviewee_role);
  new_avg     NUMERIC(3,2);
  new_count   INT;
BEGIN
  SELECT ROUND(AVG(avg_rating), 2), COUNT(*)
    INTO new_avg, new_count
    FROM public.reviews
   WHERE reviewee_id = target_id AND published IS TRUE;

  IF target_role = 'contractor' THEN
    UPDATE public.contractor_profiles
       SET avg_rating = new_avg, review_count = COALESCE(new_count, 0)
     WHERE user_id = target_id;
  ELSE
    UPDATE public.designer_profiles
       SET avg_rating = new_avg, review_count = COALESCE(new_count, 0)
     WHERE user_id = target_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reviews_refresh_rating ON public.reviews;
CREATE TRIGGER reviews_refresh_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_reviewee_rating();


-- =============================================================================
-- property_scans (estate agent)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.property_scans (
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

CREATE INDEX IF NOT EXISTS idx_property_scans_agent
  ON public.property_scans(agent_id, status, created_at DESC);


-- =============================================================================
-- render_upgrades (Magnific upsell payments)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.render_upgrades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  render_id       UUID NOT NULL REFERENCES public.renders(id),
  homeowner_id    UUID NOT NULL REFERENCES public.users(id),
  price_eur       NUMERIC(6,2) DEFAULT 2.50,
  stripe_payment_intent_id TEXT,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_render_upgrades_homeowner
  ON public.render_upgrades(homeowner_id, created_at DESC);


-- =============================================================================
-- audit_events (instrumentation — replaces third-party analytics)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES public.users(id),
  session_id  TEXT,
  event_name  TEXT NOT NULL,               -- 'scan_started', 'renders_generated', etc.
  properties  JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
-- Retention: 24 months then anonymise/auto-delete (GDPR data minimisation).
-- Partition by month once volume warrants it; see 06_architecture.md.
CREATE INDEX IF NOT EXISTS idx_audit_event_name
  ON public.audit_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user
  ON public.audit_events(user_id, created_at DESC);


-- =============================================================================
-- ROW LEVEL SECURITY
-- Every table is deny-by-default; the policies below are the only way in.
-- The service_role key bypasses RLS entirely — keep it server-side.
-- =============================================================================

ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designer_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estate_agent_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_scans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.render_upgrades        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events           ENABLE ROW LEVEL SECURITY;


-- --- users -------------------------------------------------------------------
-- Own row + admin. Role changes are additionally blocked by the
-- users_prevent_role_change trigger.
DROP POLICY IF EXISTS user_self_read ON public.users;
CREATE POLICY user_self_read ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS user_self_update ON public.users;
CREATE POLICY user_self_update ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS user_admin_write ON public.users;
CREATE POLICY user_admin_write ON public.users
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- --- projects ----------------------------------------------------------------
-- RLS: homeowner sees own projects only; admin sees all
DROP POLICY IF EXISTS project_owner ON public.projects;
CREATE POLICY project_owner ON public.projects
  FOR ALL TO authenticated
  USING (homeowner_id = auth.uid() OR public.is_admin())
  WITH CHECK (homeowner_id = auth.uid() OR public.is_admin());

-- Contractors and designers may read the project behind a lead sent to them.
DROP POLICY IF EXISTS project_lead_recipient_read ON public.projects;
CREATE POLICY project_lead_recipient_read ON public.projects
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.project_id = projects.id AND l.recipient_id = auth.uid()
    )
  );


-- --- renders -----------------------------------------------------------------
-- RLS: project owner sees own renders; admin sees all
DROP POLICY IF EXISTS render_owner ON public.renders;
CREATE POLICY render_owner ON public.renders
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = renders.project_id
        AND (p.homeowner_id = auth.uid() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = renders.project_id
        AND (p.homeowner_id = auth.uid() OR public.is_admin())
    )
  );

-- Lead recipients see the renders that make up the visual brief.
DROP POLICY IF EXISTS render_lead_recipient_read ON public.renders;
CREATE POLICY render_lead_recipient_read ON public.renders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.project_id = renders.project_id AND l.recipient_id = auth.uid()
    )
  );


-- --- contractor_profiles -----------------------------------------------------
-- Public read is required for homeowner-facing matching (06_architecture.md).
-- WARNING: this exposes every column, including stripe_account_id and
-- dsa_identity_doc. Before launch, move those to a private side table or expose
-- the public fields through a security_invoker view and narrow this policy.
DROP POLICY IF EXISTS contractor_read ON public.contractor_profiles;
CREATE POLICY contractor_read ON public.contractor_profiles
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS contractor_write ON public.contractor_profiles;
CREATE POLICY contractor_write ON public.contractor_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());


-- --- designer_profiles -------------------------------------------------------
DROP POLICY IF EXISTS designer_read ON public.designer_profiles;
CREATE POLICY designer_read ON public.designer_profiles
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS designer_write ON public.designer_profiles;
CREATE POLICY designer_write ON public.designer_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());


-- --- estate_agent_profiles ---------------------------------------------------
-- Not part of any matching flow, so owner + admin only.
DROP POLICY IF EXISTS estate_agent_owner ON public.estate_agent_profiles;
CREATE POLICY estate_agent_owner ON public.estate_agent_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());


-- --- leads -------------------------------------------------------------------
-- RLS: homeowner sees leads for own project; contractor/designer sees own leads; admin all
DROP POLICY IF EXISTS lead_access ON public.leads;
CREATE POLICY lead_access ON public.leads
  FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = leads.project_id AND p.homeowner_id = auth.uid()
    )
    OR public.is_admin()
  );

-- Recipients accept/decline their own lead; homeowners may cancel theirs.
DROP POLICY IF EXISTS lead_respond ON public.leads;
CREATE POLICY lead_respond ON public.leads
  FOR UPDATE TO authenticated
  USING (
    recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = leads.project_id AND p.homeowner_id = auth.uid()
    )
    OR public.is_admin()
  )
  WITH CHECK (
    recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = leads.project_id AND p.homeowner_id = auth.uid()
    )
    OR public.is_admin()
  );

-- Leads are created by the matching algorithm (service role) or an admin.
DROP POLICY IF EXISTS lead_admin_write ON public.leads;
CREATE POLICY lead_admin_write ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());


-- --- messages ----------------------------------------------------------------
-- RLS: sender or lead recipient/homeowner only
DROP POLICY IF EXISTS message_access ON public.messages;
CREATE POLICY message_access ON public.messages
  FOR ALL TO authenticated
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.projects p ON p.id = l.project_id
      WHERE l.id = messages.lead_id
        AND (l.recipient_id = auth.uid() OR p.homeowner_id = auth.uid())
    )
    OR public.is_admin()
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.projects p ON p.id = l.project_id
      WHERE l.id = messages.lead_id
        AND (l.recipient_id = auth.uid() OR p.homeowner_id = auth.uid())
    )
  );


-- --- reviews -----------------------------------------------------------------
-- Published reviews are a public record (permission matrix); drafts and flagged
-- reviews stay visible to the parties involved and admin.
DROP POLICY IF EXISTS review_public_read ON public.reviews;
CREATE POLICY review_public_read ON public.reviews
  FOR SELECT
  USING (
    (published IS TRUE AND flagged IS FALSE)
    OR reviewer_id = auth.uid()
    OR reviewee_id = auth.uid()
    OR public.is_admin()
  );

-- Only the homeowner on the lead may post the review.
DROP POLICY IF EXISTS review_insert ON public.reviews;
CREATE POLICY review_insert ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.projects p ON p.id = l.project_id
      WHERE l.id = reviews.lead_id
        AND p.homeowner_id = auth.uid()
        AND l.recipient_id = reviews.reviewee_id
        AND l.status = 'accepted'
    )
  );

-- The reviewee may add a response; admin may moderate.
DROP POLICY IF EXISTS review_respond ON public.reviews;
CREATE POLICY review_respond ON public.reviews
  FOR UPDATE TO authenticated
  USING (reviewee_id = auth.uid() OR public.is_admin())
  WITH CHECK (reviewee_id = auth.uid() OR public.is_admin());


-- --- property_scans ----------------------------------------------------------
DROP POLICY IF EXISTS property_scan_owner ON public.property_scans;
CREATE POLICY property_scan_owner ON public.property_scans
  FOR ALL TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin())
  WITH CHECK (agent_id = auth.uid() OR public.is_admin());


-- --- render_upgrades ---------------------------------------------------------
-- Reads are for the buyer; writes go through the Stripe webhook (service role).
DROP POLICY IF EXISTS render_upgrade_owner_read ON public.render_upgrades;
CREATE POLICY render_upgrade_owner_read ON public.render_upgrades
  FOR SELECT TO authenticated
  USING (homeowner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS render_upgrade_owner_insert ON public.render_upgrades;
CREATE POLICY render_upgrade_owner_insert ON public.render_upgrades
  FOR INSERT TO authenticated
  WITH CHECK (homeowner_id = auth.uid() OR public.is_admin());


-- --- audit_events ------------------------------------------------------------
-- Write-only for users (append their own events); admin reads analytics.
DROP POLICY IF EXISTS audit_self_insert ON public.audit_events;
CREATE POLICY audit_self_insert ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS audit_admin_read ON public.audit_events;
CREATE POLICY audit_admin_read ON public.audit_events
  FOR SELECT TO authenticated
  USING (public.is_admin());


COMMIT;
