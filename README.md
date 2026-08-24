# Veylo - Zero Trust Cloud Security Platform

Veylo is a production-grade, multi-tenant Zero Trust cloud security platform designed to enforce continuous security validation across your organization's infrastructure. It validates access at every layer—organization, identity, device, network, behavior, and resource—rather than trusting a single login event.

## 🚀 Key Features

* **Multi-Tenant Architecture**: Robust organization and project segregation using PostgreSQL Row-Level Security (RLS).
* **Continuous Device Posture Validation**: Evaluates device health (e.g., firewall status, disk encryption) in real-time to dynamically allow or block access.
* **Tamper-Evident Forensic Ledger**: Security events are cryptographically chained in an append-only PostgreSQL ledger.
* **High-Volume Telemetry Streaming**: Network traffic events are streamed to MongoDB Atlas to separate analytical workloads from transactional data.
* **Role-Based Access Control (RBAC)**: Strict permission enforcement for Project Owners, Admins, and Viewers.
* **Zero Trust API Guards**: Drop-in middleware for microservices to intercept traffic and validate against real-time posture scoring.

## 🛠 Tech Stack

### Frontend
* **Framework**: React + Vite + TypeScript
* **State Management**: Zustand
* **Styling**: Tailwind CSS v4 (Custom Zero Trust Theme)
* **Graphics**: HTML5 Canvas (3D Wireframe Globe)

### Backend
* **Framework**: NestJS (TypeScript)
* **Validation**: Zod & NestJS ValidationPipes
* **Primary Database**: Supabase (PostgreSQL) - Relational data, Tenants, RBAC, Forensics
* **Telemetry Database**: MongoDB Atlas - Network traffic and telemetry logs
* **Authentication**: Supabase Auth (RS256 JWT)
* **Caching & Rate Limiting**: Upstash Redis

## 📦 Project Structure

This project uses a monorepo setup managed by `pnpm` Workspaces and `Turborepo`.

```
veylo/
├── apps/
│   ├── web/        # React + Vite Frontend
│   └── api/        # NestJS Backend API
├── packages/
│   └── shared/     # Shared Zod schemas, types, and constants
└── supabase/
    └── migrations/ # PostgreSQL schema and RLS policies
```

## 💻 Getting Started

### Prerequisites
* Node.js (v18+)
* pnpm (v9+)
* Supabase CLI (optional, for local DB management)

### Installation
1. Clone the repository:
   ```bash
   git clone git@github.com:Chintu1308/veylo.git
   cd veylo
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Set up environment variables for both `apps/api` and `apps/web` based on their respective `.env.example` templates.

### Running Locally
To start both the frontend and backend development servers simultaneously:
```bash
pnpm dev
```
* **Frontend**: http://localhost:5173
* **API**: http://localhost:3001

## 🛡 Security Principles

1. **No Shared Trust**: Every API endpoint explicitly checks context (Who, What, Where, Device Health).
2. **Immutable Auditing**: `forensic_events` is an append-only cryptographic chain. Any UPDATE/DELETE is blocked at the database level.
3. **Defense in Depth**: JWT signatures, rate limiters, database RLS, and device telemetry work together.

## 🌐 Integration

To protect your own applications with Veylo, you can utilize the drop-in integration scripts found in the Veylo Dashboard under **Devices > Integration Guides**.

---
*Built with secure-by-default engineering principles.*
