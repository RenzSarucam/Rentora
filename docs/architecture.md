# Architecture

## Overview

```
Browser (admin desktop / boarder PWA)
   │  HTML + RSC payloads, Server Action POSTs (same-origin, Origin-checked)
   ▼
Vercel — Next.js 16 (Node runtime)
   ├─ src/proxy.ts        per-request CSP nonce, session refresh, optimistic redirect to /login
   ├─ layouts             requireStaff() / requireBoarder()  ← authoritative role gate (getUser + membership)
   ├─ Server Components   reads via user-scoped Supabase client (RLS applies)
   ├─ Server Actions      guard → zod → RPC/table write as the user → revalidatePath
   └─ Route handlers      /auth/confirm (email links), /auth/signout (POST, Origin-checked), CSV exports (staff)
   ▼
Supabase
   ├─ Auth      email+password, invitations, recovery; public sign-up disabled
   ├─ Postgres  RLS on every table; financial writes only through SECURITY DEFINER RPCs
   └─ Storage   private buckets payment-proofs / maintenance-photos; RLS by folder; signed URLs
```

## Key decisions

| Decision | Why |
| --- | --- |
| **Supabase RLS as the primary boundary**, app checks as the second | A bug in one page cannot leak another tenant's data; tests run against the real policies. |
| **RPCs for every money movement** (`generate_monthly_invoices`, `record_payment`, `approve_payment_submission`, `void_*`) | Each runs in one transaction with row locks, so double posting, overpayment and partial writes are impossible. |
| **Derived invoice totals** (`recompute_invoice` trigger from items and live allocations) | Totals are never typed in, so they cannot drift from their parts. |
| **Integer centavos** (`bigint`) | No floating-point money. |
| **`cacheComponents: false`**, everything rendered per request | Every screen is private financial data; nothing is cached on the server or CDN (`Cache-Control: private, no-store` for signed-in responses). |
| **One organization per login (MVP)** | Unambiguous tenant resolution. Schema is multi-tenant; lifting this is a UI change plus dropping one unique index. |
| **Feature folders** (`src/features/<area>`) | Queries, schemas, actions and UI for one area live together. |
| **Shared zod schemas** | Client forms validate for speed; actions re-validate the raw input as the source of truth. |
| **Postgres-backed rate limiting** (`rate_limit_hit`) | Works across serverless instances without another service. Supabase Auth limits apply underneath. |
| **Printable HTML receipts** (`/receipts/[id]`) | "Save as PDF" from the browser; no PDF library or server rendering cost. |
| **PGlite for database tests** | Real Postgres in-process: migrations, RLS and RPCs are tested without Docker. |

## Request lifecycle (example: boarder submits a GCash proof)

1. `/boarder/bills/[id]` (server component) loads the invoice with the user client → RLS returns it only to its owner.
2. The client downsizes the photo, then posts `FormData` to a Server Action (Next checks Origin vs Host).
3. The action: `requireBoarder()` → rate limit → zod → `checkUpload()` (magic bytes, 4 MB) → upload to `payment-proofs/<org>/<member>/<uuid>.jpg` **as the user** (storage RLS checks the folder) → `rpc('submit_payment')`, which re-checks ownership, invoice state, the proof path prefix, the balance minus pending submissions, and the unique reference.
4. Admin opens `/admin/payments`; proof is shown through a 60-second signed URL. Approve → `approve_payment_submission` locks the submission row, refuses if not pending, posts one payment (unique `submission_id`), allocates to invoices (oldest first after the chosen one), recomputes invoice status, writes the audit log.

## Boarder PWA

`src/app/manifest.ts`, icons in `public/icons`, `public/sw.js`. The service worker caches only hashed static assets and the `/offline` page; navigations are network-only with an offline fallback. Authenticated HTML, RSC payloads, API calls and Supabase requests are never cached.

## Known limits (MVP)

- No live payment gateway: payments are recorded by staff or verified from boarder-submitted proof.
- No proration for mid-month move-ins (full-month rent invoice; adjust with a discount line).
- Staff accounts beyond the owner are provisioned by support (no in-app staff invitation yet).
- Receipts are acknowledgement receipts, not BIR official receipts.
