---
name: rls-policies
description: >
  Apply this skill whenever writing a Supabase Postgres migration that creates
  a table holding tenant data. Triggers on phrases like "create table with RLS",
  "new tenant table", "add RLS to", "migration for org-scoped data", or any
  request to add a table to the Veylo schema.
---

# RLS Policy Pattern for Veylo

This skill captures the exact Row-Level Security pattern used in Veylo's Phase 1–3
migrations. Reuse it verbatim for every new tenant-scoped table. Never skip any step.

## The Four-Step Rule (AGENTS.md rule 2)

> Every table holding tenant data must have Row-Level Security enabled **in the same
> migration that creates it** — no table goes live without RLS.

Steps that must appear together in one migration file:

1. `CREATE TABLE`
2. `CREATE INDEX` (at minimum on `organization_id`)
3. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
4. `CREATE POLICY` (at least one SELECT policy; no INSERT/UPDATE/DELETE for app users)

---

## Policy Naming Convention

```
<table>_<actor>_<operation>
```

Examples:

- `orgs_public_search` — anonymous SELECT on the organizations table for org search
- `users_own_profile_select` — a user reads their own row
- `memberships_org_admin_read` — org-admin reads all memberships in their org

---

## Standard Policy Set per Table

Every tenant table needs **all** of the following policies explicitly defined:

### 1. Public read (if applicable)

Only on tables that expose safe, non-sensitive data to anonymous users (e.g., org search):

```sql
CREATE POLICY "<table>_public_read"
  ON public.<table>
  FOR SELECT
  TO anon, authenticated
  USING (<safe_condition>);
```

**Required for:** `organizations` (display_name, slug, logo_url, location only)
**Not used for:** `users`, `organization_memberships`, or any table with PII

---

### 2. Own-row read (tables with a `user_id` / PK = auth.uid())

```sql
CREATE POLICY "<table>_own_row_select"
  ON public.<table>
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());          -- or: user_id = auth.uid()
```

---

### 3. Org-scoped read (the primary tenant isolation policy)

This is the core Zero Trust guarantee. **The JWT must carry an `organization_id` claim.**
The NestJS auth service is responsible for embedding this claim when it signs tokens.

```sql
CREATE POLICY "<table>_org_member_read"
  ON public.<table>
  FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id'
    )::uuid
  );
```

> ⚠️ **Critical:** `current_setting('request.jwt.claims', true)` is set by Supabase
> when a request arrives with a valid JWT. The `true` flag (missing_ok) prevents
> errors if the claim is absent — in that case the expression returns NULL and the
> policy evaluates to false, blocking access.

---

### 4. Write policies — service-role only

**Never** create INSERT/UPDATE/DELETE policies for `anon` or `authenticated` roles
on tenant tables. All writes go through the NestJS API's service-role Supabase client,
which bypasses RLS entirely.

Document this explicitly in every migration:

```sql
-- INSERT / UPDATE / DELETE require service-role key (bypasses RLS).
-- No application user can write to this table directly.
```

---

## Belt-and-Suspenders: Trigger Guard

For the most sensitive tables (`organization_memberships`, `forensic_events`, and any
table where a mutation would break tenant isolation), add a Postgres trigger that
rejects mutations from non-service roles even if a policy misconfiguration occurs:

```sql
CREATE TRIGGER trg_<table>_immutability_guard
  BEFORE UPDATE OR DELETE ON public.<table>
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_non_service_role_mutations();
```

The `reject_non_service_role_mutations()` function is defined in migration `0004` and
checks `current_role NOT IN ('service_role', 'supabase_admin', 'postgres')`.

---

## SECURITY DEFINER Helper Functions

For cross-tenant queries that must be performed server-side (e.g., the org membership
verification during login), define a `SECURITY DEFINER` function rather than giving
the application user elevated RLS policies:

```sql
CREATE OR REPLACE FUNCTION public.<function_name>(...)
RETURNS <type>
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- This function runs with the privileges of its owner (postgres/service_role),
  -- not the calling user. Use it only for tightly-scoped, read-only operations.
  ...
END;
$$;

-- Restrict to service_role only
REVOKE EXECUTE ON FUNCTION public.<function_name>(...) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.<function_name>(...) TO service_role;
```

**Currently defined:** `verify_org_membership(p_user_id uuid, p_organization_id uuid) → boolean`
Enforces: "correct email + correct password + wrong organization = denied" at DB layer.

---

## Full Migration Template

```sql
-- =============================================================================
-- Migration NNNN: <table_name>
-- Purpose: <one-line description>
-- RLS: Enabled in this migration. See AGENTS.md rule 2.
-- =============================================================================

CREATE TABLE public.<table_name> (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- ... other columns ...
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_<table>_organization_id ON public.<table_name> (organization_id);

CREATE TRIGGER trg_<table>_updated_at
  BEFORE UPDATE ON public.<table_name>
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- Org-scoped read
CREATE POLICY "<table>_org_member_read"
  ON public.<table_name>
  FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id'
    )::uuid
  );

-- INSERT / UPDATE / DELETE: service-role key only (bypasses RLS).
-- No direct writes from application users.

-- Belt-and-suspenders trigger guard (add for critical tables)
CREATE TRIGGER trg_<table>_mutation_guard
  BEFORE UPDATE OR DELETE ON public.<table_name>
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_non_service_role_mutations();
```

---

## Checklist Before Committing a Migration

- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is present
- [ ] At least one `CREATE POLICY` is present
- [ ] No INSERT/UPDATE/DELETE policy for `authenticated` or `anon` roles
- [ ] Index on `organization_id` created
- [ ] `updated_at` trigger attached (if `updated_at` column exists)
- [ ] Trigger guard added (for tables in the critical auth/audit path)
- [ ] `SECURITY DEFINER` functions are `REVOKE`d from PUBLIC and `GRANT`ed to `service_role` only
- [ ] Migration filename follows `NNNN_<description>.sql` pattern
- [ ] No hardcoded secrets, UUIDs (except test seeds), or environment-specific values

---

## References

- [Veylo migrations](file:///c:/Project%20Files/veylo/supabase/migrations/)
- [AGENTS.md rule 2](file:///c:/Project%20Files/veylo/AGENTS.md)
- [VEYLO_MASTER_SPEC.md Section 12](file:///c:/Project%20Files/veylo/VEYLO_MASTER_SPEC.md) — Encryption standards
- [Supabase RLS docs](https://supabase.com/docs/guides/auth/row-level-security)
