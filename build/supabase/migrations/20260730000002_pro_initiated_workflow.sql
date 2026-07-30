-- =============================================================================
-- SlimRuimte — 003_pro_initiated_workflow
--
-- Extends the projects table and adds all supporting tables, policies and
-- helper functions required for professional-initiated project workflows.
--
-- CONTEXT & DESIGN DECISIONS
-- --------------------------
-- Until this migration every project was created by a homeowner:
--   homeowner registers → creates project → receives leads → hires professional
--
-- The pro-initiated flow inverts the relationship:
--   professional registers → creates project on behalf of client →
--   client receives invite email → claims project → collaborative workflow begins
--
-- Key decisions recorded here:
--
-- 1. homeowner_id becomes NULLABLE
--    Pro-initiated projects have no homeowner until the client claims the invite.
--    Making homeowner_id nullable is the least disruptive change: existing
--    homeowner-initiated rows are unaffected; the NOT NULL constraint is simply
--    relaxed. All downstream policies are tightened around initiated_by instead.
--
-- 2. initiated_by + workflow_type are the new canonical ownership signal
--    Rather than branching on whether homeowner_id is null (fragile), callers
--    should read workflow_type:
--      'homeowner_initiated' — created by homeowner; homeowner_id always set
--      'pro_initiated'       — created by professional; homeowner_id may be null
--      'collaborative'       — client has claimed the invite; both parties active
--
-- 3. professional_visibility_settings is a JSONB gate, not a content mirror
--    The professional controls which generated assets the homeowner can see.
--    We store booleans per asset type rather than copying assets, because the
--    actual media files live in Supabase Storage (or external URLs). The API
--    layer calls user_can_see_project_asset() before presigning any URL.
--    This gives the professional a natural upsell moment: "approve the renders
--    to your client" — which also builds trust without losing control.
--
-- 4. project_invites is a separate table (not just a token column on projects)
--    We want a full audit trail: who invited whom, when it was claimed, whether
--    it expired. A dedicated table makes it easy to resend (new row), revoke
--    (delete or let expire), and query without hitting projects in the hot path.
--    The invite token on projects (client_invite_token) is kept as a quick lookup
--    column; project_invites is the authoritative record.
--
-- 5. professional_subscriptions is a simple billing state mirror
--    Stripe is the source of truth; this table is updated by the Stripe webhook
--    handler (service role). RLS on this table allows professionals to read their
--    own plan. projects_limit = NULL means unlimited (Expert plan).
--
-- 6. RLS is split into four separate policies on projects (SELECT / INSERT /
--    UPDATE / DELETE) rather than one catch-all FOR ALL policy, because the
--    permission matrix genuinely differs per operation:
--      - SELECT: broad (homeowner, initiator, professional, lead recipient, admin)
--      - INSERT: any authenticated user (homeowner OR professional starts a project)
--      - UPDATE: initiator, professional, homeowner, admin
--      - DELETE: initiator or admin only — soft-delete via deleted_at recommended
--    Using FOR ALL with a union of all conditions would silently over-grant on
--    INSERT and DELETE if the USING clause is also applied as WITH CHECK.
--
-- 7. claim_project_invite is SECURITY DEFINER
--    It needs to write to both projects and project_invites in a single
--    transaction, on behalf of a user who may not yet have UPDATE rights on
--    projects (they're claiming precisely to get that right). SECURITY DEFINER
--    + strict token/expiry/claimed_at validation keeps this safe.
--
-- DEPENDENCIES
-- ------------
--   001_init.sql  — public.users, public.projects, public.leads,
--                   public.is_admin(), public.set_updated_at()
--   002_fix_rls_recursion.sql — public.user_has_lead_for_project()
--
-- =============================================================================

BEGIN;

-- Enable pgcrypto for gen_random_bytes() used in project_invites token default.
-- Already enabled in 001_init but CREATE EXTENSION IF NOT EXISTS is idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =============================================================================
-- STEP 1 — ALTER TABLE public.projects
-- =============================================================================

-- 1a. Relax the NOT NULL constraint on homeowner_id.
--     Pro-initiated projects have no homeowner until the client claims the invite.
--     Existing rows are unaffected (homeowner_id remains set on all of them).
ALTER TABLE public.projects
  ALTER COLUMN homeowner_id DROP NOT NULL;

-- 1b. initiated_by — who created this project (homeowner OR professional).
--     NULL is intentionally allowed for legacy rows created before this migration;
--     new rows must always set this via the application layer.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS initiated_by UUID REFERENCES public.users(id);

-- 1c. initiated_by_role — role of the creator at the time they created the project.
--     Denormalised here so queries don't need to JOIN public.users to filter on role.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS initiated_by_role TEXT
    CHECK (initiated_by_role IN ('homeowner','contractor','interior_designer','estate_agent'));

-- 1d. workflow_type — canonical workflow discriminator (see design notes above).
--     Default is 'homeowner_initiated' so all existing rows get the right value
--     without a backfill UPDATE.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS workflow_type TEXT NOT NULL DEFAULT 'homeowner_initiated'
    CHECK (workflow_type IN ('homeowner_initiated','pro_initiated','collaborative'));

-- 1e. client_email / client_name — contact details for the client in a pro-initiated
--     project where the client is not yet registered on SlimRuimte.
--     These are used to send the invite email and pre-fill the claim form.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_email TEXT;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_name TEXT;

-- 1f. professional_id — the professional managing the project.
--     Set on pro-initiated projects; may also be set on homeowner-initiated
--     projects after a professional is matched via the marketplace.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES public.users(id);

-- 1g. client_invite_token — short-circuit lookup for the claim URL.
--     The authoritative record is in public.project_invites; this column is a
--     convenience so the API can validate a token without a JOIN.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_invite_token TEXT UNIQUE;

-- 1h. Invite lifecycle timestamps on projects.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_invite_sent_at TIMESTAMPTZ;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_registered_at TIMESTAMPTZ;

-- 1i. professional_visibility_settings — JSONB gate for asset access.
--     The professional flips individual booleans to release assets to the client.
--     Default: everything locked until explicitly released.
--     Asset keys MUST match the p_asset values accepted by user_can_see_project_asset().
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS professional_visibility_settings JSONB
    NOT NULL DEFAULT '{"renders": false, "floor_plan": false, "elevations": false, "model_3d": false, "brief": false}'::jsonb;

COMMENT ON COLUMN public.projects.homeowner_id IS
  'NULL until a pro-initiated project is claimed by the client via claim_project_invite(). '
  'Always set for homeowner_initiated workflow_type.';

COMMENT ON COLUMN public.projects.initiated_by IS
  'The auth.uid() of the user who created this project — homeowner OR professional. '
  'Set at INSERT time; never changes. Use workflow_type to distinguish the two cases.';

COMMENT ON COLUMN public.projects.workflow_type IS
  'homeowner_initiated: standard flow, homeowner_id always set. '
  'pro_initiated: professional created on behalf of client, homeowner_id may be null. '
  'collaborative: client has claimed the invite, both parties active.';

COMMENT ON COLUMN public.projects.professional_visibility_settings IS
  'JSONB object keyed by asset type (renders, floor_plan, elevations, model_3d, brief). '
  'Value TRUE means the professional has released that asset to the homeowner/client. '
  'Evaluated by user_can_see_project_asset() on every asset request.';


-- =============================================================================
-- STEP 2 — CREATE TABLE public.professional_subscriptions
-- =============================================================================
-- Billing state mirror for professional accounts (contractor + interior_designer).
-- Stripe is the authoritative source; this table is written by the webhook handler
-- running as service role. Professionals read their own plan via RLS below.

CREATE TABLE IF NOT EXISTS public.professional_subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The professional this subscription belongs to.
  user_id                 UUID NOT NULL REFERENCES public.users(id),

  -- Subscription tier. Prices (EUR/month): starter=99, professional=199, expert=299.
  plan                    TEXT NOT NULL
                            CHECK (plan IN ('starter','professional','expert')),
  price_eur               NUMERIC(8,2),   -- mirrors the Stripe plan price at creation time

  -- Stripe identifiers — populated by the webhook handler; null until paid.
  stripe_subscription_id  TEXT UNIQUE,
  stripe_customer_id      TEXT,

  -- Subscription lifecycle state.
  status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','past_due','cancelled','trialing')),
  trial_ends_at           TIMESTAMPTZ,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,

  -- Usage tracking for the current billing period.
  -- projects_limit = NULL means unlimited (Expert plan).
  projects_this_period    INT NOT NULL DEFAULT 0,
  projects_limit          INT,                          -- NULL = unlimited

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.professional_subscriptions IS
  'Billing state for contractor and interior_designer users. '
  'Written exclusively by the Stripe webhook (service role). '
  'projects_limit = NULL signals the Expert plan (unlimited projects).';

COMMENT ON COLUMN public.professional_subscriptions.projects_limit IS
  'Maximum projects the professional may create in the current billing period. '
  'NULL = unlimited (Expert plan at €299/month).';

DROP TRIGGER IF EXISTS professional_subscriptions_set_updated_at
  ON public.professional_subscriptions;
CREATE TRIGGER professional_subscriptions_set_updated_at
  BEFORE UPDATE ON public.professional_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- STEP 3 — CREATE TABLE public.project_invites
-- =============================================================================
-- Full audit trail for every invite sent to a client on a pro-initiated project.
-- Tokens are 32 random bytes encoded as hex (64 chars, 256-bit entropy).
-- The token DEFAULT uses gen_random_bytes() from pgcrypto — secure and collision-free.

CREATE TABLE IF NOT EXISTS public.project_invites (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The project this invite grants access to.
  project_id    UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- The professional who sent the invite.
  invited_by    UUID        NOT NULL REFERENCES public.users(id),

  -- Client contact details (may differ from projects.client_email if a resend changes them).
  client_email  TEXT        NOT NULL,
  client_name   TEXT,

  -- 64-char hex token (256-bit entropy). Sent in the invite email as a URL parameter.
  token         TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Claim lifecycle.
  claimed_at    TIMESTAMPTZ,
  claimed_by    UUID        REFERENCES public.users(id),   -- auth.uid() of the claimer

  -- Tokens expire after 30 days; professionals can resend (new row) to get a fresh token.
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.project_invites IS
  'Audit log of every project invite sent to a prospective client. '
  'A new row is inserted on each resend; old rows are not deleted. '
  'Token entropy: 32 random bytes → 256-bit → effectively unguessable.';

COMMENT ON COLUMN public.project_invites.token IS
  'URL-safe hex token. Included in the invite email as ?token=<value>. '
  'claim_project_invite() validates expiry and claimed_at before accepting.';


-- =============================================================================
-- STEP 4 — INDEXES
-- =============================================================================

-- projects — new lookup columns
CREATE INDEX IF NOT EXISTS idx_projects_initiated_by
  ON public.projects(initiated_by);

CREATE INDEX IF NOT EXISTS idx_projects_professional_id
  ON public.projects(professional_id);

CREATE INDEX IF NOT EXISTS idx_projects_workflow_type
  ON public.projects(workflow_type);

-- project_invites — token lookup is on the hot claim path
CREATE INDEX IF NOT EXISTS idx_project_invites_token
  ON public.project_invites(token);

-- professional_subscriptions — webhook writes and plan checks
CREATE INDEX IF NOT EXISTS idx_professional_subscriptions_user
  ON public.professional_subscriptions(user_id);


-- =============================================================================
-- STEP 5 — UPDATE RLS POLICIES ON public.projects
-- =============================================================================
-- The old FOR ALL policy (project_owner) used homeowner_id = auth.uid(), which
-- no longer covers professional-initiated projects where homeowner_id may be null.
-- We split into four operation-specific policies (see design notes, point 6).

-- Drop all policies from 001_init and 002_fix_rls_recursion that touch projects.
-- We replace them wholesale so there are no permission gaps or overlaps.
DROP POLICY IF EXISTS project_owner              ON public.projects;
DROP POLICY IF EXISTS project_lead_recipient_read ON public.projects;

-- --- SELECT ------------------------------------------------------------------
-- A user may read a project if they are the homeowner, initiator, managing
-- professional, a lead recipient, or an admin.
-- user_has_lead_for_project() is SECURITY DEFINER (from 002_fix_rls_recursion)
-- so it bypasses RLS on leads and does not recurse.
DROP POLICY IF EXISTS project_select ON public.projects;
CREATE POLICY project_select ON public.projects
  FOR SELECT TO authenticated
  USING (
    homeowner_id      = auth.uid()
    OR initiated_by   = auth.uid()
    OR professional_id = auth.uid()
    OR public.user_has_lead_for_project(id)
    OR public.is_admin()
  );

-- --- INSERT ------------------------------------------------------------------
-- Any authenticated user may create a project (homeowner starting their own
-- project, or a professional creating on behalf of a client).
-- The application layer MUST set initiated_by = auth.uid() and workflow_type
-- on insert; no database enforcement here to keep the policy simple.
DROP POLICY IF EXISTS project_insert ON public.projects;
CREATE POLICY project_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- --- UPDATE ------------------------------------------------------------------
-- Homeowner, initiator, managing professional, or admin may update a project.
DROP POLICY IF EXISTS project_update ON public.projects;
CREATE POLICY project_update ON public.projects
  FOR UPDATE TO authenticated
  USING (
    initiated_by    = auth.uid()
    OR professional_id = auth.uid()
    OR homeowner_id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    initiated_by    = auth.uid()
    OR professional_id = auth.uid()
    OR homeowner_id = auth.uid()
    OR public.is_admin()
  );

-- --- DELETE ------------------------------------------------------------------
-- Only the original creator (initiated_by) or an admin may delete a project.
-- Note: prefer soft-delete (setting deleted_at) over hard DELETE; this policy
-- is a safety net, not the primary deletion mechanism.
DROP POLICY IF EXISTS project_delete ON public.projects;
CREATE POLICY project_delete ON public.projects
  FOR DELETE TO authenticated
  USING (
    initiated_by = auth.uid()
    OR public.is_admin()
  );


-- =============================================================================
-- STEP 6 — RLS ON NEW TABLES
-- =============================================================================

ALTER TABLE public.professional_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invites             ENABLE ROW LEVEL SECURITY;

-- --- professional_subscriptions ----------------------------------------------
-- Professionals read and manage their own subscription; admins see all.
-- Writes go through the Stripe webhook (service role) or admin; no INSERT policy
-- for regular users because subscription rows are created by the billing backend.
DROP POLICY IF EXISTS pro_sub_owner_read ON public.professional_subscriptions;
CREATE POLICY pro_sub_owner_read ON public.professional_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS pro_sub_admin_write ON public.professional_subscriptions;
CREATE POLICY pro_sub_admin_write ON public.professional_subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --- project_invites ---------------------------------------------------------
-- The professional who created the invite can read/manage it.
-- The homeowner (claimer) can read their own invite so the claim page can show
-- project details before they confirm. Claim mutations go through
-- claim_project_invite() (SECURITY DEFINER) so no UPDATE policy is needed here.
DROP POLICY IF EXISTS project_invite_professional ON public.project_invites;
CREATE POLICY project_invite_professional ON public.project_invites
  FOR ALL TO authenticated
  USING (invited_by = auth.uid() OR public.is_admin())
  WITH CHECK (invited_by = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS project_invite_client_read ON public.project_invites;
CREATE POLICY project_invite_client_read ON public.project_invites
  FOR SELECT TO authenticated
  USING (claimed_by = auth.uid());


-- =============================================================================
-- STEP 7 — SECURITY DEFINER FUNCTION: public.user_can_see_project_asset()
-- =============================================================================
-- Called by every API route that returns a generated asset (render URL,
-- floor plan PDF, elevations PDF, 3-D model GLB, style brief).
--
-- Return logic:
--   TRUE  if caller is the professional/initiator of this project, OR
--   TRUE  if caller is admin, OR
--   TRUE  if caller is the homeowner AND the professional has released this asset
--          (professional_visibility_settings->p_asset = true), OR
--   FALSE otherwise.
--
-- p_asset must be one of: 'renders', 'floor_plan', 'elevations', 'model_3d', 'brief'
-- Passing any other value safely returns FALSE (no whitelist bypass possible).
--
-- SECURITY DEFINER is required so the SELECT on public.projects bypasses the
-- caller's own RLS on that table (which itself calls this function, creating
-- a potential cycle if we used SECURITY INVOKER). The function only reads
-- the one project row identified by p_project_id, so no data leakage occurs.

CREATE OR REPLACE FUNCTION public.user_can_see_project_asset(
  p_project_id UUID,
  p_asset      TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project          public.projects%ROWTYPE;
  v_valid_assets     TEXT[] := ARRAY['renders','floor_plan','elevations','model_3d','brief'];
BEGIN
  -- Guard: only accept known asset keys to prevent JSONB injection tricks.
  IF p_asset IS NULL OR NOT (p_asset = ANY(v_valid_assets)) THEN
    RETURN FALSE;
  END IF;

  -- Fetch the project row (bypasses RLS because SECURITY DEFINER).
  SELECT * INTO v_project
    FROM public.projects
   WHERE id = p_project_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Admin always has full access.
  IF public.is_admin() THEN
    RETURN TRUE;
  END IF;

  -- The professional who owns or manages the project always has full access.
  IF v_project.initiated_by = auth.uid()
     OR v_project.professional_id = auth.uid() THEN
    RETURN TRUE;
  END IF;

  -- The homeowner/client may only see assets that the professional has released.
  IF v_project.homeowner_id = auth.uid() THEN
    RETURN COALESCE(
      (v_project.professional_visibility_settings ->> p_asset)::boolean,
      FALSE
    );
  END IF;

  -- Everyone else: no access.
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.user_can_see_project_asset(UUID, TEXT) IS
  'Gate function for generated asset URLs. Call before presigning any Storage URL or '
  'returning floor plan / render / model data to the client. '
  'p_asset must be one of: renders, floor_plan, elevations, model_3d, brief.';


-- =============================================================================
-- STEP 8 — SECURITY DEFINER FUNCTION: public.claim_project_invite()
-- =============================================================================
-- Called when a homeowner navigates to /invite?token=<hex> and confirms claim.
-- Performs the full claim transaction atomically:
--   1. Find the project_invites row by token.
--   2. Validate: token exists, not expired, not already claimed.
--   3. Update projects: set homeowner_id, workflow_type = 'collaborative',
--      client_registered_at = NOW().
--   4. Update project_invites: set claimed_at, claimed_by.
--   5. Return the project_id so the caller can redirect to /projects/<id>.
--
-- Returns NULL on any validation failure (caller should show an error page).
--
-- SECURITY DEFINER is required for step 3: the homeowner does not yet have
-- UPDATE rights on projects.id (that right is granted only after this function
-- runs and sets homeowner_id = auth.uid()). Running as the function owner (
-- typically postgres/service role) is safe because all mutations are tightly
-- scoped to the single row identified by the validated token.

CREATE OR REPLACE FUNCTION public.claim_project_invite(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite   public.project_invites%ROWTYPE;
  v_project  public.projects%ROWTYPE;
BEGIN
  -- 1. Look up the invite by token.
  SELECT * INTO v_invite
    FROM public.project_invites
   WHERE token = p_token
   FOR UPDATE;  -- lock the row to prevent concurrent double-claim

  IF NOT FOUND THEN
    -- Token does not exist.
    RETURN NULL;
  END IF;

  -- 2a. Already claimed?
  IF v_invite.claimed_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- 2b. Expired?
  IF v_invite.expires_at < NOW() THEN
    RETURN NULL;
  END IF;

  -- 3. Fetch the project (for the soft-delete guard).
  SELECT * INTO v_project
    FROM public.projects
   WHERE id = v_invite.project_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    -- Project was deleted between invite creation and claim.
    RETURN NULL;
  END IF;

  -- 4. Update the project: assign the homeowner and mark as collaborative.
  UPDATE public.projects
     SET homeowner_id          = auth.uid(),
         workflow_type         = 'collaborative',
         client_registered_at  = NOW()
   WHERE id = v_invite.project_id;

  -- 5. Mark the invite as claimed.
  UPDATE public.project_invites
     SET claimed_at = NOW(),
         claimed_by = auth.uid()
   WHERE id = v_invite.id;

  RETURN v_invite.project_id;
END;
$$;

COMMENT ON FUNCTION public.claim_project_invite(TEXT) IS
  'Atomically claims a project invite token. Call from the /invite confirmation page. '
  'Returns the project_id on success, NULL on failure (invalid/expired/already-claimed token). '
  'On success: projects.homeowner_id is set to auth.uid(), workflow_type becomes ''collaborative''.';


COMMIT;
