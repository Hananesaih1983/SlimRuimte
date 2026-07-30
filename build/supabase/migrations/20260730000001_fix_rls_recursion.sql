-- =============================================================================
-- SlimRuimte — 002_fix_rls_recursion
--
-- Fixes `42P17 infinite recursion detected in policy` on projects, leads,
-- renders and messages.
--
-- THE BUG
-- -------
-- 001_init created policies that reach across tables with plain subqueries:
--
--   projects.project_lead_recipient_read   SELECT ... FROM public.leads
--   leads.lead_access                      SELECT ... FROM public.projects
--
-- A subquery inside a policy is itself subject to the target table's RLS, so
-- reading `projects` evaluates the leads policy, which reads `projects`, which
-- evaluates the leads policy... Postgres detects the cycle and aborts the whole
-- statement with 42P17. The same cycle runs through renders and messages.
--
-- The practical effect was total: no authenticated non-admin user could run
-- ANY statement against projects, leads, renders or messages — not even
-- `INSERT INTO projects` for their own row, because the RETURNING clause reads
-- back through the same broken policy set. Admins were unaffected (is_admin()
-- short-circuits first), which is why it was not caught at build time.
--
-- THE FIX
-- -------
-- Move every cross-table membership check into a SECURITY DEFINER function.
-- Those run as the function owner and therefore bypass RLS, which breaks the
-- cycle at its root. This is the same technique 001_init already uses for
-- `public.is_admin()` and for exactly the same reason.
--
-- Each helper returns only a boolean and is scoped to `auth.uid()`, so bypassing
-- RLS leaks nothing: a caller can only ever learn facts about their own access.
--
-- The permission model is unchanged — these policies grant precisely what
-- 001_init intended, they just no longer recurse.
-- =============================================================================

BEGIN;


-- =============================================================================
-- MEMBERSHIP HELPERS (SECURITY DEFINER — bypass RLS to break policy cycles)
-- =============================================================================

-- Does the current user own this project?
CREATE OR REPLACE FUNCTION public.user_owns_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id
      AND homeowner_id = auth.uid()
      AND deleted_at IS NULL
  );
$$;

-- Has a lead for this project been sent to the current user?
CREATE OR REPLACE FUNCTION public.user_has_lead_for_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leads
    WHERE project_id = p_project_id
      AND recipient_id = auth.uid()
  );
$$;

-- May the current user see this lead — as its recipient, or as the homeowner of
-- the project behind it?
CREATE OR REPLACE FUNCTION public.user_can_access_lead(p_lead_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads l
    JOIN public.projects p ON p.id = l.project_id
    WHERE l.id = p_lead_id
      AND (l.recipient_id = auth.uid() OR p.homeowner_id = auth.uid())
  );
$$;

-- Is the current user the homeowner entitled to review this accepted lead?
-- Mirrors the conditions 001_init put in `review_insert`.
CREATE OR REPLACE FUNCTION public.user_may_review_lead(
  p_lead_id     UUID,
  p_reviewee_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads l
    JOIN public.projects p ON p.id = l.project_id
    WHERE l.id = p_lead_id
      AND p.homeowner_id = auth.uid()
      AND l.recipient_id = p_reviewee_id
      AND l.status = 'accepted'
  );
$$;


-- =============================================================================
-- projects
-- =============================================================================

-- `project_owner` is a plain column comparison and never recursed; left as is.

DROP POLICY IF EXISTS project_lead_recipient_read ON public.projects;
CREATE POLICY project_lead_recipient_read ON public.projects
  FOR SELECT TO authenticated
  USING (public.user_has_lead_for_project(id));


-- =============================================================================
-- leads
-- =============================================================================

DROP POLICY IF EXISTS lead_access ON public.leads;
CREATE POLICY lead_access ON public.leads
  FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid()
    OR public.user_owns_project(project_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS lead_respond ON public.leads;
CREATE POLICY lead_respond ON public.leads
  FOR UPDATE TO authenticated
  USING (
    recipient_id = auth.uid()
    OR public.user_owns_project(project_id)
    OR public.is_admin()
  )
  WITH CHECK (
    recipient_id = auth.uid()
    OR public.user_owns_project(project_id)
    OR public.is_admin()
  );


-- =============================================================================
-- renders
-- =============================================================================

DROP POLICY IF EXISTS render_owner ON public.renders;
CREATE POLICY render_owner ON public.renders
  FOR ALL TO authenticated
  USING (public.user_owns_project(project_id) OR public.is_admin())
  WITH CHECK (public.user_owns_project(project_id) OR public.is_admin());

DROP POLICY IF EXISTS render_lead_recipient_read ON public.renders;
CREATE POLICY render_lead_recipient_read ON public.renders
  FOR SELECT TO authenticated
  USING (public.user_has_lead_for_project(project_id));


-- =============================================================================
-- messages
-- =============================================================================

DROP POLICY IF EXISTS message_access ON public.messages;
CREATE POLICY message_access ON public.messages
  FOR ALL TO authenticated
  USING (
    sender_id = auth.uid()
    OR public.user_can_access_lead(lead_id)
    OR public.is_admin()
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND public.user_can_access_lead(lead_id)
  );


-- =============================================================================
-- reviews
-- =============================================================================

-- SELECT on reviews did not recurse (its branches never leave the table), but
-- INSERT did, through the same leads -> projects cycle.
DROP POLICY IF EXISTS review_insert ON public.reviews;
CREATE POLICY review_insert ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND public.user_may_review_lead(lead_id, reviewee_id)
  );


COMMIT;
