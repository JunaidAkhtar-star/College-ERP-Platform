# ERP Backend Operations Runbook

## Release gate

From `backend/`:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
```

All three commands must pass. Apply required migration commands from
`package.json` to a staging copy first. Record migration output and database
backup identifiers in the release ticket.

## Production configuration

Start from `.env.example` and inject secrets through the deployment platform.
Production startup rejects weak JWT secrets, an invalid AES key, insecure
origins, invalid tenant roots and partially configured Razorpay credentials.

Required baseline:

- Independent random JWT and refresh secrets of at least 32 characters.
- A 64-hex-character encryption key.
- Explicit HTTPS origins.
- MongoDB authentication, encryption at rest and restricted network access.
- TLS Redis with authentication where supported.
- Cloudinary, SMTP, Firebase and Razorpay least-privilege credentials.
- `TRUST_PROXY_HOPS` matching the exact reverse-proxy topology.
- An authenticated RabbitMQ virtual host URL. Use `amqps://` when traffic leaves a private host.

Never print `.env`, tokens, passwords or tenant personal data in release logs.

## Deployment

1. Put the instance in maintenance/drain mode.
2. Take and verify a MongoDB backup.
3. Deploy the immutable backend artifact.
4. Run approved migrations exactly once.
5. Check `/api/v1/health` and the protected operational dashboard.
6. Verify MongoDB, Redis, background jobs, email and file storage.
7. Smoke-test tenant resolution, login and one authorized API per critical role.
8. Restore traffic and monitor errors, latency and job failures.

Deploy the HTTP process with `JOB_RUNTIME_MODE=api` and the background process with
`JOB_RUNTIME_MODE=worker`. Restart workers first during a queue-contract rollout, verify their
RabbitMQ connection and outbox drain, and then roll API instances. The default `all` mode is for
local development or a single-process installation only.

Rollback uses the previous application artifact. Do not reverse a data migration
unless its documented rollback has already been rehearsed; restore the verified
backup when a migration is not backward compatible.

## Backup and restore

Tenant-managed Google Drive backups additionally require:

- MongoDB Database Tools (`mongodump`) installed on every backend worker.
- A Google OAuth web client with the exact callback displayed by the Admin
  Integration Center.
- The Drive API enabled and client credentials saved and tested through the
  encrypted Admin Integration Center.
- The callback URL registered as an authorized redirect URI.
- Enough temporary disk for one compressed tenant archive per active worker.

The ERP encrypts each archive before upload and stores only an encrypted OAuth
refresh token. Google Drive automation protects the tenant database; Cloudinary
binary replication remains a separate storage backup responsibility.

Back up separately:

- Master MongoDB database.
- Every tenant database.
- Cloudinary asset inventory and public IDs.
- Deployment configuration and encrypted secret references.
- Audit-log export when institutional retention requires immutable archives.

Redis is a cache and must not be the only copy of business data.

At least quarterly, restore into an isolated environment and verify:

1. Tenant registry and database mapping.
2. User authentication and role assignments.
3. Student, examination, fee, ledger and payroll record counts.
4. Uploaded-document references.
5. Audit-log continuity.

Document recovery-point and recovery-time measurements. A backup that has not
been restored is not considered verified.

Before production acceptance, the release owner must still retain independent
evidence for tenant isolation, supported load and backup restoration. The
repository does not include executable harnesses for those environment-specific
exercises.

## Monitoring and incidents

Alert on:

- Health-check or database failure.
- Redis disconnection.
- Elevated 5xx rate or latency.
- Background-job failure or missed execution.
- Repeated authentication/rate-limit failures.
- Payment webhook signature failures.
- Email, FCM, Cloudinary or PDF-generation errors.
- Disk, memory, CPU and connection-pool saturation.
- RabbitMQ disconnection, unroutable/publish-confirm failures, growing outbox backlog, retry queue
  age, any dead-letter message, and consumer count falling below the deployed worker count.

### RabbitMQ incidents

The protected operations endpoints expose broker queue counts, the durable outbox backlog and
dead letters. During an outage, keep MongoDB available: producers continue recording work in the
outbox and the dispatcher resumes confirmed publication after reconnection.

For dead letters, record the message ID and final error, correct the underlying dependency or data
problem, then replay with a meaningful incident reason. Replay creates a new message and retains
operator attribution. Do not purge the DLQ as a routine recovery step. Investigate sustained retry
growth before increasing prefetch; prefetch controls concurrency, not handler capacity.

Before credential rotation, create the replacement least-privilege user, update `RABBITMQ_URL`,
restart one worker, verify health and a canary job, then roll the remaining workers and revoke the
old user. Test broker restart, duplicate delivery, outbox recovery and DLQ replay in staging for
every release that changes queue topology.

For a suspected breach, revoke affected sessions and provider credentials,
preserve logs, restrict tenant access, identify exposed records, and follow the
institution’s notification policy. Never delete audit evidence during response.

## Data retention

Retention values are configured by environment. Changes require institutional
approval because they affect notifications, audit logs, sessions, notices,
deleted chat messages and soft-deleted records. Legal or investigation holds
must suspend applicable purge jobs.
