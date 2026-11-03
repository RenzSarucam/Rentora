# Database

Source of truth: `supabase/migrations/`. Tests: `tests/db/` (run `npm run test:db`).

| Migration | Contents |
| --- | --- |
| `…01_core_schema.sql` | enums, tables, constraints, indexes |
| `…02_functions.sql` | helpers, integrity triggers, transactional RPCs |
| `…03_rls.sql` | ownership helpers, grants, RLS policies, maintenance status RPC |
| `…04_storage.sql` | private buckets and storage policies |

## Entities

```
organizations ─┬─ organization_members (role owner|admin|boarder, status invited|active|archived) ── profiles (1:1 auth.users)
               ├─ invitations
               ├─ properties ── rooms ── beds ── boarder_assignments (member ↔ bed, move-in/out, rent snapshot)
               ├─ invoices (rent|deposit|other) ── invoice_items (rent|fee|discount|deposit|other)
               ├─ payment_submissions (boarder proof, pending|approved|rejected)
               ├─ payments ── payment_allocations ── invoices
               ├─ maintenance_requests ── maintenance_updates
               ├─ announcements
               └─ audit_logs
private.rate_limits
```

Every tenant row has `organization_id`. Composite foreign keys (`(organization_id, room_id)`, `(organization_id, bed_id)`…) make cross-tenant references impossible at the schema level.

## Integrity rules enforced in the database

| Rule | Mechanism |
| --- | --- |
| A bed has at most one current boarder; a boarder at most one current bed | partial unique indexes on `boarder_assignments` where `move_out_date is null` |
| Beds never exceed room capacity | `beds_capacity` trigger locks the room row and counts; `rooms_update` blocks lowering capacity below active beds |
| No assigning archived/maintenance beds or archived boarders | `assignments_check` trigger |
| Can't archive occupied beds/rooms or boarders with a bed | triggers + `set_boarder_archived` |
| One rent invoice per assignment per month | partial unique index `invoices_one_rent_per_period`; generation is idempotent and serialized per organization |
| Invoice totals = sum of items; amount paid = sum of live allocations; status derived | `recompute_invoice` trigger |
| Discounts can't exceed charges; payments can't exceed balance | checks in `recompute_invoice` and `post_payment` |
| A payment's allocations never exceed the payment | `allocations_recompute` trigger |
| A submission is posted at most once | row lock + status check in `approve_payment_submission`, unique `payments.submission_id` |
| A transaction reference is live once per org | partial unique index `submissions_reference_unique` (rejected ones free it) |
| Payments, allocations and audit logs are append-only | `block_mutation` / `guard_payment_update` triggers (void is a one-way flag) |
| Historical amounts preserved | rent copied into the assignment and invoice item at creation; rate changes don't touch issued invoices |
| Sequential numbering | `INV-YYYY-000001`, `OR-YYYY-000001` from per-org counters updated under row lock |

## RPCs

Staff (`assert_staff`): `create_room`, `assign_bed`, `end_assignment`, `transfer_bed`, `set_boarder_archived`, `generate_monthly_invoices`, `create_invoice`, `add_invoice_item`, `remove_invoice_item`, `void_invoice`, `record_payment`, `approve_payment_submission`, `reject_payment_submission`, `void_payment`, `update_maintenance_status`.
Boarder (ownership checked): `submit_payment`, `accept_invitation`.
Service role only: `register_boarder_invitation`, `provision_organization`, `rate_limit_hit`.

All are `SECURITY DEFINER` with `search_path = ''` and fully-qualified names; `execute` is revoked from `public`/`anon` and granted explicitly.

## Row level security summary

| Table | Staff of org | Boarder | Anonymous |
| --- | --- | --- | --- |
| organizations | read, update name/due day | read own org | none |
| profiles | read/update members' permitted fields | own row, permitted fields | none |
| organization_members | read all, update notes | own row | none |
| rooms / beds | full (no direct room insert: RPC) | only rooms/beds they occupy(d) | none |
| boarder_assignments | read, update rent | own | none |
| invoices / items / allocations / payments / submissions | read (writes via RPC) | own only | none |
| maintenance_requests / updates | read, comment | own; create; comment while open | none |
| announcements | full | published, in own org | none |
| audit_logs | read | none | none |
| storage objects | read org folder | upload/read own folder | none |

## Generating TypeScript types

After linking a project: `npm run db:types` writes `src/lib/supabase/database.types.ts`. Queries currently declare their row shapes explicitly (`.returns<T>()`).
