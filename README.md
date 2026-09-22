# Devvelocity Platform

> **Multi-Tenant Enterprise Resource Planning (ERP) & SaaS Infrastructure for Higher Education**

---

## Quick Navigation

- 📘 **Complete Developer & Architecture Handover Guide**: **[MASTER_DEVELOPER_HANDOVER.md](./MASTER_DEVELOPER_HANDOVER.md)**  
  *(Read this document first if you are taking over development, operations, or architecture of this platform).*

---

## Repository Architecture

This repository contains the four core components of the Devvelocity ecosystem:

| Subproject | Directory | Tech Stack | Port | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API & Workers** | [`backend/`](./backend) | Node.js 22, Express, TypeScript, Mongoose, Redis, RabbitMQ | `8080` (or `5000`) | Modular monolith API, multi-tenant DB proxy, outbox worker, WebSockets |
| **Product ERP** | [`product-erp/`](./product-erp) | Next.js 16, React 19, TypeScript, Tailwind CSS v4, MUI v9 | `3000` | Institutional ERP web portal supporting 15+ academic and operational roles |
| **Platform Admin** | [`admin/`](./admin) | Next.js 16, React 19, TypeScript, Tailwind CSS v4, MUI v9 | `3002` | SaaS Operator Control Center (tenants, subscriptions, licenses, integrations) |
| **Public Website** | [`website/`](./website) | Next.js 16, React 19, TypeScript, Tailwind CSS v4 | `3001` | Public marketing, module showcase, demo bookings, and checkout portal |

---

## 5-Minute Quick Start (Local Development)

### 1. Prerequisites
- Node.js ≥ 20 (Node 22 recommended)
- `pnpm` (`npm install -g pnpm`)
- MongoDB (running on `localhost:27017` or MongoDB Atlas URI)
- Redis (running on `localhost:6379`)
- RabbitMQ (running on `localhost:5672` or CloudAMQP URI)

### 2. Install Dependencies
```bash
# In the repository root:
for dir in backend product-erp admin website; do (cd $dir && pnpm install); done
```

### 3. Configure Environments
Copy the `.env.example` files in each subproject:
```bash
cp backend/.env.example backend/.env
cp product-erp/.env.example product-erp/.env.development
cp admin/.env.example admin/.env.development
cp website/.env.example website/.env.development
```

### 4. Seed Database
```bash
cd backend
pnpm seed:master        # Seeds Master Super Admin and Platform Catalog
pnpm seed               # Seeds Default Tenant Roles, NavItems, and Admin
```

### 5. Launch All Services
```bash
# Terminal 1 - Backend:
cd backend && pnpm dev

# Terminal 2 - Product ERP:
cd product-erp && pnpm dev

# Terminal 3 - Platform Admin:
cd admin && pnpm dev

# Terminal 4 - Public Website:
cd website && pnpm dev
```

Visit:
- **ERP**: `http://localhost:3000` (or `http://demo.localhost:3000`)
- **Admin**: `http://localhost:3002`
- **Website**: `http://localhost:3001`
- **API & Live Operations Dashboard**: `http://localhost:8080/` (or `/api-docs` for Swagger)

---

For in-depth details on **multi-tenant database proxying**, **RabbitMQ outbox queue semantics**, **role-based access control**, **production deployment with PM2 & Nginx**, and **developer rules**, read the comprehensive **[MASTER_DEVELOPER_HANDOVER.md](./MASTER_DEVELOPER_HANDOVER.md)**.
