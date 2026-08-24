-- =============================================================================
-- Migration 0007: Refactor to GitHub-Style Projects
-- Purpose: Remove all organization-based tables and replace with project-based
--          tenancy. Scopes all security boundaries, logs, devices, and policies
--          to projects owned by users.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop all old tables and triggers
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.plans CASCADE;
DROP TABLE IF EXISTS public.device_history CASCADE;
DROP TABLE IF EXISTS public.devices CASCADE;
DROP TABLE IF EXISTS public.protected_resources CASCADE;
DROP TABLE IF EXISTS public.security_policies CASCADE;
DROP TABLE IF EXISTS public.alerts CASCADE;
DROP TABLE IF EXISTS public.incidents CASCADE;
DROP TABLE IF EXISTS public.forensic_events CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.project_members CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.organization_memberships CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;

-- ---------------------------------------------------------------------------
-- Table: plans (Global lookup)
-- ---------------------------------------------------------------------------
CREATE TABLE public.plans (
  id                   text   PRIMARY KEY,
  name                 text   NOT NULL,
  price_monthly_cents  int    NOT NULL,
  max_users            int    NOT NULL,
  features             text[] NOT NULL DEFAULT '{}'
);

INSERT INTO public.plans (id, name, price_monthly_cents, max_users, features)
VALUES
  ('free', 'Free Tier', 0, 5, '{"view_security", "view_audit_logs"}'),
  ('pro', 'Pro Plan', 4900, 50, '{"view_security", "view_audit_logs", "manage_security", "unlimited_rules"}'),
  ('enterprise', 'Enterprise Custom', 25000, 1000, '{"view_security", "view_audit_logs", "manage_security", "unlimited_rules", "sso_integration", "forensic_hash_chain"}')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Table: projects (Core Tenant Entity)
-- ---------------------------------------------------------------------------
CREATE TABLE public.projects (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  slug         text        NOT NULL,
  description  text,
  status       text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_owner_project_slug UNIQUE (owner_id, slug)
);

-- ---------------------------------------------------------------------------
-- Table: project_members (Collaborators)
-- ---------------------------------------------------------------------------
CREATE TABLE public.project_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('project_admin', 'security_analyst', 'protected_user')),
  status      text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_project_user UNIQUE (project_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Table: subscriptions & payments (Scoped to projects)
-- ---------------------------------------------------------------------------
CREATE TABLE public.subscriptions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  plan_id             text        NOT NULL REFERENCES public.plans(id),
  status              text        NOT NULL CHECK (status IN ('active', 'past_due', 'canceled')),
  current_period_end  timestamptz NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payments (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subscription_id  uuid        NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  amount_cents     int         NOT NULL,
  status           text        NOT NULL CHECK (status IN ('succeeded', 'failed', 'pending')),
  transaction_id   text        NOT NULL UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Table: devices & device_history
-- ---------------------------------------------------------------------------
CREATE TABLE public.devices (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  os               text        NOT NULL,
  status           text        NOT NULL DEFAULT 'pending' CHECK (status IN ('approved', 'pending', 'blocked')),
  posture_score    int         NOT NULL DEFAULT 100 CHECK (posture_score BETWEEN 0 AND 100),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.device_history (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id      uuid        NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  posture_score  int         NOT NULL CHECK (posture_score BETWEEN 0 AND 100),
  details        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Table: protected_resources & security_policies (Scoped to projects)
-- ---------------------------------------------------------------------------
CREATE TABLE public.protected_resources (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  type             text        NOT NULL,
  endpoint         text        NOT NULL,
  sensitivity      text        NOT NULL DEFAULT 'medium' CHECK (sensitivity IN ('low', 'medium', 'high', 'critical')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.security_policies (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  rules            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Table: incidents, alerts, forensic_events & audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE public.incidents (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  incident_code  text        NOT NULL UNIQUE,
  title          text        NOT NULL,
  severity       text        NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status         text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved')),
  assignee_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.alerts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  incident_id      uuid        REFERENCES public.incidents(id) ON DELETE SET NULL,
  title            text        NOT NULL,
  description      text        NOT NULL,
  severity         text        NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status           text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.forensic_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  incident_id      uuid        REFERENCES public.incidents(id) ON DELETE SET NULL,
  event_data       text        NOT NULL,
  previous_hash    text,
  current_hash     text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
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

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protected_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forensic_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ── Policies ───────────────────────────────────────────────────────────────

-- Plans
CREATE POLICY "plans_select_policy" ON public.plans FOR SELECT TO authenticated USING (true);

-- Projects
CREATE POLICY "projects_select_policy" ON public.projects
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.project_members m
    WHERE m.project_id = id AND m.user_id = auth.uid() AND m.status = 'active'
  ));

-- Project Members
CREATE POLICY "project_members_select_policy" ON public.project_members
  FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
  ) OR user_id = auth.uid());

-- Subscriptions
CREATE POLICY "subscriptions_select_policy" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT project_id FROM public.project_members WHERE user_id = auth.uid() AND status = 'active'
  ));

-- Payments
CREATE POLICY "payments_select_policy" ON public.payments
  FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
  ));

-- Devices
CREATE POLICY "devices_select_policy" ON public.devices
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
  ));

-- Device History
CREATE POLICY "device_history_select_policy" ON public.device_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.id = device_id AND (d.user_id = auth.uid() OR d.project_id IN (
      SELECT id FROM public.projects WHERE owner_id = auth.uid()
    ))
  ));

-- Protected Resources & Security Policies
CREATE POLICY "resources_select_policy" ON public.protected_resources
  FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT project_id FROM public.project_members WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "policies_select_policy" ON public.security_policies
  FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT project_id FROM public.project_members WHERE user_id = auth.uid() AND status = 'active'
  ));

-- Incidents, Alerts, Forensic Events, Audit Logs
CREATE POLICY "incidents_select_policy" ON public.incidents
  FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT project_id FROM public.project_members WHERE user_id = auth.uid() AND role IN ('project_admin', 'security_analyst') AND status = 'active'
  ));

CREATE POLICY "alerts_select_policy" ON public.alerts
  FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT project_id FROM public.project_members WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "forensics_select_policy" ON public.forensic_events
  FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT project_id FROM public.project_members WHERE user_id = auth.uid() AND role IN ('project_admin', 'security_analyst') AND status = 'active'
  ));

CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT project_id FROM public.project_members WHERE user_id = auth.uid() AND role IN ('project_admin', 'security_analyst') AND status = 'active'
  ));

-- ── Triggers ───────────────────────────────────────────────────────────────

-- Cryptographic Hash Chain trigger for forensic_events
CREATE OR REPLACE FUNCTION public.hash_forensic_event_chain()
RETURNS TRIGGER AS $$
DECLARE
  prev_hash text;
BEGIN
  SELECT current_hash INTO prev_hash
  FROM public.forensic_events
  WHERE project_id = NEW.project_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  NEW.previous_hash := prev_hash;
  NEW.current_hash := encode(digest(
    NEW.event_data || '|' || COALESCE(prev_hash, '') || '|' || NEW.created_at::text,
    'sha256'
  ), 'hex');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_forensic_events_hash_chain
  BEFORE INSERT ON public.forensic_events
  FOR EACH ROW
  EXECUTE FUNCTION public.hash_forensic_event_chain();

-- Immutable guards
CREATE TRIGGER trg_forensic_events_append_only
  BEFORE UPDATE OR DELETE ON public.forensic_events
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_forensic_events_mutation();

CREATE TRIGGER trg_audit_logs_immutability_guard
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_non_service_role_mutations();
