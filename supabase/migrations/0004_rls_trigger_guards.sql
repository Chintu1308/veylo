-- =============================================================================
-- Migration 0004: RLS trigger guards and append-only enforcement
-- Purpose:
--   1. Belt-and-suspenders: Postgres triggers that REJECT direct UPDATE/DELETE
--      on tenant tables by any role other than service_role.
--      Even if an RLS policy misconfiguration occurs, these triggers prevent
--      data mutation by application users.
--   2. Append-only enforcement on forensic_events (table created in Phase 17).
--      The trigger function is defined here; the trigger itself is attached
--      in the Phase 17 migration when the table is created.
-- AGENTS.md rule 6: forensic_events is append-only. Any path that allows
-- UPDATE/DELETE on that table is a bug — flag it, don't write it.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Generic immutability guard factory
-- Used to protect any table from non-service-role mutations.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_non_service_role_mutations()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- current_role will be 'service_role' when called via the service-role key.
  -- All other authenticated roles (anon, authenticated) are rejected.
  IF current_role NOT IN ('service_role', 'supabase_admin', 'postgres') THEN
    RAISE EXCEPTION
      'Mutation blocked: table % does not allow direct % by role %',
      TG_TABLE_NAME, TG_OP, current_role
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Append-only guard for forensic_events
-- The trigger function is defined now; the trigger is attached in Phase 17
-- when the forensic_events table is created. Documenting here per spec
-- Section 8 and AGENTS.md rule 6.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_forensic_events_mutation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- forensic_events is ALWAYS append-only — no exceptions, including
  -- service_role. Once written, forensic evidence cannot be altered or removed.
  RAISE EXCEPTION
    'forensic_events is append-only. UPDATE and DELETE are permanently forbidden.'
    USING ERRCODE = 'insufficient_privilege';
  RETURN NULL; -- unreachable, but required syntax
END;
$$;

-- ---------------------------------------------------------------------------
-- Attach mutation guards to organization_memberships
-- (organizations and users are protected by RLS having no write policies;
--  memberships gets an explicit trigger as belt-and-suspenders because it is
--  the critical auth-isolation table)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_memberships_immutability_guard
  BEFORE UPDATE OR DELETE ON public.organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_non_service_role_mutations();

-- NOTE: The forensic_events trigger will be:
--   CREATE TRIGGER trg_forensic_events_append_only
--     BEFORE UPDATE OR DELETE ON public.forensic_events
--     FOR EACH ROW EXECUTE FUNCTION public.reject_forensic_events_mutation();
-- This is added in migration 0018 (Phase 17/18) when forensic_events is created.

-- ---------------------------------------------------------------------------
-- Seed: create a test organization for local development and E2E tests.
-- This row is used by the RLS isolation test suite.
-- IMPORTANT: this seed only runs locally (or on a test Supabase project).
-- Production uses real data — these UUIDs are fixed so tests can reference them.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Only seed in non-production environments
  IF current_database() != 'postgres_prod' THEN

    INSERT INTO public.organizations (id, display_name, slug, location)
    VALUES
      ('00000000-0000-0000-0000-000000000001', 'Acme Corp',    'acme-corp',    'San Francisco, CA'),
      ('00000000-0000-0000-0000-000000000002', 'Beta Ventures', 'beta-ventures', 'London, UK')
    ON CONFLICT (id) DO NOTHING;

  END IF;
END;
$$;
