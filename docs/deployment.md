# Deployment (Vercel + Supabase Cloud)

> Nothing in this repo deploys automatically. Each step below that creates paid resources or touches production needs the owner's go-ahead.

## Environments

| | Development | Production |
| --- | --- | --- |
| Supabase project | `rentora-dev` (free tier is fine) | `rentora-prod` (Pro recommended: daily backups + PITR add-on) |
| Vercel | Preview deployments | Production deployment on your domain |
| Data | Seed/demo data allowed | Real data only; never run `seed:demo` |

Keep keys separate per environment. Never point a preview deployment at the production database.

## 1. Supabase project setup (each environment)

1. Create the project in region **Southeast Asia (Singapore)** for latency from the Philippines.
2. Link and push migrations from your machine:
   ```
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push        # applies supabase/migrations in order
   ```
3. **Auth → Providers → Email**: enable; **disable "Allow new users to sign up"**; enable "Confirm email"; enable "Secure password change".
4. **Auth → Policies / Passwords**: minimum length 10; require lowercase, uppercase and digits; enable leaked-password protection (Pro).
5. **Auth → URL configuration**: Site URL `https://<your-domain>`; Redirect URLs: `https://<your-domain>/auth/confirm` (dev: `http://localhost:3000/auth/confirm`).
6. **Auth → Email templates**: paste `supabase/templates/invite.html`, `recovery.html`, `confirmation.html`, `email_change.html` (they link to `/auth/confirm?token_hash=…`).
7. **Auth → SMTP**: configure a custom SMTP sender (e.g. Resend, Postmark, Amazon SES). The built-in sender is limited to a few emails per hour. *(May incur cost — owner decision.)*
8. **Auth → Rate limits**: keep defaults or tighten sign-in/verification limits.
9. **Storage**: confirm buckets `payment-proofs` and `maintenance-photos` exist and are **private** (created by migration 04).
10. **API keys**: copy the publishable key and a secret key (Project Settings → API keys).

## 2. Vercel setup

1. Import the Git repository; framework preset Next.js; Node 24.
2. Environment variables (Production and Preview separately):
   | Name | Value | Exposure |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | project URL | public |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key | public |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>` | public |
   | `SUPABASE_SECRET_KEY` | secret key | **server only, mark Sensitive** |
3. Region: `sin1` (Singapore) to sit next to the database.
4. Add the custom domain; HTTPS is automatic (HSTS header is already sent).
5. Deploy a **preview** first and run the checks below against it.

## 3. First landlord

```
# with .env.local pointing at the target project
npm run provision:admin -- --email owner@example.ph --name "Owner Name" \
  --org "Boarding House Name" --property "Main house" --address "Street, City" --confirm
```
The owner receives an invitation email, sets a password, and lands on `/admin/dashboard`.

## Production readiness checklist

- [ ] `npm run verify` passes on the release commit (typecheck, lint, unit + DB tests, security scan, build)
- [ ] `npm run security:audit` has no high/critical advisories in production dependencies
- [ ] `npm run test:e2e` passes against the preview URL (`E2E_BASE_URL=https://preview… npx playwright test`)
- [ ] Seeded flows pass on the **dev** project (`E2E_SUPABASE=1`)
- [ ] RLS smoke test on the real dev project: sign in as a boarder and confirm `/rest/v1/invoices` returns only own rows; as owner of org A confirm org B rows are invisible
- [ ] Sign-up disabled, email confirmation on, redirect URLs exact, templates pasted, custom SMTP working (send a test invite)
- [ ] Buckets private; a stale signed URL stops working after 60 s
- [ ] `SUPABASE_SECRET_KEY` only in Vercel server env (marked Sensitive), not in any `NEXT_PUBLIC_*`
- [ ] `npm run security:scan` run after `npm run build` reports no client-bundle leaks
- [ ] Custom domain on HTTPS; response headers include CSP, HSTS, X-Frame-Options
- [ ] Backups enabled (see below) and one restore rehearsed on the dev project
- [ ] Owner account provisioned; owner has signed in and changed nothing unexpected
- [ ] Pilot terms communicated: receipts are acknowledgements, not BIR official receipts

## Security verification checklist (per release)

- [ ] New tables have RLS + tests for anon, cross-org, and boarder isolation
- [ ] New RPCs: `security definer`, `set search_path = ''`, explicit grant, authorization test
- [ ] New actions: guard first, zod parse, user client, no service role unless justified
- [ ] No new `dangerouslySetInnerHTML`, `console.log`, public buckets, or `NEXT_PUBLIC_` secrets
- [ ] Dependencies reviewed (`npm audit`, changelogs of auth/db packages)

## Backup and recovery

- **Supabase Pro**: daily backups retained 7 days; enable **Point-in-Time Recovery** for minute-level restores of financial data.
- **Independent logical backup** (recommended weekly, plus before every migration):
  ```
  npx supabase db dump --linked -f backups/schema-$(date +%F).sql
  npx supabase db dump --linked --data-only -f backups/data-$(date +%F).sql
  ```
  Store encrypted, outside the repo (backups contain personal data).
- **Storage**: payment proofs and photos are not included in database dumps; export the buckets periodically (Supabase CLI or S3-compatible tooling).
- **Restore rehearsal**: restore the latest dump into the dev project, run `npm run test:e2e` with `E2E_SUPABASE=1`, compare row counts and sum of `payments.amount_centavos` per organization with production.
- **Incident basics**: rotate the secret key in Supabase and Vercel if exposure is suspected; revoke sessions (Auth → Users → sign out); audit with `audit_logs`.

## Rollback

- App: promote the previous Vercel deployment.
- Database: migrations are forward-only. Prepare a compensating migration; for data damage use PITR or the latest dump on a fresh project, then repoint env vars. **Any destructive database operation requires explicit approval.**
