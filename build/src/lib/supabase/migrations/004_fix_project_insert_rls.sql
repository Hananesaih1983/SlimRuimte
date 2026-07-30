-- =============================================================================
-- SlimRuimte — 004_fix_project_insert_rls
--
-- NOT YET APPLIED. Written by the Weeks 1+2 independent test pass; run it
-- against Supabase before Week 3 opens the professional-initiated flow.
--
-- THE BUG
-- -------
-- 003_pro_initiated_workflow dropped `project_owner` (FOR ALL, USING
-- homeowner_id = auth.uid()) and replaced it with four per-operation policies.
-- The INSERT policy it installed is:
--
--   CREATE POLICY project_insert ON public.projects
--     FOR INSERT TO authenticated
--     WITH CHECK (TRUE);
--
-- `WITH CHECK (TRUE)` is not a narrowing of the old policy, it is the removal of
-- it. 001_init's `project_owner` policy applied `homeowner_id = auth.uid()` as
-- its WITH CHECK on INSERT; 003 replaced that with no constraint at all. The
-- migration's own design note is explicit that this was deliberate — "The
-- application layer MUST set initiated_by = auth.uid() and workflow_type on
-- insert; no database enforcement here to keep the policy simple" — but that
-- trades away the property CLAUDE.md and 001_init both name as the primary
-- boundary ("RLS is the primary permission boundary. Application-layer checks
-- are a second line of defence").
--
-- The application layer is not in the path. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is
-- by design public and shipped to the browser, and PostgREST is reachable
-- directly, so any authenticated user of any role can bypass
-- /api/projects/create entirely:
--
--   POST https://<ref>.supabase.co/rest/v1/projects
--   Authorization: Bearer <their own JWT>
--   {"homeowner_id":"<victim-uuid>","initiated_by":"<attacker-uuid>",
--    "title":"...","status":"draft"}
--
-- The row is accepted. It then satisfies `project_select` for the victim
-- (homeowner_id = auth.uid()), so it appears on the victim's dashboard, and
-- simultaneously for the attacker (initiated_by = auth.uid()), so they retain
-- read access to it. Two of the Weeks 1+2 acceptance criteria fail at the
-- database level as a result:
--   * "Contractor tries to create a project -> must get 403" — true through the
--     route handler, false through PostgREST.
--   * "Projects are independent, no data leakage between them" — an attacker can
--     plant a row into another user's project list.
--
-- THE FIX
-- -------
-- Constrain INSERT to rows the caller legitimately owns, while still permitting
-- the pro-initiated case 003 was written to enable (homeowner_id NULL, the
-- professional named in initiated_by/professional_id). Concretely: the caller
-- must stamp themselves as the initiator, and may not name anyone else as the
-- homeowner. That is exactly what /api/projects/create already sends, so no
-- application change is needed alongside this — the route was updated to set
-- initiated_by in the same pass.
--
-- Also closes the matching hole on UPDATE: 003's `project_update` WITH CHECK
-- does not pin homeowner_id, so anyone with update rights on a project could
-- reassign it to a different homeowner (or to themselves). That one cannot be
-- fixed in the policy, because a WITH CHECK expression only sees the NEW row and
-- so cannot express "unchanged" — tightening it to `homeowner_id = auth.uid()`
-- would lock the managing professional out of every collaborative project. It is
-- a BEFORE UPDATE trigger instead, the same shape 001_init already uses for
-- `prevent_role_change`. claim_project_invite() is unaffected: it is SECURITY
-- DEFINER, and the trigger exempts a transition out of NULL, which is exactly
-- and only what claiming does.
-- =============================================================================

BEGIN;

-- --- INSERT ------------------------------------------------------------------
DROP POLICY IF EXISTS project_insert ON public.projects;
CREATE POLICY project_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      -- The creator must identify themselves, and cannot forge the initiator.
      initiated_by = auth.uid()
      -- A homeowner-initiated project is owned by its creator; a pro-initiated
      -- one has no homeowner until the invite is claimed. Naming a third party
      -- is the case this rejects.
      AND (homeowner_id = auth.uid() OR homeowner_id IS NULL)
      -- Likewise, a professional may only enrol themselves as the manager.
      AND (professional_id = auth.uid() OR professional_id IS NULL)
    )
  );

-- --- UPDATE ------------------------------------------------------------------
-- `project_update` from 003 is left in place; ownership reassignment is blocked
-- by the trigger below instead, for the reason given in the header.
CREATE OR REPLACE FUNCTION public.prevent_project_owner_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role and background jobs run with auth.uid() IS NULL; admins are
  -- trusted by the permission matrix. Neither is constrained here.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Claiming an invite moves homeowner_id from NULL to a real user. That is the
  -- only legitimate change, and claim_project_invite() is SECURITY DEFINER so it
  -- does not reach this branch anyway — allowed here for defence in depth.
  IF OLD.homeowner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Any other attempt to move the project to a different owner is silently
  -- reverted rather than raised, matching prevent_role_change()'s behaviour.
  IF NEW.homeowner_id IS DISTINCT FROM OLD.homeowner_id THEN
    NEW.homeowner_id := OLD.homeowner_id;
  END IF;

  -- initiated_by is documented as "set at INSERT time; never changes".
  IF NEW.initiated_by IS DISTINCT FROM OLD.initiated_by THEN
    NEW.initiated_by := OLD.initiated_by;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_prevent_owner_reassignment ON public.projects;
CREATE TRIGGER projects_prevent_owner_reassignment
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.prevent_project_owner_reassignment();

COMMIT;

-- =============================================================================
-- TESTER VERDICT
-- Severity: HIGH — any authenticated user (any role) can INSERT into projects
--   via PostgREST directly
-- Exploitable: yes — contractor can create projects, spoofing homeowner_id
-- Fix: the migration above closes this. Apply before Week 3 build starts.
-- Workaround until applied: none — the anon key is public by design.
--
-- Second finding, same migration, same severity class:
--   003's `project_update` WITH CHECK does not pin homeowner_id, so a project
--   can be reassigned to a different owner by anyone holding update rights on
--   it. Closed above by `projects_prevent_owner_reassignment`, not by a policy,
--   because WITH CHECK sees only the NEW row and cannot express "unchanged".
--
-- Scope of what the automated tests can and cannot certify:
--   CERTIFIED — the application layer. 299 tests pass, including cross-user
--     isolation on every Weeks 1+2 write route, run against a mock Supabase
--     that enforces NO row-level security. Passing with the store wide open
--     proves the ROUTE isolates on its own rather than leaning on RLS.
--     See src/test/security/rls.test.ts.
--   NOT CERTIFIED — the database layer. Postgres RLS cannot execute under
--     vitest, so this finding comes from reading 001/002/003, not from a
--     failing test. It follows that no green test run, now or later, will
--     detect a regression here. Verify by hand after applying: sign in as a
--     contractor, POST to /rest/v1/projects with a spoofed homeowner_id, and
--     confirm a 42501.
-- =============================================================================
