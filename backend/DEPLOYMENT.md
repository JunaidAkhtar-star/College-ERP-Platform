# Production deployment without Docker

## Required server services

- Node.js 22
- pnpm 11.15.0 through Corepack
- PM2 or systemd for process supervision
- Nginx or another HTTPS reverse proxy with WebSocket support
- MongoDB replica set because financial and workflow transactions require it
- Redis with persistence enabled
- RabbitMQ with durable queues and a dedicated least-privilege virtual host/user
- Chromium for PDF generation
- `mongodump` for tenant backups
- Wildcard DNS and TLS for tenant ERP subdomains

Do not commit production `.env` files. Store secrets in the server environment or
a secrets manager. The API refuses to start in production when security settings
are incomplete or unsafe.

## Install and validate

Run these commands inside each application directory:

```bash
corepack enable
corepack prepare pnpm@11.15.0 --activate
pnpm install --frozen-lockfile
pnpm check
pnpm audit --prod --audit-level high
```

Also run `pnpm test` in `backend` and `product-erp`.

## Production builds

Public Next.js environment variables must be configured before building because
they are compiled into browser assets.

```bash
cd backend && pnpm build
cd ../product-erp && pnpm build
cd ../admin && pnpm build
cd ../website && pnpm build
```

## Database release order

Back up the master database and every active tenant database before migrations.
Run only the migrations required by the release:

```bash
cd backend
pnpm migrate:tenants
pnpm migrate:assignable-rbac
pnpm migrate:monthly-billing
pnpm migrate:enterprise-entitlements
pnpm migrate:retire-integration-nav
pnpm sync:role-nav-items
```

Never run a seed script automatically in production. Seed scripts can create or
reset bootstrap records; migrations are the production release mechanism.

## PM2 processes

Create the processes with the production environment already loaded:

```bash
JOB_RUNTIME_MODE=api pm2 start backend/build/server.js --name devvelocity-api
JOB_RUNTIME_MODE=worker pm2 start backend/build/worker.js --name devvelocity-worker
pm2 start pnpm --name devvelocity-erp --cwd product-erp -- start
pm2 start pnpm --name devvelocity-admin --cwd admin -- start
pm2 start pnpm --name devvelocity-website --cwd website -- start
pm2 save
pm2 startup
```

Expected internal ports:

- ERP: `3000`
- Website: `3001`
- Platform Admin: `3002`
- API and WebSocket server: `5000`

Run exactly one scheduler-capable worker initially. API replicas use `JOB_RUNTIME_MODE=api`; worker
processes use `JOB_RUNTIME_MODE=worker`. The outbox and consumer claims are concurrency-safe, but
external-provider capacity and scheduler lease behavior must be verified before adding workers.

Nginx must proxy WebSocket upgrade headers to the API and route wildcard tenant
hosts to the ERP. Keep MongoDB, Redis, RabbitMQ (`5672`/`15672`) and application
ports private; expose only ports 80 and 443 through the reverse proxy. Configure
`RABBITMQ_URL`; tune `RABBITMQ_PREFETCH` for worker capacity. The health endpoint
reports whether the broker transport is enabled and connected.
Provision the `erp.jobs`, `erp.jobs.retry` and `erp.jobs.dead` exchanges and queues through the
application using a user limited to its dedicated virtual host. Production configuration validation
rejects a missing or malformed broker URL. Confirm the durable MongoDB outbox drains after a
broker restart before restoring normal traffic.

## Post-deployment verification

1. Confirm `GET /api/v1/health` returns HTTP 200.
2. Verify admin, website, ERP root and two separate tenant subdomains.
3. Verify login, refresh token, logout and MFA.
4. Verify Razorpay sandbox checkout and signed webhook delivery.
5. Verify manual student payment submission, Accounts approval and receipt.
6. Verify SMTP, Firebase, WebSocket chat and meeting integration readiness.
7. Run the authenticated ERP UAT workflow.
8. Execute and restore a tenant backup.
9. Stop RabbitMQ, create a canary background job, restart RabbitMQ, and verify the outbox drains
   exactly once; force a test job into the DLQ and verify attributed replay.

## Rollback

Keep the previous release directory and lockfiles. If verification fails, point
PM2 back to the previous release, reload the four processes and verify health.
Migrations are additive and idempotent; restore databases only when an incident
specifically requires data rollback.
