# Devvelocity Platform — Master Developer & Architecture Handover Guide

> **Confidential & Proprietary** — Devvelocity Platform  
> **Target Audience:** Engineering Team, Lead Developers, DevOps & System Architects  
> **Last Verified:** Current Production Baseline (2026)

---

## 1. Executive Summary & Platform Overview

The **Devvelocity Platform** is an enterprise-grade, multi-tenant Education ERP and SaaS management ecosystem. It provides end-to-end automation for universities, colleges, and polytechnic institutes—spanning student admissions, academic governance, examination systems, fee collection, HR/payroll, campus facilities, compliance (NAAC/NBA/IQAC), and student placement.

The workspace is organized as a multi-project monorepo containing four independent, purpose-built subprojects:

```
devvelocity-platform/
├── backend/        # Express + TypeScript Modular Monolith API & Background Queue Worker
├── product-erp/    # Multi-tenant Institutional College ERP (Next.js 16 + React 19)
├── admin/          # SaaS Operator & Super Admin Control Center (Next.js 16)
└── website/        # Public Marketing, Product Showcase & Checkout Portal (Next.js 16)
```

### High-Level Port & Service Matrix

| Service | Technology | Port | Default Local URL | Primary Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API** | Node 22, Express 4, TypeScript 5 | `8080` (or `5000`) | `http://localhost:8080` | REST API, WebSocket gateway, auth, database proxy |
| **Backend Worker** | Node 22, TypeScript, amqplib | N/A | Process worker | RabbitMQ queue consumer, cron jobs, background tasks |
| **Product ERP** | Next.js 16, React 19, Tailwind, MUI | `3000` | `http://localhost:3000` / `http://{tenant}.localhost:3000` | Tenant-specific ERP interface for 15+ institutional roles |
| **Admin Portal** | Next.js 16, React 19, Tailwind, MUI | `3002` | `http://localhost:3002` | Platform Super Admin: tenants, billing, plans, integrations |
| **Website** | Next.js 16, React 19, Tailwind | `3001` | `http://localhost:3001` | Public marketing, module catalog, demo requests, checkout |
| **MongoDB** | MongoDB 6+ / Atlas | `27017` | `mongodb://localhost:27017` | Master DB (`devvelocity_master`) + Tenant DBs (`erp`, etc.) |
| **Redis** | Redis 7+ | `6379` | `redis://localhost:6379` | Caching, session store, rate limiting, Socket.IO adapter |
| **RabbitMQ** | RabbitMQ 3.12+ (AMQP) | `5672` / `15672` | `amqp://localhost:5672` | Durable outbox event queue, background job distribution |

---

## 2. Platform Architecture Diagram

```mermaid
flowchart TB
    subgraph Clients["Clients & Entrypoints"]
        PublicUser["Public Web Visitor"] --> Website["Website (:3001)"]
        SaaSAdmin["Platform Operator / Super Admin"] --> AdminPortal["Admin Portal (:3002)"]
        TenantUsers["Students, Faculty, Staff, Parents"] --> ProductERP["Product ERP (:3000)<br/>{tenant}.localhost:3000"]
    end

    subgraph ReverseProxy["Nginx / Gateway (Production)"]
        Nginx["Reverse Proxy + Wildcard TLS (*.erp.devvelocity.in)"]
    end

    Website --> Nginx
    AdminPortal --> Nginx
    ProductERP --> Nginx

    subgraph BackendMonolith["Devvelocity Backend (Modular Monolith)"]
        API["Express HTTP Server (JOB_RUNTIME_MODE=api)"]
        WS["Socket.IO Gateway (Real-Time Events)"]
        Outbox["MongoDB Transactional Outbox"]
        Worker["Background Consumer (JOB_RUNTIME_MODE=worker)"]
        Cron["node-cron Scheduler"]

        API --> Outbox
        Worker --> RabbitMQ["RabbitMQ Broker (erp.jobs, retry, dead)"]
        Outbox --> RabbitMQ
        RabbitMQ --> Worker
        Cron --> Worker
    end

    Nginx --> API
    Nginx --> WS

    subgraph MultiTenancy["Multi-Tenant Database Engine (Mongoose + Proxy)"]
        ConnManager["ConnectionManager (AsyncLocalStorage)"]
        API --> ConnManager
        Worker --> ConnManager

        MasterDB[("Master DB: devvelocity_master<br/>(Tenants, Subscriptions, Plans, Global Admins)")]
        TenantDB1[("Tenant DB: tenant_college_a<br/>(Students, Faculty, Grades, Fees, Attendance)")]
        TenantDB2[("Tenant DB: tenant_college_b<br/>(Students, Faculty, Grades, Fees, Attendance)")]

        ConnManager -->|GLOBAL_MODELS| MasterDB
        ConnManager -->|Dynamic Tenant Context| TenantDB1
        ConnManager -->|Dynamic Tenant Context| TenantDB2
    end

    subgraph ExternalServices["External Managed Services"]
        Redis[("Redis (ioredis)<br/>Cache, Sockets, Rate Limits")]
        Cloudinary["Cloudinary (File & Doc Storage)"]
        SMTP["SMTP (Gmail / SendGrid / SES)"]
        FCM["Firebase Cloud Messaging (Web & App Push)"]
        Agora["Agora RTC (Live Audio/Video Calling)"]
        Razorpay["Razorpay (Platform Subscriptions & Student Fees)"]
        AI["AI Hub (Gemini, Groq, OpenRouter)"]
        Puppeteer["Puppeteer-core (PDF Marksheets, IDs, Receipts)"]
    end

    API --> Redis
    API --> Cloudinary
    API --> SMTP
    API --> FCM
    API --> Agora
    API --> Razorpay
    API --> AI
    API --> Puppeteer
    WS --> Redis
```

---

## 3. Core Architectural Concepts

### 3.1 Multi-Tenant Isolation (Physical Database Separation)

Devvelocity provides **true multi-tenant isolation**. Rather than relying on simple column-based `tenantId` filtering in a shared collection (which risks data leaks on query errors), each institution has its own physical MongoDB database.

1. **Master Database (`devvelocity_master`)**:
   Stores platform-wide metadata:
   - `Tenant`: Registry of institutions, subdomains, custom domains, database connection strings, and status (`active`, `suspended`, `provisioning_failed`).
   - `PlatformProduct`, `ProductModule`, `SubscriptionPlan`, `ProductAddon`: Product catalog, pricing, and feature matrices.
   - `PlatformBillingRecord`, `PlatformBillingSettings`, `PlatformCoupon`: Invoice records, payment gateway setups.
   - `User`: Global Super Admins who manage the SaaS platform.
2. **Tenant Database (`erp` or `tenant_<tenantId>`)**:
   Houses all institutional data:
   - Users, Roles, StudentProfiles, FacultyProfiles, Departments, Subjects, Curricula, Timetables, Attendance, Examinations, Gradebooks, Fees, Ledgers, Payroll, Library, Transport, Hostels, etc.

#### The Magic: Mongoose Dynamic Proxy (`connectionManager.ts`)
Developers do not need to manually pass database connection handles in queries.
The system uses Node.js `AsyncLocalStorage`:
```typescript
// Any request coming into Express runs through tenantResolver middleware:
tenantLocalStorage.run({ tenantId, tenantDb }, () => {
  next();
});
```
Every standard Mongoose model import (e.g. `import { StudentProfileModel } from '../models/student-profile.model'`) is wrapped in an ES6 Proxy. When a method like `StudentProfileModel.find()` is called:
- If the model is in `GLOBAL_MODELS` (e.g. `Tenant`, `SubscriptionPlan`), it executes on the Master DB.
- Otherwise, the proxy queries `tenantLocalStorage.getStore()`, dynamically binds the schema to the active tenant's connection pool, and executes on that tenant's database!
- Fallback: If no tenant context is active (e.g., in unit tests or CLI scripts without context), it gracefully defaults to the default global connection.

#### Tenant Resolution Flow
The `tenantResolver` middleware resolves the tenant in the following order:
1. **Authenticated JWT Bearer Token**: Authoritative if `payload.tenantId` is present.
2. **`X-Tenant-ID` HTTP Header**: Supplied by clients for unauthenticated tenant requests (e.g. login, admissions).
3. **`tenantId` Query Parameter**: Fallback for direct browser links and webhooks.
4. **Verified Custom Domain**: Matches incoming `req.hostname` against `Tenant.customDomain` (`customDomainStatus: "active"`).
5. **Managed Subdomain**: Matches `{tenant}.localhost` or `{tenant}.erp.devvelocity.in`.

---

### 3.2 Backend Modular Monolith & Domain Boundaries

The backend is structured as a **modular monolith** with clear architectural boundaries defined under `backend/server/domains/`:

1. **`platform-core`**:
   - Company-level capabilities: tenant registry, provisioning, subscriptions, platform billing, Razorpay integration, public catalog, backup management.
   - Routes: `super-admin`, `tenant-backup`, `tenant-domain`, `tenant-integrations`, `tenant-subscription`.
2. **`shared-foundation`**:
   - Cross-product infrastructure: authentication, MFA, sessions, RBAC, audit logging, search, notifications, uploads, SSO.
   - Routes: `audit-log`, `auth`, `health`, `nav`, `notification`, `role`, `search`, `sso`, `upload`, `user`.
3. **`product:college-erp`**:
   - Institutional education workflows: admissions, academics, attendance, examinations, fee collection, HR, payroll, etc. (Over 80 specific routes).

#### Architectural Guardrails
- **Automated Validation**: Running `pnpm run check:architecture` executes `server/scripts/validate-architecture.ts` to ensure every route file belongs to an explicit domain manifest and that dependency rules are never violated.
- **Request Tagging**: Every API response includes the diagnostic header `X-Devvelocity-Domain: <domain-id>`.

---

### 3.3 Asynchronous Job Delivery & RabbitMQ Outbox Pattern

To guarantee that background tasks (such as sending emails, dispatching push notifications, syncing audit logs, generating scheduled invoices, or processing attendance aggregates) are never lost if the server crashes, Devvelocity uses a **Transactional MongoDB Outbox Pattern** combined with RabbitMQ:

1. **Producer Phase**: When a business action occurs, an encrypted outbox record is written to MongoDB within the business transaction.
2. **Dispatcher Phase**: A publisher process polls due outbox records and sends them to RabbitMQ exchanges (`erp.jobs`) with publisher confirms.
3. **Consumer Phase**: Worker processes consume the job, execute the handler, mark the execution receipt, and acknowledge the message (`ack`).
4. **Resilience**:
   - If an error occurs, the message is routed to `erp.jobs.retry` with exponential backoff via TTL queues.
   - If retries are exhausted, the message lands in `erp.jobs.dead` (Dead Letter Queue) with the full stack trace.
   - Operators can inspect and replay DLQ messages directly from the Admin operations API without data loss.

#### Process Separation via `JOB_RUNTIME_MODE`:
- `JOB_RUNTIME_MODE=api`: Starts only the HTTP server and real-time WebSocket listeners. Background cron/consumers are inactive.
- `JOB_RUNTIME_MODE=worker`: Starts the RabbitMQ consumers and cron schedulers (using `backend/server/worker.ts`).
- `JOB_RUNTIME_MODE=all`: Runs both in a single process (default for local development).

---

### 3.4 Real-Time Events & Real-Time Media

- **Socket.IO (`server/socket/socket.gateway.ts`)**:
  - Connects frontend clients via WebSockets with automatic Redis adapter scaling.
  - Channels for real-time notifications, chat messages, active user presence, and live poll updates.
- **Agora RTC Integration**:
  - Full voice/video virtual classrooms and mentorship calling embedded into `product-erp`.
  - Backend dynamically generates Agora RTC tokens using App ID and App Certificate (`server/routes/meeting.routes.ts`).

---

### 3.5 Operational & Health Monitoring Dashboard

The backend includes a built-in, low-overhead operational dashboard accessible directly in the browser:
- **URL**: `http://localhost:8080/` (or `https://<backend-url>/`)
- **Protected by**: `DASHBOARD_USERNAME` & `DASHBOARD_PASSWORD` (Basic Auth) + `ADMIN_IP_WHITELIST`.
- **Live Stats Endpoint**: `GET /__stats` returns CPU temperature, load averages, memory usage, open connections, active tenants, and request error rates.
- **Live SSE Log Stream**: `GET /__logs/stream` streams live color-sanitized backend server logs in real time via Server-Sent Events.

---

## 4. User Roles & RBAC Matrix

Devvelocity features a granular Role-Based Access Control system. Users belong to a primary `SystemRole` (defined in `backend/server/constants/roles.ts`).

### Roles Summary

| Role Constant | Role Identifier | Target Audience | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| `SUPER_ADMIN` | `super_admin` | Platform Operator / Owner | Full SaaS access: tenant creation, billing, platform-wide configurations |
| `PRINCIPAL` | `principal` | Head of Institution | Institutional KPIs, approvals, department oversight, college notices |
| `DEAN_ACADEMIC` | `dean_academic` | Academic Dean | Curriculum regulations, academic calendar, faculty workload, OBE attainment |
| `HOD` | `hod` | Head of Department | Timetables, subject allotment, faculty leave approval, student attendance alerts |
| `FACULTY` | `faculty` | Professors / Lecturers | Attendance marking, lesson plans, question banks, marks entry, LMS materials |
| `STUDENT` | `student` | Enrolled Students | Timetable view, attendance tracking, fee payment, exam registration, quiz submissions |
| `PARENT` | `parent` | Student Guardians | Ward attendance tracking, fee receipts, exam results, teacher-parent messaging |
| `ADMISSION_COUNSELOR` | `admission_counselor` | Admissions Cell | Lead management, application verification, merit list generation, seat allotment |
| `EXAMINATION_CELL` | `examination_cell` | Controller of Exams | Exam schedules, hall tickets, seating arrangements, results compilation |
| `IQAC_TEAM` | `iqac_team` | Quality Assurance | Student feedback analysis, NBA/NAAC SSR reports, compliance auditing |
| `SCHOLARSHIP_CELL` | `scholarship_cell` | Financial Aid Staff | Government/private scholarship tracking, application approval, disbursement |
| `LIBRARY_STAFF` | `library_staff` | Librarians | Book cataloging, issue/return management, fine collection, barcode lookup |
| `PLACEMENT_CELL` | `placement_cell` | Training & Placement | Campus drives, company CRM, student shortlists, offer letter tracking |
| `HR_DEPARTMENT` | `hr_department` | Human Resources | Employee onboarding, faculty service records, leave balance management |
| `ACCOUNTS_DEPARTMENT`| `accounts_department` | Finance Office | Fee structure definition, offline fee receipting, dues reports, expense ledger |

### Navigation & Dynamic Menus
- Menu items are not hardcoded in the frontend.
- When a user logs in, `product-erp` queries `GET /api/v1/nav/my-nav`.
- The backend checks the user's role against `RoleModel.allowedNavItems` and active tenant subscription modules, returning only the permitted sidebar navigation items.

---

## 5. Directory Structure Tour

### 5.1 `backend/`
```
backend/
├── server/
│   ├── server.ts                  # Main Express application entrypoint
│   ├── worker.ts                  # Dedicated background worker process entrypoint
│   ├── configs/
│   │   ├── index.ts               # Env parsing, validation & database connector
│   │   └── connectionManager.ts   # Multi-tenant AsyncLocalStorage & Mongoose proxy
│   ├── constants/                 # System roles, permissions, role-defaults
│   ├── controllers/               # Express request handlers (90+ controllers)
│   ├── domains/                   # Domain manifests (platform-core, shared, college-erp)
│   ├── jobs/                      # node-cron definitions & background queue jobs
│   ├── middlewares/               # auth, tenantResolver, rateLimit, ipWhitelist, etc.
│   ├── models/                    # Mongoose schemas & TypeScript interfaces
│   ├── pdf/                       # Puppeteer PDF generation service & Handlebars templates
│   ├── platform/                  # Domain contracts, DTOs, and architecture registry
│   ├── repositories/              # Database access abstraction layer
│   ├── routes/                    # 97 Express route modules
│   ├── scripts/                   # Database migrations, seeders, sync utilities
│   ├── services/                  # Business logic services
│   ├── socket/                    # Socket.IO gateway and room management
│   └── utils/                     # Token signing, encryption, logger, redis helper
├── test/                          # Architecture and unit test suites
├── package.json                   # Scripts, dependencies, engines
└── tsconfig.json                  # TypeScript compiler settings
```

### 5.2 `product-erp/`
```
product-erp/
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root HTML layout with providers (TopLoader, Toast)
│   │   ├── page.tsx               # Root landing / redirect
│   │   ├── [tenant]/              # Dynamic tenant routing root
│   │   │   ├── auth/              # Sign-in, MFA, forgot password routes
│   │   │   ├── admission-portal/  # Public student admission application form
│   │   │   └── [role]/            # Role-scoped portal routes (e.g. /demo/faculty/attendance)
│   │   └── verify/                # Public document QR-code verification pages
│   ├── features/
│   │   ├── auth/                  # Login forms, MFA verification components
│   │   └── role-wise-features/    # 70+ feature modules (attendance, exams, fees, etc.)
│   ├── shared/
│   │   ├── core/                  # Mandatory UI components: CustomTable, FileViewer, etc.
│   │   ├── hooks/                 # useSwr, useMutation, useNav, useSocket, useFcm
│   │   ├── layouts/               # Header, Sidebar, GlobalCalendarPanel, UserGuide
│   │   ├── store/                 # Zustand global stores (authStore, layoutStore)
│   │   └── utils/                 # localStorage helpers, motion, authenticatedRequest
├── public/                        # Static assets, branding, firebase-messaging-sw.js
├── test/                          # Architecture contract tests
└── package.json                   # Dependencies (Next.js 16, React 19, MUI, Tailwind v4)
```

### 5.3 `admin/`
```
admin/
├── src/
│   ├── app/
│   │   ├── (dashboard)/           # Protected Super Admin dashboard routes:
│   │   │   ├── tenants/           # Tenant onboarding, domain mapping, limits
│   │   │   ├── plans/             # Subscription tiers, module pricing
│   │   │   ├── billing/           # Invoices, transactions, Razorpay webhook status
│   │   │   ├── settings/          # Integration center (Cloudinary, Agora, Gemini keys)
│   │   │   └── leads/             # Demo requests and sales pipeline
│   │   └── auth/                  # Super admin sign-in & password recovery
│   ├── features/                  # Admin feature modules and dialogs
│   └── shared/                    # SWR hooks, Zustand stores, core UI components
└── package.json
```

### 5.4 `website/`
```
website/
├── src/
│   ├── app/
│   │   ├── page.tsx               # Marketing landing page
│   │   ├── products/              # College ERP product showcase
│   │   ├── modules/               # Detailed breakdown of all ERP features
│   │   ├── checkout/              # Self-service institution SaaS checkout
│   │   ├── demo/                  # Interactive demo booking form
│   │   ├── company/               # About us & mission
│   │   ├── terms/, privacy/, faq/ # Legal and support pages
│   └── features/landing/          # Hero sections, pricing cards, testimonials
└── package.json
```

---

## 6. Complete Local Development Setup Guide

### 6.1 Prerequisites

Ensure your machine has the following installed:
1. **Node.js**: `v22.x` (or minimum `v20.x`)
2. **pnpm**: `v10.x` or `v11.x` (`npm install -g pnpm`)
3. **MongoDB**: Local MongoDB community instance running on port `27017` OR a MongoDB Atlas cluster URI.
4. **Redis**: Local Redis running on port `6379` OR Redis Cloud URI.
5. **RabbitMQ**: Local RabbitMQ instance running on `5672` OR a CloudAMQP instance.

### 6.2 Local Host Configuration (For Tenant Subdomains)

Because the ERP resolves tenants from subdomains (e.g., `http://demo.localhost:3000`), modern browsers automatically resolve `*.localhost` to `127.0.0.1`.
If your browser or OS does not support wildcard `.localhost`, add the following entries to `/etc/hosts` (macOS/Linux) or `C:\Windows\System32\drivers\etc\hosts` (Windows):

```text
127.0.0.1   localhost
127.0.0.1   demo.localhost
127.0.0.1   test.localhost
```

---

### 6.3 Step-by-Step Installation & Booting

Open four terminal windows (or use PM2/tmux) to run the services.

#### Step 1: Install Dependencies Across All Projects
```bash
# In the root repository directory:
cd backend && pnpm install
cd ../product-erp && pnpm install
cd ../admin && pnpm install
cd ../website && pnpm install
```

#### Step 2: Configure Environment Files
1. In `backend/`:
   ```bash
   cp .env.example .env
   ```
   *Verify that `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `ENCRYPTION_KEY` are populated.*
2. In `product-erp/`:
   ```bash
   cp .env.example .env.development
   ```
   *Verify `NEXT_PUBLIC_BACKEND_URL=http://localhost:8080/api/v1` and `NEXT_PUBLIC_ERP_ROOT_DOMAIN=localhost`.*
3. In `admin/`:
   ```bash
   cp .env.example .env.development
   ```
   *Verify `NEXT_PUBLIC_BACKEND_URL=http://localhost:8080/api/v1` and `NEXT_PUBLIC_ADMIN_URL=http://localhost:3002`.*
4. In `website/`:
   ```bash
   cp .env.example .env.development
   ```
   *Verify `NEXT_PUBLIC_BACKEND_URL=http://localhost:8080/api/v1` and `NEXT_PUBLIC_SITE_URL=http://localhost:3001`.*

#### Step 3: Seed Initial Data
Before starting the backend for the first time, run the master database seeders:

```bash
cd backend

# 1. Seed Master Super Admin and Platform Catalog (Plans, Products, Modules)
pnpm seed:master
pnpm seed:catalog
pnpm sync:subscription-plans

# 2. Seed Default Institutional Tenant Data (Roles, Departments, NavItems, Admin user)
pnpm seed
```

#### Step 4: Run the Development Servers

**Terminal 1 — Backend API & Worker:**
```bash
cd backend
pnpm dev
# Server will start on http://localhost:8080
```

**Terminal 2 — Product ERP:**
```bash
cd product-erp
pnpm dev
# Next.js ERP will start on http://localhost:3000
```

**Terminal 3 — Admin Portal:**
```bash
cd admin
pnpm dev
# Next.js Admin will start on http://localhost:3002
```

**Terminal 4 — Public Website:**
```bash
cd website
pnpm dev
# Next.js Website will start on http://localhost:3001
```

---

## 7. Master Environment Variables Dictionary

### 7.1 Backend (`backend/.env`)

| Variable Name | Required | Default / Sample | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | Yes | `8080` | Port the Express server listens on. |
| `NODE_ENV` | Yes | `development` | `development` or `production`. In production, strict security guards activate. |
| `API_VERSION` | Yes | `api/v1` | URL route prefix for all endpoints. |
| `HOST` | Yes | `http://localhost` | Internal server host URL. |
| `MONGODB_URI` | Yes | `mongodb://127.0.0.1:27017` | MongoDB connection string. Supports replica sets and Atlas URIs. |
| `MASTER_DB_NAME`| Yes | `devvelocity_master` | Database name where tenant registries and platform catalogs live. |
| `REDIS_URL` | Yes | `redis://127.0.0.1:6379` | Redis instance for session caching, rate limits, and Socket.IO adapter. |
| `RABBITMQ_URL` | Yes | `amqp://user:pass@127.0.0.1:5672/erp` | AMQP broker URL for outbox jobs and worker delivery. |
| `RABBITMQ_PREFETCH` | No | `10` | Number of unacknowledged jobs delivered to each worker simultaneously. |
| `JOB_RUNTIME_MODE`| Yes | `all` | `all` (single process), `api` (HTTP/outbox only), or `worker` (consumer only). |
| `JWT_SECRET` | Yes | `(min 64 chars hex)` | Secret key used to sign and verify short-lived access tokens (15m). |
| `JWT_REFRESH_SECRET`| Yes | `(min 64 chars hex)` | Independent secret key used to sign refresh tokens (7d). |
| `AUDIT_HMAC_SECRET` | Yes | `(min 64 chars hex)` | Secret used to compute HMAC integrity checksums on audit log entries. |
| `ENCRYPTION_KEY` | Yes | `(64 hex chars = 32 bytes)` | AES-256-GCM key for encrypting provider credentials & outbox payloads. |
| `FRONTEND_URL` | Yes | `http://localhost:3000` | Base URL of the Product ERP frontend. |
| `PLATFORM_WEBSITE_URL`| Yes| `http://localhost:3001` | Public website URL used in billing receipts and emails. |
| `ALLOWED_ORIGINS`| Yes | `http://localhost:3000,http://*.localhost:3000...` | Comma-delimited list of permitted CORS web origins. |
| `TENANT_ROOT_DOMAIN` | Yes | `localhost` / `erp.devvelocity.in` | Root domain used to parse tenant subdomains. |
| `TENANT_CNAME_TARGET`| Yes | `localhost` / `tenants.erp.devvelocity.in`| Target CNAME provided to clients configuring custom domains. |
| `ADMIN_IP_WHITELIST` | No | `127.0.0.1,::1` | Allowed IP list for the operational dashboard at `/` and `/__stats`. |
| `DASHBOARD_USERNAME` | No | `operations-admin` | Basic Auth user for operational dashboard. |
| `DASHBOARD_PASSWORD` | No | `(secure password)` | Basic Auth password for operational dashboard. |
| `CLOUDINARY_*` | Optional | `CLOUDINARY_CLOUD_NAME`, etc. | Credentials for document & image storage. |
| `SMTP_*` | Optional | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, etc. | Mail delivery configuration for student alerts and invoices. |
| `FIREBASE_*` | Optional | `FIREBASE_PROJECT_ID`, etc. | Service account details for FCM mobile/browser push notifications. |
| `AGORA_*` | Optional | `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` | Audio/video calling token generation credentials. |
| `RAZORPAY_*` | Optional | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Credentials for platform billing and student fee checkouts. |
| `GEMINI_API_KEY` | Optional | `AQ...` | Google Gemini API key for ERP AI Assistant features. |

### 7.2 Product ERP (`product-erp/.env.development` / `.env.production`)

| Variable Name | Required | Sample Value | Description |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_BACKEND_URL` | Yes | `http://localhost:8080/api/v1` | URL of the backend API. |
| `NEXT_PUBLIC_ERP_URL` | Yes | `http://localhost:3000` | Institutional ERP root address. |
| `NEXT_PUBLIC_ERP_ROOT_DOMAIN` | Yes | `localhost` / `erp.devvelocity.in` | Used by frontend routing to detect the current tenant slug. |
| `NEXT_PUBLIC_ADMIN_URL` | Yes | `http://localhost:3002` | Pointer to the SaaS Admin portal. |
| `NEXT_PUBLIC_WEBSITE_URL` | Yes | `http://localhost:3001` | Pointer to the public marketing website. |
| `NEXT_PUBLIC_DEV_TENANT_ID` | No | `demo` | Optional fallback tenant slug when visiting plain `localhost:3000`. |
| `NEXT_PUBLIC_FIREBASE_*` | Optional | `AIzaSy...` | Firebase web client keys for push notification subscriptions. |
| `NEXT_PUBLIC_AGORA_APP_ID` | Optional | `7bfe67...` | Agora client ID for virtual classroom connections. |

### 7.3 Admin (`admin/.env.development` / `.env.production`)

| Variable Name | Required | Sample Value | Description |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_BACKEND_URL` | Yes | `http://localhost:8080/api/v1` | URL of the backend API. |
| `NEXT_PUBLIC_ADMIN_URL` | Yes | `http://localhost:3002` | Self-referential URL of the Admin portal. |
| `NEXT_PUBLIC_ERP_URL` | Yes | `http://localhost:3000` | Pointer to the ERP application. |
| `NEXT_PUBLIC_WEBSITE_URL` | Yes | `http://localhost:3001` | Pointer to the public marketing site. |

### 7.4 Website (`website/.env.development` / `.env.production`)

| Variable Name | Required | Sample Value | Description |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_BACKEND_URL` | Yes | `http://localhost:8080/api/v1` | Backend API URL for contact forms and checkout APIs. |
| `NEXT_PUBLIC_SITE_URL` | Yes | `http://localhost:3001` | Public website origin. |
| `NEXT_PUBLIC_ADMIN_URL` | Yes | `http://localhost:3002` | Admin link for operators. |
| `NEXT_PUBLIC_ERP_URL` | Yes | `http://localhost:3000` | Direct login link for students/faculty. |

---

## 8. Database Migrations & Maintenance Scripts

All database migrations and maintenance scripts are located in `backend/server/scripts/` and registered in `backend/package.json`.

> [!IMPORTANT]
> Always take a verified MongoDB backup before running migrations in staging or production.
> Migrations are additive and safe to run on existing data.

### Critical Scripts Inventory

| Command | Script File | Purpose & When to Run |
| :--- | :--- | :--- |
| `pnpm seed:master` | `seed-master-admin.ts` | **Initial Setup**: Creates the SaaS Super Admin and master roles. |
| `pnpm seed:catalog` | `seed-platform-catalog.ts`| **Initial Setup**: Seeds platform products, plans, and add-ons. |
| `pnpm sync:subscription-plans` | `sync-subscription-plans.ts` | **Catalog Update**: Synchronizes pricing tiers with master DB. |
| `pnpm seed` | `seed.ts` | **Tenant Setup**: Seeds departments, default roles, navigation items, and admin user. |
| `pnpm seed:tenant-test` | `seed-tenant-test-data.ts` | **QA/Demo**: Seeds realistic students, faculty, and attendance for testing. |
| `pnpm migrate:tenants` | `migrate-tenant-registry.ts` | Migrates legacy tenant configs to the latest tenant schema. |
| `pnpm migrate:assignable-rbac` | `migrate-assignable-rbac.ts` | Updates permission matrix to support custom assigned sub-roles. |
| `pnpm sync:role-nav-items` | `sync-role-nav-items.ts` | Re-syncs database navigation items with TypeScript role defaults. |
| `pnpm migrate:enterprise-entitlements` | `migrate-enterprise-entitlements.ts` | Provisions enterprise feature flags for licensed institutions. |
| `pnpm migrate:timetable-indexes` | `migrate-timetable-indexes.ts` | Adds high-performance compound indexes to timetable collections. |
| `pnpm migrate:exam-verification` | `migrate-examination-mark-verification.ts` | Installs exam marks double-entry verification workflow. |
| `pnpm migrate:obe-governance` | `migrate-obe-attainment-governance.ts` | Configures Outcome-Based Education (CO/PO/PSO) mapping tables. |
| `pnpm check:architecture` | `validate-architecture.ts` | **CI Gate**: Verifies route ownership across the 3 domains. |

---

## 9. Testing & Code Quality Verification

Devvelocity enforces strict code quality and architectural integrity. Before submitting pull requests or cutting a release, ensure all checks pass.

### Running Quality Checks

```bash
# In backend/:
pnpm check           # Runs Prettier check, ESLint, TypeScript --noEmit, and architecture validation
pnpm test            # Runs backend unit and architecture tests (140+ tests)

# In product-erp/:
pnpm check           # Runs Prettier check, ESLint, and strict TypeScript check
pnpm test            # Runs ERP architecture suite (ensures router/storage/viewport rules)
pnpm test:e2e        # Runs Playwright browser integration tests

# In admin/:
pnpm check           # Formatting, linting, and type checking

# In website/:
pnpm check           # Formatting, linting, and type checking
```

---

## 10. Frontend Engineering Guidelines (Strict Rules)

The frontend applications (`product-erp`, `admin`, `website`) adhere to strict guidelines outlined in their respective `AGENTS.md` files:

1. **Strict TypeScript (Zero `any`)**:
   - Never use `any` or loose type casting. Explicit interfaces must be defined in `@/shared/types` or local feature type files.
2. **Data Fetching Standard**:
   - **GET Requests**: MUST use the custom `useSwr` hook (`@/shared/hooks/useSwr`). Never call `fetch()` directly in components.
   - **Mutations (POST / PUT / PATCH / DELETE)**: MUST use the custom `useMutation` hook (`@/shared/hooks/useMutation`). Always attach an `onError` toast handler.
3. **Table & Data Display**:
   - NEVER build custom HTML tables. Always use `CustomTable` from `@/shared/core/CustomTable`.
4. **File Uploads & Previews**:
   - File uploads must use `InlineFileUpload` from `@/shared/core/InlineFileUpload`.
   - File/PDF/Image previews must use `FileViewer` from `@/shared/core/FileViewer`.
5. **Programmatic Navigation**:
   - Never import `useRouter` from `next/navigation`. Always import from `nextjs-toploader/app` so the top progress bar triggers on route changes.
6. **Mobile Viewport Height**:
   - Never use `h-screen`. Always use `h-dvh` to ensure compatibility with collapsing mobile browser URL bars.
7. **LocalStorage Access**:
   - Never call `localStorage.setItem / getItem` directly. Always use the helpers in `@/shared/utils/index.ts` (`saveToLocalStorage`, `getFromLocalStorage`, `removeFromLocalStorage`). The token key is strictly `'accessToken'`.

---

## 11. Production Deployment & Operations Runbook

### 11.1 Infrastructure Requirements

- **Linux Server**: Ubuntu 22.04 LTS / Debian 12 (Minimum 4 vCPU, 8GB RAM recommended for production).
- **Process Supervisor**: PM2 (Node process management) or systemd.
- **Reverse Proxy**: Nginx with WebSocket proxy support and Certbot for Wildcard SSL certificates (`*.erp.devvelocity.in`).
- **MongoDB**: Replica set (mandatory because transactional outbox and financial ledgers use multi-document ACID transactions).
- **Binary Utilities**: `mongodump` (for automated tenant backups) and `chromium-browser` (for PDF marksheet generation).

### 11.2 Production Build Steps

Run these commands on the deployment server:

```bash
# 1. Build Backend
cd backend
pnpm install --frozen-lockfile
pnpm build

# 2. Build Product ERP (Uses Webpack compiler for high route capacity)
cd ../product-erp
pnpm install --frozen-lockfile
pnpm build

# 3. Build Admin
cd ../admin
pnpm install --frozen-lockfile
pnpm build

# 4. Build Website
cd ../website
pnpm install --frozen-lockfile
pnpm build
```

### 11.3 PM2 Process Configuration

Start the processes with separate API and background worker roles:

```bash
# 1. Start Backend API Server
JOB_RUNTIME_MODE=api pm2 start backend/build/server.js --name devvelocity-api -i 2

# 2. Start Dedicated Background Queue Worker
JOB_RUNTIME_MODE=worker pm2 start backend/build/worker.js --name devvelocity-worker -i 1

# 3. Start Next.js Applications
pm2 start pnpm --name devvelocity-erp --cwd product-erp -- start -p 3000
pm2 start pnpm --name devvelocity-admin --cwd admin -- start -p 3002
pm2 start pnpm --name devvelocity-website --cwd website -- start -p 3001

# Save configuration
pm2 save
pm2 startup
```

### 11.4 Nginx Reverse Proxy Configuration Example

```nginx
# Map WebSocket Upgrade Headers
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

# 1. Public Marketing Website
server {
    server_name devvelocity.in www.devvelocity.in;
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/devvelocity.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/devvelocity.in/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 2. SaaS Super Admin Portal
server {
    server_name admin.devvelocity.in;
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/devvelocity.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/devvelocity.in/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 3. Institutional ERP (Root + Wildcard Tenants)
server {
    server_name erp.devvelocity.in *.erp.devvelocity.in;
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/devvelocity.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/devvelocity.in/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 4. Backend API & WebSockets Gateway
server {
    server_name api.devvelocity.in;
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/devvelocity.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/devvelocity.in/privkey.pem;

    # Disable buffering for Server-Sent Events (Live Log Stream)
    location /__logs/stream {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
    }

    # WebSocket & REST API
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 25M;
    }
}
```

---

## 12. Troubleshooting & Common Developer Gotchas

### 1. `X-Tenant-ID header or valid tenant subdomain is required`
- **Cause**: The backend was called on an institutional route without tenant context.
- **Fix**: Ensure you pass the `X-Tenant-ID: <tenant-slug>` header on API calls or visit the frontend using a subdomain (e.g. `http://demo.localhost:3000`). Alternatively, set `NEXT_PUBLIC_DEV_TENANT_ID=demo` in `product-erp/.env.development`.

### 2. `CORS: origin ... not permitted`
- **Cause**: The incoming browser origin is not in `ALLOWED_ORIGINS` in `backend/.env`.
- **Fix**: Add your local or staging URL (including wildcard patterns like `http://*.localhost:3000`) to `ALLOWED_ORIGINS` in `backend/.env`.

### 3. Turbopack Build Stall on `product-erp`
- **Cause**: Next.js Turbopack compiler (`next build`) may run out of memory or stall when compiling 70+ deeply nested role-based dynamic routes.
- **Fix**: The build script is intentionally configured with `next build --webpack`. Never remove the `--webpack` flag in `product-erp/package.json` or `admin/package.json`.

### 4. Background Jobs Not Executing
- **Cause**: RabbitMQ is disconnected or `JOB_RUNTIME_MODE` is set to `api`.
- **Fix**: Verify RabbitMQ is running (`pnpm` health check reports RabbitMQ status). Ensure either a separate worker process is running (`JOB_RUNTIME_MODE=worker node build/worker.js`) or set `JOB_RUNTIME_MODE=all` during local development.

### 5. PDF Generation Errors (Puppeteer)
- **Cause**: Missing Chrome/Chromium binary on Linux servers.
- **Fix**: Install Chromium (`apt-get install chromium-browser`) and set `PUPPETEER_EXEC_PATH=/usr/bin/chromium-browser` in `backend/.env`. On macOS, it automatically locates Google Chrome in `/Applications/Google Chrome.app`.

---

## 13. Quick Developer Command Reference

```bash
# -----------------------------------------------------------------------------
# ROOT OR MULTI-PROJECT WORKSPACE COMMANDS
# -----------------------------------------------------------------------------
# Install all dependencies across all 4 projects:
for dir in backend product-erp admin website; do (cd $dir && pnpm install); done

# -----------------------------------------------------------------------------
# BACKEND (backend/)
# -----------------------------------------------------------------------------
cd backend
pnpm dev                       # Start dev server with hot reload (port 8080)
pnpm build                     # Compile TypeScript to build/
pnpm start                     # Start production server
pnpm check                     # Linter, formatter, typecheck & architecture test
pnpm test                      # Run test suite
pnpm seed:master               # Seed Super Admin & catalog into Master DB
pnpm seed                      # Seed default roles, nav items & tenant admin
pnpm sync:role-nav-items       # Refresh database role permissions from code defaults

# -----------------------------------------------------------------------------
# PRODUCT ERP (product-erp/)
# -----------------------------------------------------------------------------
cd product-erp
pnpm dev                       # Start ERP dev server (port 3000)
pnpm build                     # Production Webpack build
pnpm check                     # Lint, format check & TypeScript validation
pnpm test                      # Run architecture tests

# -----------------------------------------------------------------------------
# ADMIN PORTAL (admin/)
# -----------------------------------------------------------------------------
cd admin
pnpm dev                       # Start Admin dev server (port 3002)
pnpm build                     # Production Webpack build
pnpm check                     # Lint & TypeScript validation

# -----------------------------------------------------------------------------
# PUBLIC WEBSITE (website/)
# -----------------------------------------------------------------------------
cd website
pnpm dev                       # Start Website dev server (port 3001)
pnpm build                     # Production Webpack build
pnpm check                     # Lint & TypeScript validation
```

---

*Handover document maintained by the Devvelocity Platform Architecture Team.*
