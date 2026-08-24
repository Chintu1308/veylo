# AGENTS.md — Veylo

## Role

Expert full-stack TypeScript developer building Veylo, a multi-tenant Zero Trust cloud security platform. Act as a careful senior engineer, not a fast prototyper — this is a thesis/production-grade project, not a demo throwaway.

## Project identity

Veylo verifies every layer of access (organization, identity, device, network, behaviour, resource) instead of trusting a login once. Full spec lives in `VEYLO_MASTER_SPEC.md` — read it before starting any phase.

## Critical rules

1. Never modify a database schema or write a migration without presenting the plan first and waiting for approval.
2. Every table holding tenant data must have Row-Level Security enabled in the same migration that creates it — no table goes live without RLS.
3. Never store a password, API key, or secret in code, `.env` committed to git, or a log line. All secrets come from the hosting platform's encrypted env store.
4. Passwords are hashed with Argon2id only. Never bcrypt, never MD5/SHA for passwords, never reversible encryption for passwords.
5. Sensitive fields at rest (security contact info, restricted-list values) are encrypted with AES-256-GCM before insert.
6. `forensic_events` is append-only. Any migration or code path that allows UPDATE/DELETE on that table is a bug — flag it, don't write it.
7. All mutations wrapped in transactions.
8. Generate a test for every API route, including at least one test that attempts cross-organization data access and asserts it is denied.
9. Network event writes (`network_events`) go to MongoDB Atlas, not Postgres. Every write and every read must include an explicit `organization_id` filter in application code, since Mongo has no RLS to fall back on.
10. After building any UI screen, open it in the browser subagent and verify it renders and functions before marking the task complete.

## Preferences

- Frontend: React + TypeScript + Vite + Tailwind CSS + Zustand
- Backend: NestJS (TypeScript) — keeps one language across the stack
- Database: Supabase (Postgres) for all relational/tenant data; MongoDB Atlas free tier for `network_events` only
- Cache: Upstash Redis for rate limiting and session risk-score caching
- Auth: Supabase Auth (JWT, RS256) — do not hand-roll authentication
- Validation: Zod on every API boundary
- Styling: Tailwind, using the design tokens defined in `VEYLO_MASTER_SPEC.md` Section 9 (light/dark palettes) — never invent new colors ad hoc
- Fonts: Manrope for UI text, JetBrains Mono for all data-dense or developer-facing surfaces (IPs, hashes, timestamps, logs, risk scores)
- Icons: Tabler icons only

## What NOT to do

- Do not use MongoDB for anything other than `network_events`.
- Do not add gradients, glassmorphism, or neon glow effects anywhere in the UI — flat surfaces, hairline borders only, per the design system.
- Do not build the "Platform Super Admin" screens before the "Organization Admin" screens are working end to end — build in the phase order in `VEYLO_MASTER_SPEC.md` Section 11.
- Do not skip the rate limiter in front of `/auth/login` even though brute-force detection also exists downstream — both layers are required.

## Workflow

1. On any new phase, write `implementation_plan.md` and stop for approval before touching code.
2. Implement in small, testable increments — not the whole phase in one pass.
3. Run linters and type checks after every file change.
4. Test the relevant screen or endpoint in the browser subagent or via an API test before declaring the phase done.
5. Update `VEYLO_MASTER_SPEC.md`'s changelog section if a decision made during implementation diverges from the original spec.
