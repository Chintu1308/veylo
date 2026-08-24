-- =============================================================================
-- Migration 0001: organizations
-- Purpose: Core tenant table. Every tenant-scoped record in the system
--          references this table via organization_id.
-- RLS: Enabled in this migration. No table goes live without RLS.
--      See AGENTS.md rule 2.
-- =============================================================================

-- Enable pgcrypto for gen_random_uuid() if not already present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Table: organizations
-- ---------------------------------------------------------------------------
CREATE TABLE public.organizations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name  text        NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 100),
  slug          text        NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  logo_url      text,
  location      text,
  status        text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for org search by name (case-insensitive prefix match)
CREATE INDEX idx_organizations_display_name ON public.organizations
  USING gin (to_tsvector('english', display_name));

-- Index for slug lookups (used in forgot-password org-scoped flow)
CREATE UNIQUE INDEX idx_organizations_slug ON public.organizations (slug);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Public: anyone (including anon) may read SAFE fields for org search.
-- Only the columns needed for search results are usable here because the API
-- layer (NestJS) selects only those columns — the policy allows the read,
-- the SELECT list in the query enforces data minimisation.
CREATE POLICY "orgs_public_search"
  ON public.organizations
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

-- Authenticated org members may read the full row for their own org.
-- The JWT must contain organization_id claim set by our auth service.
CREATE POLICY "orgs_member_read"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    id = (current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid
  );

-- All INSERT / UPDATE / DELETE require service-role key (bypasses RLS).
-- No application user can modify organizations directly.
-- This is intentional: org mutations go through NestJS → service-role client.
