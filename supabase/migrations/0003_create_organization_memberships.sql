-- =============================================================================
-- Migration 0003: organization_memberships
-- Purpose: Authoritative record for "does user X belong to org Y."
--          Used by the login pipeline to enforce:
--          "correct email + correct password + wrong organization = denied"
--          (Spec Section 3, AGENTS.md rule — enforced at DB layer via RLS).
-- RLS: Enabled in this migration. See AGENTS.md rule 2.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: organization_memberships
-- ---------------------------------------------------------------------------
CREATE TABLE public.organization_memberships (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text        NOT NULL DEFAULT 'protected_user'
                              CHECK (role IN ('org_admin', 'security_analyst', 'protected_user')),
  status          text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'suspended', 'invited', 'revoked')),
  invited_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- A user may have only ONE membership per organization
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_memberships_organization_id ON public.organization_memberships (organization_id);
CREATE INDEX idx_memberships_user_id         ON public.organization_memberships (user_id);

-- updated_at trigger (reuses function from migration 0001)
CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON public.organization_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

-- A user may see their own membership rows (across orgs, if multi-org ever applies).
CREATE POLICY "memberships_own_read"
  ON public.organization_memberships
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Org admins may list all membership rows for their organization.
-- Cross-org rows are blocked: an admin in org A cannot see memberships of org B.
CREATE POLICY "memberships_org_admin_read"
  ON public.organization_memberships
  FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id'
    )::uuid
    AND (
      -- Only org_admins of that org may list
      EXISTS (
        SELECT 1 FROM public.organization_memberships m2
        WHERE m2.user_id = auth.uid()
          AND m2.organization_id = organization_memberships.organization_id
          AND m2.role = 'org_admin'
          AND m2.status = 'active'
      )
    )
  );

-- INSERT: only service-role (NestJS api with service-role key).
-- UPDATE / DELETE: only service-role.
-- This is enforced both by RLS (no authenticated policy for writes)
-- and by the trigger guard in migration 0004.

-- ---------------------------------------------------------------------------
-- Helper function: verify_org_membership
-- Used by the NestJS auth service via RPC to atomically check that
-- a user has an ACTIVE membership in the EXACT organization they selected.
-- Returns TRUE only if membership exists and is active.
-- Runs with SECURITY DEFINER so it bypasses RLS — the function itself
-- enforces the correct isolation logic.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_org_membership(
  p_user_id         uuid,
  p_organization_id uuid
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships
    WHERE user_id         = p_user_id
      AND organization_id = p_organization_id
      AND status          = 'active'
  ) INTO v_exists;

  RETURN v_exists;
END;
$$;

-- Revoke public execute; only the service role (used by our NestJS API) calls this.
REVOKE EXECUTE ON FUNCTION public.verify_org_membership(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.verify_org_membership(uuid, uuid) TO service_role;
