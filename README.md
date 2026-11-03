# Rentora

Boarding house management for Philippine landlords: rooms and beds, boarders, monthly billing in PHP, payment-proof verification, receipts, repairs and announcements. Desktop admin app + installable mobile app for boarders.

## Quick start (development)

```
npm install
cp .env.example .env.local          # fill in your *development* Supabase project
npx supabase link --project-ref <dev-ref> && npx supabase db push
npm run seed:demo -- --dev          # optional demo data (dev projects only)
npm run dev
```

Sign in at http://localhost:3000 (demo: `owner@demo.rentora.test` / `DemoPass2026`).

## Checks

```
npm run verify       # typecheck, lint, tests (unit + database), security scan, production build
npm run test:e2e     # Playwright against the production build
```

## Docs

- [Architecture](docs/architecture.md)
- [Database](docs/database.md)
- [Security](docs/security.md)
- [Deployment](docs/deployment.md)
- [Progress](docs/progress.md)
