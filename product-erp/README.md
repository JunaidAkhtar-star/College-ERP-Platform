# RITE ERP Frontend

Multi-tenant institutional ERP built with Next.js 16, React 19, TypeScript,
Tailwind CSS and MUI. Tenant routes use the form
`/{tenant}/{role}/{module}`; authentication routes use
`/{tenant}/auth/{action}`.

## Requirements

- Node.js 20+
- pnpm 10
- A running Devvelocity ERP backend

## Local setup

```bash
cp .env.example .env.development
pnpm install
pnpm dev
```

Open `http://localhost:3000` for the platform root or
`http://tenant-id.localhost:3000` for a tenant.

Environment variables are documented in [.env.example](.env.example). Never
commit real credentials or tenant data.

## Quality and release commands

```bash
pnpm check       # formatting, ESLint and strict TypeScript
pnpm test        # architecture and authentication contracts
pnpm build       # production Webpack build
pnpm start       # serve the production build
```

The release build intentionally uses Webpack because the current Turbopack
production compiler stalls on this application’s route volume. CI sets
`NEXT_DIST_DIR=.next-ci`, keeping release output separate from a running
development server.

## Application conventions

- GET requests use `useSwr`.
- Mutations and imperative authenticated requests use `useMutation`.
- Protected binary downloads use `fetchProtectedBlob`.
- Programmatic navigation uses `nextjs-toploader/app`.
- Tables use `CustomTable`.
- Uploads use `InlineFileUpload`; previews use `FileViewer`.
- Local storage access goes through `src/shared/utils`.
- Permissions shown in the UI are convenience controls; the backend remains
  authoritative.

Architecture-contract tests enforce the request, router and viewport rules.

## Main product areas

The frontend covers admissions, student and faculty records, academic
structure, curriculum, timetable, attendance, assessment, examinations, fees,
accounts, payroll, HR, library, hostel, transport, placement, communication,
quality/accreditation, reporting, tenant settings and platform integrations.
Navigation is returned by the backend and filtered by role and subscription.

## Deployment

1. Configure production `NEXT_PUBLIC_*` values.
2. Run `pnpm install --frozen-lockfile`.
3. Run `pnpm check`, `pnpm test` and `pnpm build`.
4. Deploy the generated Next.js application behind HTTPS.
5. Route the ERP root and wildcard tenant domain to the same application.
6. Verify sign-in, tenant resolution and backend CORS from the deployed URL.

Do not deploy if any CI job fails. Complete [UAT_CHECKLIST.md](UAT_CHECKLIST.md)
for every institutional release.
