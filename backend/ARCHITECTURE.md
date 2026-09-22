# Devvelocity backend architecture

The backend is a modular monolith. It remains one deployable service and preserves the existing
API URLs, while every route module has an explicit ownership boundary.

## Domains

### `platform-core`

Company-level capabilities shared by every Devvelocity product:

- tenant registry and provisioning
- subscriptions, licensing and commercial policy
- platform billing and payment verification
- domains, backups and managed integrations
- super-admin operations and public product catalogue

### `shared-foundation`

Cross-product technical capabilities:

- authentication and session policy
- RBAC, navigation and user identity
- notifications, search, uploads and SSO
- health and audit facilities

### `product:college-erp`

Institution-specific product capabilities:

- admissions, academics, attendance and assessment
- finance, HR, payroll and campus operations
- student, faculty and institutional workflows

## Rules for future products

1. A new product receives its own `product:<slug>` domain.
2. Products reuse platform identity, tenants, subscriptions, licensing and notifications.
3. A product must not read another product's models or services directly.
4. Cross-domain communication should use a documented service contract or event.
5. Extract a domain into a separate deployment only when scaling, data residency, security or
   release independence justifies the operational cost.

Route ownership is defined in `server/platform/domain-registry.ts`. Existing endpoints remain
compatible; the registry is the seam for a later gateway or service extraction.

## Enforced implementation

- Domain packages and capability manifests live under `server/domains`.
- Cross-domain DTOs live in `server/platform/contracts.ts`; product modules should exchange these
  contracts instead of importing another domain's persistence model.
- Typed lifecycle events live in `server/platform/domain-events.ts`.
- Every mounted request receives a server-resolved `req.backendDomain` value and the diagnostic
  `X-Devvelocity-Domain` response header.
- `pnpm run check:architecture` fails on duplicate ownership, missing explicitly-owned routes,
  invalid dependencies or self-dependencies.
- Architecture contracts are covered by `test/backend-architecture.test.cjs`.

## Background-job delivery

Tenant background work uses a MongoDB outbox as the durable system-of-record handoff and
RabbitMQ as the delivery transport. Producers write encrypted, idempotency-keyed outbox records;
the dispatcher publishes due records with publisher confirms, and workers acknowledge only after
the handler and its persistent execution receipt complete.

RabbitMQ provides at-least-once delivery. Every handler must therefore be idempotent using the
tenant-scoped `topic + idempotencyKey` contract. Fixed TTL queues provide retry backoff, while the
envelope's `availableAt` value prevents jobs with longer delays from running early. Exhausted jobs
are published to the quorum dead-letter queue with their final error. An operator replay creates a
new message ID and idempotency key while retaining replay attribution.

The API, dispatcher, scheduler and consumer currently share one modular-monolith process. Split
workers into a separate process before independently scaling API replicas or when queue workload
can materially affect request latency.
