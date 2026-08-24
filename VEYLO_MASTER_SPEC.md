# Veylo — Master Specification

### The single reference document. Antigravity should read this in full before starting any build phase.

---

## 1. Product identity

**Name:** Veylo — "Verify Every Layer"
**Tagline:** Verify Every Layer.
**Full title:** Veylo: An Adaptive Zero Trust Cloud Security Platform with Continuous Network Monitoring and Forensic Intelligence

**Core philosophy:** Never trust a successful login alone. Continuously verify the organization, identity, device, network, behaviour, and requested resource.

**Product statement:** Veylo is a multi-tenant adaptive Zero Trust cloud security platform that continuously verifies every layer of access — from organization and identity to device, network, behaviour, and protected resources — to dynamically allow, challenge, restrict, or deny activity while providing real-time threat alerts and tamper-evident forensic investigation.

**What Veylo is not:** not a Wireshark replacement, not a full enterprise firewall, not an antivirus engine, not a complete SIEM, not a banking platform, not a cloud provider, not a deep packet inspection tool. Scope stays to: Zero Trust access, continuous risk, network visibility, real-time response, forensic intelligence.

---

## 2. User roles

| Role                 | Purpose                                                                                                                                                            | Cannot access                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Platform Super Admin | Runs the Veylo SaaS itself: organizations, plans, subscriptions, payments, platform health, global stats, platform audit logs                                      | Should not casually access private org security data    |
| Organization Admin   | Full control of one org: users, roles, devices, protected resources, policies, restricted lists, network monitoring, alerts, incidents, sessions, reports, billing | —                                                       |
| Security Analyst     | Monitors traffic, views alerts, investigates incidents, analyses risk, adds notes, acknowledges alerts, exports reports                                            | Billing, subscription, org ownership, platform settings |
| Protected User       | Logs in, completes MFA, accesses protected resources, manages personal devices, views own sessions/activity                                                        | Everything admin/analyst                                |

---

## 3. Authentication architecture (organization-first login)

This is Veylo's most distinctive UX decision: there is no generic email/password page. The flow is:

```
Landing → Login → Find your organization (search, 3+ chars, 300–500ms debounce)
       → Select organization → Organization-specific login (org logo + email + password)
       → Membership verification → Zero Trust evaluation → Allow / MFA / Deny / Alert
```

Search results expose only: organization logo, display name, optional location. Never expose admin names, employee names, emails, subscription info, or user counts.

**Strict organization isolation:** correct email + correct password + wrong organization = denied. Enforced by requiring an active row in `organization_memberships` for the exact selected `organization_id`, checked at the database layer via Row-Level Security, not just application code.

**"Not my organization"** clears the org ID and all temporary org-scoped login context, returning to search — nothing may remain silently selected.

**Forgot password** is organization-scoped, always returns the generic message "If an eligible account exists for this organization, reset instructions have been sent" to prevent enumeration, and revokes existing sessions + logs a security event on completion.

**Registration flow:** Get Started → Create Admin Account → Verify Email → Create Organization → Choose Subscription → Demo Payment (test mode) → Activate → Guided Onboarding (5 steps: profile, invite team, add protected resources, configure security, activate).

---

## 4. Login security pipeline

Every login runs through, in order: organization selection → credential verification → membership verification → account status check → device identification → network context analysis → initial behaviour check → risk score calculation → org policy evaluation → decision.

Outcomes: **Low → Allow · Medium → Require MFA · High → Deny + Alert · Critical → Deny + Alert + Incident**

---

## 5. Risk engine

```
FINAL RISK = Identity Risk + Device Risk + Network Risk + Behaviour Risk + Resource Risk
```

Initial weighting: Identity 20% · Device 20% · Network 25% · Behaviour 20% · Resource 15%

| Score  | Level    | Default response       |
| ------ | -------- | ---------------------- |
| 0–30   | Low      | Allow                  |
| 31–60  | Medium   | Challenge / MFA        |
| 61–80  | High     | Restrict / Deny        |
| 81–100 | Critical | Block / Revoke / Alert |

Every decision stores its explanation as a list of weighted reasons (e.g. `+25 Unknown Device, +20 Restricted Destination, +15 Traffic Anomaly`) — required for explainability and for the forensic timeline.

Risk is continuous, not point-in-time: a session's risk score is recalculated as new signals arrive and can trigger automatic session revocation mid-session.

---

## 6. Policy and rule engine

Risk engine answers "how dangerous is this." Policy engine answers "what do we do about it." Actions: Allow · Allow + Monitor · Require MFA · Restrict · Deny · Revoke Session · Block Device · Create Alert · Create Incident.

Org admins build rules without code, e.g.:

```
IF Device Status = Unknown AND Resource Sensitivity = Critical
THEN Deny Access, +30 Risk, Alert Admin, Create Incident, Log to Forensic Timeline
```

---

## 7. Network monitoring and the seven frozen MVP detections

Veylo monitors metadata (source IP, destination, method, endpoint, frequency, status, port metadata, user, device, session, timestamp) — not full packet inspection.

Pipeline: Event → Collect → Normalize → Restricted List Check → Detection Rules → Anomaly Check → Risk Engine → Policy Engine → Alert/Response.

The first release implements exactly these seven detections, no more:

1. Traffic Spike
2. Brute-Force Behaviour
3. Resource Enumeration
4. Restricted Destination Access
5. Rapid IP Change
6. Port Scan Pattern
7. Repeated Access Denial

---

## 8. Forensic intelligence

Every significant event joins a per-incident timeline (incident ID format `VEY-YYYY-NNNN`) containing: summary, timeline, user context, device context, network events, risk history, triggered rules, admin actions, evidence, investigation notes.

**Tamper-evident hash chain:** each `forensic_events` row hashes `event_data + timestamp + previous_hash` with SHA-256. The table is append-only — enforced with a Postgres trigger that rejects UPDATE/DELETE, not just app-level convention.

---

## 9. Design system

### 9.1 Brand palette (marketing / logo use)

Light: `#0F1F2E` `#1A7C74` `#22B8A6` `#E6F4F2` `#F6F8F7`
Dark: `#0A1117` `#11202A` `#16C7B4` `#7DE6D6` `#E6F2F1`

### 9.2 Product interface palette (derived — distinct per theme, not inverted)

**Light theme**

| Role             | Hex                    |
| ---------------- | ---------------------- |
| Background       | `#F6F8F7`              |
| Surface/card     | `#FFFFFF`              |
| Border           | `#E3EEEC`              |
| Primary text     | `#0F1F2E`              |
| Secondary text   | `#54666B`              |
| Accent (brand)   | `#1A7C74`              |
| Accent hover     | `#22B8A6`              |
| Status: low/info | `#1A7C74` on `#E1F5EE` |
| Status: medium   | `#B8823A` on `#FBF1E2` |
| Status: high     | `#BD5B2C` on `#FBE8DF` |
| Status: critical | `#A93E3E` on `#F8E2E2` |

**Dark theme**

| Role             | Hex                    |
| ---------------- | ---------------------- |
| Background       | `#0A1117`              |
| Surface/card     | `#11202A`              |
| Border           | `#1C2E38`              |
| Primary text     | `#E6F2F1`              |
| Secondary text   | `#8FA3A8`              |
| Accent (brand)   | `#16C7B4`              |
| Accent hover     | `#7DE6D6`              |
| Status: low/info | `#4FD9C4` on `#12332E` |
| Status: medium   | `#E0A94A` on `#332512` |
| Status: high     | `#E07A45` on `#331F14` |
| Status: critical | `#E2585B` on `#331616` |

**Color theory rationale:** brand teal sits ~174° on the hue wheel. Status colors deliberately sit on the opposite, warm side (amber → orange → red) so an alert reads as a distinct signal, never as a shade of the brand. 60-30-10 applies to every screen: neutrals dominate (60), teal carries navigation/primary actions (30), status color appears only where something is actually abnormal (10). Severity is always paired with a text label, never conveyed by hue alone.

### 9.3 Two interface modes

**SOC / analyst mode** — card-based, rounded-12px surfaces, pill-shaped severity badges, radial trust-score gauge as the one signature element (echoes the hexagon-eye logo mark). UI font: Manrope. Data font: JetBrains Mono for timestamps/IPs/hashes only.

**Developer / integration mode** — terminal-styled, JetBrains Mono throughout, near-black background, log-tail live feed with inline colored text (not badges), copyable SDK snippet at the top, single-line status bar instead of a metric grid. This is the surface a developer sees when integrating Veylo into their own app for end-to-end monitoring — it deliberately looks like a CLI tool output, not a marketing dashboard.

Both modes share the same underlying palette and the same rule: no gradients, no glassmorphism, no glow/neon effects, hairline borders instead of shadows, restrained motion.

### 9.4 Typography

- UI/labels: **Manrope**
- Data-dense/developer surfaces: **JetBrains Mono**
- Never Inter/Poppins/Montserrat-only pairing — reads as generic AI-default.

---

## 10. Technical architecture

```
FRONTEND — React + TS + Vite + Tailwind + Zustand — Vercel/Netlify (free)
        │ REST + Supabase Realtime (WebSocket)
API LAYER — NestJS — Render/Fly.io (free)
        Auth · Org Context · Subscription · Device Trust · Protected Resources
        Risk Engine · Policy Engine · Detection Engine · Alert Engine
        Incident Mgmt · Forensic Engine
        │
   ┌────┴─────────────────┬───────────────────┐
SUPABASE (Postgres)   MONGODB ATLAS       UPSTASH REDIS
Auth, RLS, Storage,   network_events      session/risk cache,
Realtime, all         only (free 512MB)   rate limiting (free)
relational data
```

**Why Postgres/Supabase is primary, not MongoDB:** the data model (users → organization_memberships → organizations → roles → policies → incidents) is deeply relational with foreign-key integrity requirements. Supabase adds Row-Level Security (enforces the strict tenant isolation in Section 3 at the DB layer), built-in Auth (JWT/RS256), and Realtime (powers the live alert feed) — all inside a free tier (500MB DB, 1GB storage, 50k MAU).

**Why MongoDB for `network_events` specifically:** this table is high-volume, append-heavy, and doesn't need relational joins — a natural fit for a document store, and isolating it to one collection avoids a two-database sync problem everywhere else. Caveat: Mongo has no RLS equivalent, so every query against it must include an explicit `organization_id` filter in application code — this is the one place tenant isolation is not enforced by the database itself, and needs its own test coverage.

---

## 11. Free-tier service stack

| Layer                                     | Service                                | Free tier                      |
| ----------------------------------------- | -------------------------------------- | ------------------------------ |
| Frontend hosting                          | Vercel or Netlify                      | Unlimited personal projects    |
| Backend hosting                           | Render.com or Fly.io                   | 750 hrs/month                  |
| Relational DB + Auth + Storage + Realtime | Supabase                               | 500MB DB, 1GB storage, 50k MAU |
| Network events                            | MongoDB Atlas                          | 512MB shared cluster           |
| Cache / rate limiting                     | Upstash Redis                          | 10k commands/day, 256MB        |
| Email                                     | Resend or Brevo                        | 3,000/month or 300/day         |
| Payments (test mode)                      | Stripe Test Mode or Razorpay Test Mode | Free, sandbox only             |
| CI/CD                                     | GitHub Actions                         | 2,000 min/month                |
| Error tracking                            | Sentry                                 | 5k events/month                |
| Uptime monitoring                         | UptimeRobot                            | Free                           |

---

## 12. Encryption standards

| Data                     | Algorithm                                                                    |
| ------------------------ | ---------------------------------------------------------------------------- |
| Passwords                | Argon2id (bcrypt cost ≥12 acceptable fallback)                               |
| Access/refresh tokens    | JWT, RS256 signing, 10–15min access token, single-use rotating refresh token |
| Sensitive fields at rest | AES-256-GCM                                                                  |
| Data in transit          | TLS 1.3 (automatic via all listed hosts)                                     |
| Forensic evidence chain  | SHA-256 hash chaining, append-only enforced by DB trigger                    |
| Tenant isolation         | Postgres Row-Level Security keyed on `organization_id` against JWT claim     |

Refresh token reuse (a "used" token presented again) is treated as a theft signal: force session revocation and log a security event.

---

## 13. Core database entities

`users` · `organizations` · `organization_memberships` · `roles` · `plans` · `subscriptions` · `payments` · `devices` · `device_history` · `sessions` · `login_events` · `protected_resources` · `security_policies` · `policy_conditions` · `policy_actions` · `restricted_items` · `network_events` (MongoDB) · `security_events` · `risk_scores` · `risk_factors` · `alerts` · `incidents` · `incident_events` · `investigation_notes` · `forensic_events` · `audit_logs`

`organization_id` scoping is enforced on every tenant-owned Postgres table via RLS, and via explicit application-level filtering on every MongoDB query.

---

## 14. Build phases (in order — do not skip ahead)

1. Brand system and UI design tokens
2. Landing page and public website
3. Organization-first authentication (Supabase Auth + custom org search/select flow)
4. Multi-tenant organization system + RLS isolation tests
5. Subscription and demo payment (test mode)
6. Organization onboarding (5-step guided setup)
7. Device trust engine
8. Protected resources
9. Dynamic risk engine
10. Policy and rule engine
11. Network event monitoring (MongoDB pipeline)
12. Restricted list system
13. Seven frozen threat detections
14. Real-time alerts (Supabase Realtime → WebSocket, sound rules)
15. SOC dashboard (analyst mode UI)
16. Continuous session monitoring (mid-session risk recalculation, auto-revoke)
17. Incidents and forensic timeline
18. Evidence integrity (hash chain + append-only trigger)
19. Developer integration mode (terminal UI, SDK snippet, log tail)
20. Testing and attack simulations (brute force, RLS bypass attempts, token replay)
21. Deployment and research evaluation

---

## 15. Research direction

Central question: can continuous context-aware verification combined with network behaviour monitoring detect and prevent unauthorized cloud access more effectively than traditional authentication + static RBAC?

Evaluation metrics: threat detection rate, false positive rate, time to detect, time to respond, unauthorized access prevention, risk classification quality, session compromise detection.

---

## Changelog

- Initial frozen blueprint consolidated into this spec.
- Decision: MongoDB Atlas added for `network_events` only, from Phase 11 onward — all other data stays in Supabase/Postgres.
- Decision: interface palette split into light/dark tokens distinct from the marketing brand palette, with two UI modes (SOC/analyst, developer/terminal).
