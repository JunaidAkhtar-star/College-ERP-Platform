# Enterprise readiness status

**Updated:** 23 July 2026

## Locally verified

- Backend format, lint and TypeScript checks pass.
- Backend production build passes.
- Backend automated suite passes: 143 tests.
- ERP format, lint and TypeScript checks pass.
- ERP architecture suite passes: 5 tests.
- ERP production build passes.
- Live production dependency audits report no known vulnerabilities for either
  repository.
- Tenant schedulers dispatch durable commands; dead letters are inspectable and
  replay creates traced replacement events without deleting the original.
- Connector egress is DNS-pinned and allowlisted, OAuth tokens refresh with
  immutable secret versions, Twilio receipts are signed/idempotent, and campaign
  delivery distinguishes provider acceptance from confirmed delivery.
- Communication preferences include SMS and campaign resolution enforces
  channel consent plus hashed email/SMS suppression lists.

## Requires staging or independent evidence

| Gate | Required evidence | Command / owner |
|---|---|---|
| Cross-tenant and permission matrix | Evidence for two real tenants and allowed/denied identities | Platform/SRE staging exercise |
| Supported load | Concurrency, request volume, p95 latency and error-rate result | Platform/SRE performance exercise |
| Backup recovery | Isolated restore counts plus measured RPO/RTO | Platform/SRE recovery exercise |
| Multi-replica real-time | Redis reconnect, lobby admission, broadcast and ordering report | Platform/SRE staging exercise |
| Provider outage | SMS/email/payment/file-store failure injection and DLQ replay evidence | Integration owner |
| Accessibility/browser | Keyboard, axe and responsive screenshots for critical journeys | `pnpm test:e2e` with `UAT_WEB_URL`, `UAT_STORAGE_STATE` and `UAT_TENANT_SLUG` |
| Security acceptance | Dependency, secret, CodeQL, container/host scan and penetration report | Security workflow and assessor |
| Functional acceptance | Completed `UAT_CHECKLIST.md` with tenant, tester, date and evidence link | Business UAT owner |

Enterprise production acceptance is complete only when every row above has
attached passing evidence. A local build or unit suite is not a substitute.
