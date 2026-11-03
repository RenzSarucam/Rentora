<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Rentora — engineering instructions

Boarding house management for the Philippines. Admin web app (desktop-first) + boarder PWA (mobile-first).
Next.js 16 App Router · TypeScript strict · Tailwind v4 · shadcn/ui (radix) · Supabase (Postgres, Auth, Storage, RLS) · Vercel.

Start of a session: read `docs/progress.md` for current status and open items.

## Ground rules

- **The database is the security boundary.** Every table has RLS. Financial writes (invoices, items, payments, allocations, submissions) happen only through `SECURITY DEFINER` RPCs in `supabase/migrations/*_functions.sql`; `authenticated` has no direct write grant on them. Never add a broad grant or a permissive policy to "make something work".
- **Server-side authorization on every entry point.** Pages: `requireStaff()` / `requireBoarder()` (in layouts and again in actions). Actions: call the guard first, then `safeParse`, then query with the user client (`@/lib/supabase/server`) so RLS applies. Never trust ids from the client without RLS or an RPC check behind them.
- **Service role (`@/lib/supabase/admin`) only for:** sending invitations, server-only RPCs (`register_boarder_invitation`, `provision_organization`, `rate_limit_hit`), and orphan-upload cleanup — always after the caller is authorized. Never import it from a client component.
- **Money is integer centavos** end to end. Convert only at the edges with `parsePesoToCentavos` / `formatPeso`. Forms send raw strings; actions parse exactly once (`useActionForm` sends `getValues()`, not resolver output).
- **Dates are Manila calendar dates** (`manilaToday()`, `private.manila_today()`), stored as `date`.
- **Uploads:** `checkUpload()` (magic-byte sniffing, 4 MB cap) → private bucket path `<org>/<member>/<uuid>.<ext>` → signed URLs (60 s) to view. No public buckets.
- **No secrets in logs, the client, or chat.** `console.error` with error codes only. Keys live only in `.env.local` (gitignored) and Vercel env. `npm run security:scan` enforces this.
- Errors shown to users go through `dbErrorMessage()`; never render raw database errors.
- Every page is rendered per request (`connection()` in the root layout) so the CSP nonce from `src/proxy.ts` applies. Don't add static pages that need JavaScript.

## Layout

```
src/app/(auth)          sign-in, password reset, set password
src/app/admin/*         admin screens (layout = requireStaff)
src/app/boarder/*       boarder PWA (layout = requireBoarder)
src/app/receipts/[id]   printable receipt, staff or owning boarder
src/features/<area>/    queries.ts (server-only reads) · schemas.ts (zod) · actions.ts ("use server") · UI
src/components/app/     shared app components (DataTable, PageHeader, StatusPill, Field, ActionButton…)
src/lib/                env, supabase clients, session DAL, money/dates, errors, uploads, rate limit, security
supabase/migrations/    schema, functions, RLS, storage — the source of truth
tests/db/               real-Postgres (PGlite) tests of migrations, RLS and RPCs
tests/e2e/              Playwright
docs/                   architecture, database, security, deployment, progress
```

## Commands

```
npm run dev            # local dev (needs .env.local)
npm run verify         # typecheck + lint + unit/db tests + security scan + build
npm run test:db        # migrations + RLS + business rules in embedded Postgres
npm run test:e2e       # Playwright (run `npm run build` first)
npm run security:scan  # secrets, client-bundle leaks, XSS sinks, RLS coverage
```

Supabase CLI commands against the linked dev project need the env loaded, e.g. in bash:
`set -a && . ./.env.local && set +a && npx supabase db push --linked`.
`.env.local` holds `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` for the CLI.

## Changing the database

1. Add a new migration file (never edit an applied one — migrations 0001–0004 and 0030 are applied to the dev project).
2. Add/extend tests in `tests/db/` — every new table needs RLS + isolation tests; every new RPC needs an authorization test.
3. `npm run test:db`, then `supabase db push --linked --dry-run` before the real push.
4. Destructive changes (drops, type changes, data rewrites), production pushes and deployments need explicit human approval.

## Design system ("framed sheet")

Warm-white frame (`bg-ground`) holds navigation; work sits on white sheets with 1px `border-border`, no resting shadows.
Deep navy ink and one navy primary action per screen. Teal (`text-teal`/`bg-teal`) only on data and the selected state.
IBM Plex Sans; Plex Mono only for invoice/receipt numbers. Numbers right-aligned with `num` (tabular figures).
No gradients, glows, glass, icon-in-tinted-square, emoji, or placeholder data. Empty states keep their frame and say one sentence.
Status vocabulary lives in `src/components/app/status-pill.tsx`.

## Tooling notes

`.claude/` contains Claude Code skills; other agents can ignore it. Skills are guidance only and never override these rules.
