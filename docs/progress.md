# Progress

Status as of 2026-11-03.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Next.js 16.4 + TS strict + Tailwind v4 + shadcn/ui (radix); skills reviewed; architecture; design direction "framed sheet" (IBM Plex, navy / warm white / teal) | Done |
| 2 | Supabase schema (17 tables), functions/RPCs, RLS, private storage; auth (sign-in, invite/recovery confirm, set password, sign-out); env validation; nonce CSP proxy | Done |
| 3 | Admin shell, dashboard (real figures, collections chart, bed map), rooms & beds | Done |
| 4 | Boarder invitations (resend, orphan cleanup), profiles, notes, archive/restore; assignments (assign, transfer, move-out, rent change, history) | Done |
| 5 | Monthly invoice generation (idempotent), fees/discounts, deposits/one-off charges, void; payment proofs review with signed URLs, approve/reject, cash payments, void payments; printable receipts | Done |
| 6 | Boarder PWA: home, my room, bills, proof submission with client downscale, payment history, repairs with photo, announcements, profile; manifest, icons, safe service worker, offline page | Done |
| 7 | Admin maintenance, announcements, reports (occupancy, collections, outstanding, overdue aging, payments) + CSV exports (formula-injection safe), settings, audit log view | Done |
| 8 | Loading skeletons, empty states, keyboard focus, touch targets, responsive shells | Signed-in desktop + phone viewport walkthrough passed; selected screens visually reviewed (see below) |
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

## Live verification results (2026-11-03)

| Check | Result |
| --- | --- |
| `npm run verify` | passed: typecheck, lint, 151 unit/database tests, security scan, production build |
| Playwright against seeded dev Supabase, desktop 1440 + Pixel 7 viewport, Edge | 67 passed, 1 skipped (desktop execution of the phone-only navigation test) |
| Signed-in admin walkthrough | Dashboard, rooms, boarders, assignments, billing, payments, maintenance, announcements, reports, settings and activity log loaded; room, boarder, invoice, receipt and maintenance details opened |
| Signed-in boarder walkthrough | Home, my room, bills and details, payment history and own receipt, repairs and new-request form, announcements and profile loaded; phone navigation and seeded repair detail passed |
| Live authorization / RLS | Ana and Paolo's unfiltered invoice/payment API reads returned only their own rows; another boarder's known invoice and receipt URLs showed not-found; cross-role redirects passed |
| Reports | All five authenticated CSV exports returned CSV successfully |
| Visual review | Admin dashboard, billing and reports at desktop size; boarder home, my room and bills at phone size. Screenshots saved locally in gitignored `test-results/review/` |

The live flow tests now load `.env.local` / `.env` only when `E2E_SUPABASE=1`, fail early if required configuration is missing, wait for sign-in to finish, and use exact link names where partial names match multiple links. They also check positive seeded content so a sign-in page or empty response cannot pass an isolation assertion. Screen captures are saved in each test's output directory and attached to its result.

The hosted test run used a separately started production server with `E2E_BASE_URL=http://localhost:3100` because Windows stalled while shutting down Playwright's managed server. Windows also locked the sandbox execution account; the successful verification and browser run used approved execution outside that sandbox. Vitest reported fork shutdown warnings, but all 151 tests and the complete verification command exited successfully.

## Not yet verified / blocked

- Invitation and password recovery **email delivery**, confirmation links and first-password setup against a real inbox; SMTP provider still needs the owner's decision.
- Live payment-proof / maintenance-photo uploads, signed URLs and their expiry, and approval/rejection workflows through the browser. The walkthrough exercised reads and navigation; SQL/RPC/storage policies remain covered by PGlite tests.
- Live cross-organization isolation with a second seeded organization (covered by database tests, not yet exercised in the hosted project).
- PWA installability and service worker behaviour on physical devices; Pixel 7 browser emulation is not a real-device check.
- Rate limits are not load-tested. Repeated UI test runs share the real login limits (8 attempts per email/IP in 15 minutes).
- Repeated live runs temporarily locked the demo owner out during the owner's manual walkthrough. Correct passwords and successful test logins also count toward this fixed window; keep manual walkthroughs separate from repeated live test runs and allow the window to expire before handing access back. Do not disable the limiter or clear the rate-limit table to work around tests.

## Supabase dev project (2026-11-03)

- Dev project created (region: Ireland / eu-west-1 — fine for dev; use Singapore for production) and linked with the CLI.
- `.env.local` filled (gitignored): URL, publishable key, secret key, plus `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` for the CLI.
- `supabase db push --linked` applied migrations 0001, 0002, 0003, 0004, 0030 with no errors.
- Live check as an anonymous caller: organizations, profiles, invoices, payments, audit_logs → 401 permission denied; staff and server-only RPCs not reachable; storage bucket list empty (private).
- Demo data already exists and was confirmed through signed-in reads: 4 rooms, 11 beds, 5 assigned boarders, 10 September/October invoices and recorded payments. No reseed was needed in this session.
- Auth settings read back from the dev project's Management API: public sign-ups disabled, confirm email enabled, Site URL `http://localhost:3000`, redirect allowlist includes `http://localhost:3000/auth/confirm`. Sign-ups and the redirect allowlist were corrected in this session.
- At the owner's request, renamed the three existing demo logins to `admin@demo.rentora` (Maria, owner), `boarder1@demo.rentora` (Ana) and `boarder2@demo.rentora` (Paolo). Auth email identities and profile emails were synchronized in one guarded dev-only transaction; passwords, account IDs, roles and business records were preserved. Updated the seed and live test references. One browser sign-in per account passed with `DemoPass2026`; typecheck, lint and security scan passed.

## Local LAN development

- `npm run dev` (PowerShell: `npm.cmd run dev`) now detects a private IPv4 address on the computer's physical network adapters, binds to `0.0.0.0`, and prints `Rentora LAN: http://<ip>:3000`. Open that link from devices on the same Wi-Fi. Restart the command after changing networks so it picks up the new IP.
- The launcher overrides `NEXT_PUBLIC_SITE_URL` for the dev process without rewriting `.env.local`. It allows the detected hostname in Next's dev-origin checks. For multiple adapters, set `RENTORA_DEV_HOST` to a private IPv4 address; `localhost` is also supported. `--port` / `-p` and `PORT` set the port.
- When `SUPABASE_ACCESS_TOKEN` is available, the launcher verifies the hosted project is named `rentora-dev`, updates its Auth Site URL and adds the exact current `/auth/confirm` callback while preserving existing redirect URLs. Other projects are not modified. Without management access, it prints the callback to add manually before testing email links.
- Current LAN URL on 2026-11-03: `http://172.20.10.4:3000`. Supabase readback confirmed this Site URL and callback, with public sign-ups still disabled and email confirmation enabled.
- Auth sign-out and confirmation responses now use relative redirects so the browser stays on its LAN hostname instead of being redirected to the dev server's internal `0.0.0.0` address. A phone-sized browser on the computer passed LAN sign-in, sign-out and invalid-email-link checks; a physical phone is still pending.
- Disabled Next's default dev Server Function argument logging because sign-in arguments include passwords.
- Validation after the LAN/redirect changes: `npm run verify` passed (151 unit/database tests, typecheck, lint, security scan and production build); all 12 request-security Playwright checks passed on desktop and phone viewports against the production build.

## Next steps (pick up here)

1. **Choose an SMTP provider** for invitation/reset emails (owner decision, may cost money), then configure sender/domain and the templates in `supabase/templates/`. Test an invitation, first-password setup and password recovery with an inbox the owner controls.
2. Exercise live uploads and payment-proof review on the dev project: submit as a boarder, open as staff, verify private access and signed URL expiry, then approve/reject and inspect the resulting bill/receipt. Also test a maintenance photo.
3. Test PWA installation/offline behaviour on a physical phone and complete the visual review of the remaining screens and dialogs.
4. For future verification, build first, then run the live suite. In PowerShell: `npm.cmd run build`, then `$env:E2E_SUPABASE='1'; npm.cmd run test:e2e -- --workers=2`. If managing the production server separately, start `node node_modules/next/dist/bin/next start -p 3100` and set `$env:E2E_BASE_URL='http://localhost:3100'` for the test command.
5. Later: production Supabase project in Singapore, Vercel deploy (needs owner approval), provision the first landlord.
6. Optional: revoke `SUPABASE_ACCESS_TOKEN` in the Supabase dashboard once CLI work is done.

Existing demo logins use password `DemoPass2026`: `admin@demo.rentora`, `boarder1@demo.rentora`, `boarder2@demo.rentora` (see `scripts/seed-demo.ts`). The project is already seeded; the script is not a reset or resumable seed.
