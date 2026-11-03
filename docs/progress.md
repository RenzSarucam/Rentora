# Progress

Status as of 2026-10-31.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Next.js 16.4 + TS strict + Tailwind v4 + shadcn/ui (radix); skills reviewed; architecture; design direction "framed sheet" (IBM Plex, navy / warm white / teal) | Done |
| 2 | Supabase schema (17 tables), functions/RPCs, RLS, private storage; auth (sign-in, invite/recovery confirm, set password, sign-out); env validation; nonce CSP proxy | Done |
| 3 | Admin shell, dashboard (real figures, collections chart, bed map), rooms & beds | Done |
| 4 | Boarder invitations (resend, orphan cleanup), profiles, notes, archive/restore; assignments (assign, transfer, move-out, rent change, history) | Done |
| 5 | Monthly invoice generation (idempotent), fees/discounts, deposits/one-off charges, void; payment proofs review with signed URLs, approve/reject, cash payments, void payments; printable receipts | Done |
| 6 | Boarder PWA: home, my room, bills, proof submission with client downscale, payment history, repairs with photo, announcements, profile; manifest, icons, safe service worker, offline page | Done |
| 7 | Admin maintenance, announcements, reports (occupancy, collections, outstanding, overdue aging, payments) + CSV exports (formula-injection safe), settings, audit log view | Done |
| 8 | Loading skeletons, empty states, keyboard focus, touch targets, responsive shells | Done for what can be seen without a backend (see below) |
| 9 | Verification | Done (results below) |
| 10 | Deployment guide, production + security checklists, backup/recovery | Done (`docs/deployment.md`) — not deployed |

## Verification results (2026-10-31)

| Check | Result |
| --- | --- |
| `tsc --noEmit` (strict) | 0 errors |
| `eslint .` | 0 errors, 0 warnings |
| Vitest unit + database (PGlite, real migrations) | 14 files, 151 tests passed |
| `npm run security:scan` (after build) | passed: no committed secrets, no secrets or source maps in client bundle, no XSS sinks / console.log, all SECURITY DEFINER functions pin search_path, RLS on all tables |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `next build` | success (all app routes rendered per request) |
| Playwright (production build, desktop 1440 + Pixel 7, Edge) | 58 passed, 10 skipped (seeded-backend flows) |

## Not yet verified / blocked

- **No live Supabase project was connected** (no Docker for a local stack; no credentials). Therefore not exercised end-to-end: real sign-in, invitation emails, password recovery emails, storage uploads and signed URLs, and PostgREST nested selects used by the screens. SQL, RLS, RPCs and storage policies are tested in PGlite with a Supabase-compatible shim.
- `tests/e2e/flows.spec.ts` (admin login, boarder isolation in the UI, boarder bottom navigation, cross-role redirects) is written but skipped until run with `E2E_SUPABASE=1` against a seeded dev project.
- Signed-in screens have not been visually reviewed in a browser; only sign-in, password reset and offline pages were screenshotted.
- PWA installability and service worker behaviour on real devices.
- Rate limits are not load-tested.

## Supabase dev project (2026-11-03)

- Dev project created (region: Ireland / eu-west-1 — fine for dev; use Singapore for production) and linked with the CLI.
- `.env.local` filled (gitignored): URL, publishable key, secret key, plus `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` for the CLI.
- `supabase db push --linked` applied migrations 0001, 0002, 0003, 0004, 0030 with no errors.
- Live check as an anonymous caller: organizations, profiles, invoices, payments, audit_logs → 401 permission denied; staff and server-only RPCs not reachable; storage bucket list empty (private).

## Next steps (pick up here)

1. **Seed demo data** — the owner runs it in their own terminal (an agent's safety check blocked the override flag):
   `npm run seed:demo -- --dev --i-understand-this-is-not-production`
   Demo logins use password `DemoPass2026`: `owner@demo.rentora.test`, `ana.reyes@demo.rentora.test`, `paolo.cruz@demo.rentora.test` (see `scripts/seed-demo.ts`).
2. **Confirm Auth settings** in the dashboard: sign-ups off, confirm email on, Site URL `http://localhost:3000`, redirect URL `http://localhost:3000/auth/confirm`.
3. `npm run dev`, sign in as the owner and a boarder; walk through every admin and boarder screen on desktop and a phone. Watch for PostgREST embed errors in nested selects (not covered by PGlite tests).
4. `npm run build` then `E2E_SUPABASE=1 npm run test:e2e` to run the 10 seeded-flow tests.
5. Choose an SMTP provider for invitation/reset emails (owner decision, may cost money).
6. Later: production Supabase project in Singapore, Vercel deploy (needs owner approval), provision the first landlord.
7. Optional: revoke `SUPABASE_ACCESS_TOKEN` in the Supabase dashboard once CLI work is done.
