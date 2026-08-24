-- =============================================================================
-- Migration 0006: Integrations and Forensics
-- Purpose: Create plans, subscriptions, payments, devices, device_history,
--          protected_resources, security_policies, incidents, alerts,
--          and forensic_events tables with RLS and trigger guards.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Table: plans, subscriptions, payments (Billing Phase 5)
-- ---------------------------------------------------------------------------
CREATE TABLE public.plans (
  id                   text   PRIMARY KEY,
  name                 text   NOT NULL,
  price_monthly_cents  int    NOT NULL,
  max_users            int    NOT NULL,
  features             text[] NOT NULL DEFAULT '{}'
);

-- Seed default plans
INSERT INTO public.plans (id, name, price_monthly_cents, max_users, features)
VALUES
  ('free', 'Free Tier', 0, 5, '{"view_security", "view_audit_logs"}'),
  ('pro', 'Pro Plan', 4900, 50, '{"view_security", "view_audit_logs", "manage_security", "unlimited_rules"}'),
  ('enterprise', 'Enterprise Custom', 25000, 1000, '{"view_security", "view_audit_logs", "manage_security", "unlimited_rules", "sso_integration", "forensic_hash_chain"}')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.subscriptions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id             text        NOT NULL REFERENCES public.plans(id),
  status              text        NOT NULL CHECK (status IN ('active', 'past_due', 'canceled')),
  current_period_end  timestamptz NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payments (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id  uuid        NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  amount_cents     int         NOT NULL,
  status           text        NOT NULL CHECK (status IN ('succeeded', 'failed', 'pending')),
  transaction_id   text        NOT NULL UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Plans select policy: visible to anyone
CREATE POLICY "plans_select_policy" ON public.plans FOR SELECT TO authenticated USING (true);

-- Subscriptions policy: visible only to organization members
CREATE POLICY "subscriptions_select_policy" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (organization_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid);

-- Payments policy: visible only to organization admins
CREATE POLICY "payments_select_policy" ON public.payments
  FOR SELECT TO authenticated
  USING (
    organization_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = payments.organization_id
        AND m.status = 'active'
        AND m.role = 'org_admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Table: devices and device_history (Device Trust Phase 7)
-- ---------------------------------------------------------------------------
CREATE TABLE public.devices (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
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

-- Enable RLS
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_history ENABLE ROW LEVEL SECURITY;

-- Devices policy: visible to org members; protected users can only view their own
CREATE POLICY "devices_select_policy" ON public.devices
  FOR SELECT TO authenticated
  USING (
    organization_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid
    AND (
      EXISTS (
        SELECT 1 FROM public.organization_memberships m
        WHERE m.user_id = auth.uid()
          AND m.organization_id = devices.organization_id
          AND m.status = 'active'
          AND m.role IN ('org_admin', 'security_analyst')
      )
      OR user_id = auth.uid()
    )
  );

-- Device History policy: same visibility rules as devices
CREATE POLICY "device_history_select_policy" ON public.device_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = device_history.device_id
        AND d.organization_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid
        AND (
          EXISTS (
            SELECT 1 FROM public.organization_memberships m
            WHERE m.user_id = auth.uid()
              AND m.organization_id = d.organization_id
              AND m.status = 'active'
              AND m.role IN ('org_admin', 'security_analyst')
          )
          OR d.user_id = auth.uid()
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Table: protected_resources, security_policies (Policies Phase 8, 9, 10)
-- ---------------------------------------------------------------------------
CREATE TABLE public.protected_resources (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  type             text        NOT NULL, -- 'database', 'ssh', 'http'
  endpoint         text        NOT NULL,
  sensitivity      text        NOT NULL DEFAULT 'medium' CHECK (sensitivity IN ('low', 'medium', 'high', 'critical')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.security_policies (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  rules            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.protected_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_policies ENABLE ROW LEVEL SECURITY;

-- Protected resources policy: select visible to org members
CREATE POLICY "protected_resources_select_policy" ON public.protected_resources
  FOR SELECT TO authenticated
  USING (organization_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid);

-- Security policies policy: select visible to org members
CREATE POLICY "security_policies_select_policy" ON public.security_policies
  FOR SELECT TO authenticated
  USING (organization_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid);

-- ---------------------------------------------------------------------------
-- Table: incidents, alerts, forensic_events (Incident & Forensic Phase 17, 18)
-- ---------------------------------------------------------------------------
CREATE TABLE public.incidents (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_code  text        NOT NULL UNIQUE, -- VEY-YYYY-NNNN format
  title          text        NOT NULL,
  severity       text        NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status         text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved')),
  assignee_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.alerts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_id      uuid        REFERENCES public.incidents(id) ON DELETE SET NULL,
  title            text        NOT NULL,
  description      text        NOT NULL,
  severity         text        NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status           text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Cryptographic Forensic Ledger (Append-Only)
CREATE TABLE public.forensic_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_id      uuid        REFERENCES public.incidents(id) ON DELETE SET NULL,
  event_data       text        NOT NULL,
  previous_hash    text,
  current_hash     text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forensic_events ENABLE ROW LEVEL SECURITY;

-- Incidents policy: select allowed only for org_admin and security_analyst
CREATE POLICY "incidents_select_policy" ON public.incidents
  FOR SELECT TO authenticated
  USING (
    organization_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = incidents.organization_id
        AND m.status = 'active'
        AND m.role IN ('org_admin', 'security_analyst')
    )
  );

-- Alerts policy: select allowed for org members
CREATE POLICY "alerts_select_policy" ON public.alerts
  FOR SELECT TO authenticated
  USING (organization_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid);

-- Forensic events policy: select allowed only for org_admin and security_analyst
CREATE POLICY "forensic_events_select_policy" ON public.forensic_events
  FOR SELECT TO authenticated
  USING (
    organization_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = forensic_events.organization_id
        AND m.status = 'active'
        AND m.role IN ('org_admin', 'security_analyst')
    )
  );

-- ---------------------------------------------------------------------------
-- Trigger: Cryptographic Hash Chaining for forensic_events
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hash_forensic_event_chain()
RETURNS TRIGGER AS $$
DECLARE
  prev_hash text;
BEGIN
  -- Grab the current hash of the most recent event in the same organization
  SELECT current_hash INTO prev_hash
  FROM public.forensic_events
  WHERE organization_id = NEW.organization_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  NEW.previous_hash := prev_hash;
  -- Generate SHA-256 digest: sha256(event_data + previous_hash + created_at)
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

-- Immutability guard trigger for forensic_events
CREATE TRIGGER trg_forensic_events_append_only
  BEFORE UPDATE OR DELETE ON public.forensic_events
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_forensic_events_mutation();
