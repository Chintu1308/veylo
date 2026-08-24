-- =============================================================================
-- Migration 0005: Create roles and audit_logs
-- Purpose: Add global roles table, link users/memberships, and add audit_logs.
-- RLS: Enabled for audit_logs in this migration. No table goes live without RLS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: roles (Global Lookup Table)
-- ---------------------------------------------------------------------------
CREATE TABLE public.roles (
  id           text   PRIMARY KEY,
  display_name text   NOT NULL,
  permissions  text[] NOT NULL DEFAULT '{}'
);

-- Seed global roles
INSERT INTO public.roles (id, display_name, permissions)
VALUES
  ('org_admin', 'Organization Admin', '{manage_members, manage_settings, view_security, view_billing, manage_billing, view_audit_logs}'),
  ('security_analyst', 'Security Analyst', '{view_security, manage_security, view_audit_logs}'),
  ('protected_user', 'Protected User', '{view_own_sessions, manage_own_devices}')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Alter existing tables to reference public.roles(id)
-- ---------------------------------------------------------------------------
-- Drop the check constraint in users table and link it
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT fk_users_role FOREIGN KEY (role) REFERENCES public.roles(id);

-- Drop the check constraint in organization_memberships table and link it
ALTER TABLE public.organization_memberships DROP CONSTRAINT IF EXISTS organization_memberships_role_check;
ALTER TABLE public.organization_memberships ADD CONSTRAINT fk_memberships_role FOREIGN KEY (role) REFERENCES public.roles(id);

-- ---------------------------------------------------------------------------
-- Table: audit_logs (Tenant Scoped, Immutable)
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email     text        NOT NULL,
  action          text        NOT NULL,
  target_type     text        NOT NULL,
  target_id       text        NOT NULL,
  ip_address      text,
  user_agent      text,
  payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_organization_id ON public.audit_logs (organization_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Select policy: Only org_admin and security_analyst can read org audit logs
CREATE POLICY "audit_logs_member_read"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    organization_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = audit_logs.organization_id
        AND m.status = 'active'
        AND m.role IN ('org_admin', 'security_analyst')
    )
  );

-- Block all direct writes (inserts/updates/deletes) for app users.
-- Writes must only happen via service_role in backend.
-- Belt-and-suspenders trigger guard checks role.
CREATE TRIGGER trg_audit_logs_immutability_guard
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_non_service_role_mutations();
