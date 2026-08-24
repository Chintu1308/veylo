-- =============================================================================
-- Migration 0002: users (public profile extending auth.users)
-- Purpose: Stores profile and org-role data for each Supabase Auth user.
--          auth.users (Supabase's own table) handles credentials.
--          This table stores the rest: org membership, role, display name, etc.
-- RLS: Enabled in this migration. See AGENTS.md rule 2.
-- NOTE: Passwords are managed by Supabase Auth (Argon2id). We never store or
--       touch credentials. See AGENTS.md rule 4.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: users
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
  -- mirrors auth.users primary key — not a separate sequence
  id              uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid        REFERENCES public.organizations(id) ON DELETE SET NULL,
  display_name    text        CHECK (char_length(display_name) <= 100),
  avatar_url      text,
  -- role within their organization: org_admin | security_analyst | protected_user
  role            text        NOT NULL DEFAULT 'protected_user'
                              CHECK (role IN ('org_admin', 'security_analyst', 'protected_user')),
  -- account status
  status          text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'suspended', 'pending_verification')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_organization_id ON public.users (organization_id);

-- updated_at trigger (reuses function from migration 0001)
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users may read and update their own profile row.
CREATE POLICY "users_own_profile_select"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "users_own_profile_update"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Org-scoped read: members of the same org may list each other's public profiles.
-- Cross-org reads are blocked: a user in org A cannot see users in org B.
CREATE POLICY "users_org_member_read"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id'
    )::uuid
  );

-- Anon users cannot read this table at all.
-- INSERT: only via service-role (triggered during Supabase Auth sign-up webhook).
-- DELETE: only via service-role or CASCADE from auth.users deletion.

-- ---------------------------------------------------------------------------
-- Auto-create profile on Supabase Auth sign-up
-- This trigger fires when a new row is inserted into auth.users and creates
-- the corresponding public.users profile row with default values.
-- The organization_id is populated after the user creates their org (Phase 6).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.users (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
