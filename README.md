<p align="center">
  <img src="public/icons/icon-192.png" alt="Rentora boarding house logo" width="88" height="88" />
</p>

<h1 align="center">Rentora</h1>
<p align="center">One place to manage your boarding house.</p>

Rentora is a boarding house management system for the Philippines. It helps owners organize rooms and beds, manage boarders, track rent and other charges, verify payments, and handle everyday concerns. Boarders use a mobile-friendly app to check their bills, submit payment proofs, report repairs, and read house announcements.

## Who uses Rentora?

| Owners and administrators | Boarders |
| --- | --- |
| Desktop dashboard with occupancy, balances, collections and pending work | Home screen with balance, room details and recent updates |
| Room, bed and boarder management; invitations and assignment history | Own bills, payment history and printable receipts |
| Monthly rent invoices and separate water, electricity, damage or other charges | Payment-proof submission for GCash, Maya and bank transfers |
| Cash payment recording, proof review and receipt generation | Maintenance requests with photos and status updates |
| Collection/occupancy reports, CSV exports and activity logs | Announcements with unread badges and reminders |
| Property settings, house announcements and maintenance tracking | Installable progressive web app (PWA) |

## Built for boarding houses

- Philippine peso amounts, with exact integer-centavo calculations.
- Philippine calendar dates using `Asia/Manila`; the header shows the property's saved location.
- Responsive layouts for desktop, tablet and phone, with a collapsible admin sidebar.
- Private payment proofs and repair photos, accessed through short-lived signed links.
- Separate owner/admin and boarder access, enforced by server authorization and database row-level security.
- An animated house-logo startup screen for longer loads and content skeletons during page navigation.

Receipts acknowledge payments; they are not BIR official receipts. The PWA's offline page contains no account data, and signed-in pages are not cached for offline use.

## Technology

Next.js 16 App Router · React · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase PostgreSQL, Auth and Storage · Playwright · Vitest/PGlite.

## Run locally

Requirements: Node.js 20.9 or newer, npm, and a Supabase development project.

```sh
npm ci
cp .env.example .env.local
```

Fill in `.env.local` with the Supabase project URL, publishable key, server-only secret key and local site URL. Keep this file private. Use separate Supabase projects and keys for development and production.

Apply the database migrations to your development project. The Supabase CLI must be signed in and have the target project's database credentials available:

```sh
npx supabase login
npx supabase link --project-ref <development-project-ref>
npx supabase db push --linked
```

Create the first owner through the controlled provisioning script. This sends an invitation so the owner can choose a password:

```sh
npm run provision:admin -- --email owner@example.com --name "Owner Name" --org "Boarding House Name" --property "Main house" --address "Street, City" --confirm
```

For an already configured project, use its provisioned account. Login credentials are not stored in this README.

```sh
npm run dev
```

Open `http://localhost:3000`. The development launcher also prints a `Rentora LAN` address for phones/tablets on the same Wi-Fi. Restart it after changing networks. In PowerShell, use `npm.cmd` / `npx.cmd` if execution policy blocks the `.ps1` launchers.

## Checks

```sh
npm run verify         # typecheck, lint, unit/database tests, security scan and build
npm run security:audit # production dependency audit
npm run test:e2e       # browser tests; build first
```

The database tests apply the real migrations in embedded PostgreSQL and exercise authorization and organization isolation. Live browser scenarios require a separate seeded development project; see [Progress](docs/progress.md) for the setup and verification limits. The optional `seed:demo` command is for a disposable development database only.

## Deployment

The deployment target is **Vercel + Supabase Cloud**. Follow the [deployment guide and readiness checklist](docs/deployment.md) for environment variables, migrations, HTTPS URLs, SMTP, private storage, backups and owner provisioning.

Provision accounts separately in the target environment. Configure a real email sender and verify invitation/recovery links before onboarding boarders. Production must use real data and private credentials; never run the demo seeder there.

## Project structure

```text
src/app/                 App routes, layouts and loading states
src/components/          Shared admin, boarder and UI components
src/features/            Feature queries, validation, actions and screens
src/lib/                 Authorization, Supabase, money, dates and security
supabase/migrations/     Database schema, RPCs, RLS and storage policies
tests/db/                PostgreSQL authorization and business-rule tests
tests/e2e/               Playwright browser tests
docs/                    Architecture, security, deployment and progress
```

## Documentation

- [Architecture](docs/architecture.md)
- [Database](docs/database.md)
- [Security](docs/security.md)
- [Deployment and backup/recovery](docs/deployment.md)
- [Current progress and remaining checks](docs/progress.md)
