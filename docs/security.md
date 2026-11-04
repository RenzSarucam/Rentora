# Security

This document lists each control, where it lives, and **how it is verified**. A control without a verification line is not claimed.

## Threat model (MVP)

Assets: tenants' financial records, boarders' personal data (names, phones, emergency contacts), payment proof images, landlord accounts.
Actors: anonymous internet users; a boarder trying to see/alter others' data or their own balance; a landlord of organization A probing organization B; a stolen session; a malicious upload.

## Controls

| Area | Control | Where | Verified by |
| --- | --- | --- | --- |
| Authentication | Supabase Auth email+password; public sign-up disabled; email confirmation required; min 10 chars with mixed case + digit; secure password change; refresh-token rotation | `supabase/config.toml` (mirror in dashboard for hosted projects, see deployment.md) | Config review; `lib.test.ts` password policy |
| Verified email | Invite and recovery links are single-use token hashes verified server-side (`verifyOtp`) at `/auth/confirm`; only allow-listed OTP types | `src/app/auth/confirm/route.ts` | E2E "invalid email link" |
| Account enumeration | Same message for unknown email / wrong password; reset always answers the same | `features/auth/actions.ts` | E2E "password reset never reveals…" |
| Controlled provisioning | Owners only via `npm run provision:admin` (service role, explicit `--confirm`); boarders only by staff invitation | `scripts/provision-admin.ts`, `register_boarder_invitation` | `rls.test.ts` "server-only RPCs are not callable" |
| Sessions | `@supabase/ssr` HTTP-only cookies refreshed in proxy; identity from `getUser()` (server-verified), never from the cookie alone | `src/proxy.ts`, `lib/auth/session.ts` | Code review |
| RBAC | `requireStaff` / `requireBoarder` in layouts and in every action; role checked server-side, never by screen size | `lib/auth/session.ts`, `app/*/layout.tsx` | E2E protected routes; flows.spec (seeded) |
| Resource authorization + org isolation | RLS on all 17 tables; staff RPCs `assert_staff(org)`; composite FKs block cross-org references | migrations 03 | `rls.test.ts` (anon denied, org A vs B, update/insert into other org) |
| Boarder isolation | Boarders read only own member-linked rows; rooms/beds only those they occupy(d); no roommate data | migrations 03 | `rls.test.ts` "boarder isolation" |
| Financial integrity | RPC-only writes, row locks, append-only payments/allocations, derived totals, duplicate guards | migrations 02 | `billing.test.ts` (idempotent invoices, partial payments, overpay, duplicate approve/reference, void) |
| CSRF | Server Actions: Next.js Origin/Host check. Route handlers that change state (`/auth/signout`): explicit `isSameOrigin`. SameSite cookies | `lib/security/origin.ts` | `lib.test.ts`, E2E "sign-out rejects cross-site POSTs" |
| XSS | React escaping; no `dangerouslySetInnerHTML` (scan-enforced); user text rendered as text with `whitespace-pre-line`; nonce CSP with `strict-dynamic` | `src/proxy.ts`, `lib/security/csp.ts` | security scan; E2E headers test |
| Security headers | CSP, HSTS, X-Frame-Options DENY, frame-ancestors none, nosniff, Referrer-Policy, Permissions-Policy, COOP, no `X-Powered-By` | `next.config.ts`, proxy | E2E "pages carry a nonce CSP…" |
| CORS | No custom CORS: app endpoints are same-origin only; Supabase API protected by RLS + keys | — | Code review |
| Input validation | zod on every action input (client + server); DB `check` constraints as the last line | `lib/validation.ts`, `features/*/schemas.ts` | unit tests; db constraint tests |
| SQL injection | No string-built SQL in the app: PostgREST/RPC parameters only; SQL functions use parameters and pinned `search_path` | — | security scan (search_path rule); code review |
| Rate limiting | Login (per IP+email and per IP), password reset, invitations, payment submissions, maintenance requests; Postgres-backed, hashed keys | `lib/rate-limit.ts` | DB function covered indirectly; **not load-tested** |
| File uploads | Magic-byte type detection (JPG/PNG/WEBP/PDF), 4 MB cap, random names, member-folder paths; private buckets with type/size limits; storage RLS by folder; no update/delete for users; signed URLs (60 s) | `lib/uploads.ts`, migration 04 | `lib.test.ts` upload tests; `maintenance-storage.test.ts` storage policies |
| Secrets | Service key only in `env.server.ts` (`server-only`); env validated with zod; scan for committed secrets and for secrets in `.next/static` | `lib/env*.ts`, `scripts/security-scan.mjs` | `npm run security:scan` after build |
| Caching | Signed-in responses `Cache-Control: private, no-store`; service worker never caches HTML/RSC/API/Supabase | proxy, `public/sw.js` | Code review; E2E sw headers |
| Logging | No `console.log` in app code (scan-enforced); errors logged as codes; DB errors mapped to safe text | `lib/errors.ts` | security scan; `lib.test.ts` error mapping |
| Production diagnostics | No source maps shipped; generic error page; Next dev overlay absent in production | `next.config.ts`, `app/error.tsx` | security scan (.map check after build) |
| Audit | Semantic audit entries from RPCs + row-change triggers (column names only, no values); ordinary mutations blocked; owner-confirmed boarder erasure removes associated history and records deletion | migrations 02 and boarder deletion migration | `rls.test.ts`, `boarder-deletion.test.ts` |
| Permanent boarder deletion | Active owner only; typed current email and acknowledgement; exact row IDs authorized only inside the deletion transaction; cross-account links rejected; private RLS jobs resume scoped Storage cleanup and Auth deletion | boarder deletion migration, `features/boarders/deletion-actions.ts` | 23 database deletion tests, 6 orphan-cleanup tests; isolated dialog checks at 1440/393/320 px |
| Dependencies | `npm run security:audit` (prod deps, high+) | package.json | Run in CI / before release |

## Verification commands

```
npm run test           # unit + database security/business tests
npm run security:scan  # static checks (run after build for bundle checks)
npm run security:audit # dependency advisories
npm run test:e2e       # route protection, headers, CSRF, PWA (and seeded flows with E2E_SUPABASE=1)
```

## Residual risks / not yet verified

- RLS behaviour is tested on PGlite with a Supabase-compatible shim (roles, `auth.uid()`, storage tables). Run `tests/db` semantics once more against a real Supabase dev project before go-live (see deployment checklist).
- Rate limits are functional but not load-tested; Supabase Auth's own limits must also be configured in the dashboard.
- Email deliverability depends on custom SMTP (Supabase's built-in sender is rate-limited and for testing only).
- No MFA for landlord accounts yet (recommended next step: Supabase TOTP MFA for owners).
- No antivirus scanning of uploads (files are never executed or served inline from our origin; signed URLs come from the Supabase storage domain).
