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

- A real Gmail invitation reached the owner, but the default email link failed in the original callback. Default-link handling is now implemented (see below); completed password setup and acceptance from a real inbox still need a fresh link. SMTP provider still needs the owner's decision.
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

## Email link compatibility (2026-11-03)

- Confirmed the hosted project still uses default `ConfirmationURL` templates. They verify at Supabase and return a session in a URL fragment (invitation) or a PKCE code (SSR recovery). The original `/auth/confirm` only accepted `token_hash`, so a valid default invitation could confirm the email and still end at the invalid-link screen.
- Attempted to install the repository templates in `rentora-dev`, but Supabase returned HTTP 400: custom templates are unavailable on its free/default-email-provider setup until custom SMTP or an eligible plan is configured. No hosted templates were changed and no emails were sent by the agent.
- The callback now preserves default invitation fragments for `/auth/callback`, where the browser validates the session through Supabase and writes SSR cookies, then opens password setup. Credentials are removed from browser history before requests/navigation. The server continues to validate sessions and enforce membership/RLS. PKCE recovery codes are also handled server-side; custom token-hash templates remain supported.
- Fragment removal preserves Next's history state to avoid remounting the callback during session setup. Browser tests wait for the initial navigation to commit and for the sign-in page to render before starting another navigation, so immediate client redirects do not cancel the test's page load.
- Suppressed dev request logging for the token-bearing confirmation path. Removed the hardcoded 24-hour expiry promise from invite/reset messages and local templates because the hosted project's recovery OTP expiry is one hour.
- Read-only inspection found one pending boarder whose Auth email was already confirmed. For that previously consumed default invite, request a fresh link through **Forgot your password?** using the invited email, open it in the same browser that requested it, then choose a password. Password setup calls `accept_invitation`, activating the existing membership.
- Validation: `npm run verify` passed with 166 unit/database tests, lint, typecheck, security scan and build. The default-link browser tests passed on desktop and phone viewports using mocked Supabase responses (no real email/token consumption). The combined 68-test callback/protected-route run had 66 passes and two Edge setup/teardown timeouts; both failed checks passed when rerun with one worker. Real inbox completion remains pending.
- Final LAN regression run against `http://172.20.10.4:3000`: all 8 email-link checks passed on desktop and phone viewports with one worker. The temporary agent-owned dev server was stopped after testing so the owner can run `npm.cmd run dev` without a port conflict.

## Admin dashboard layout (2026-11-03)

- Moved Settings directly below Announcements in the shared desktop/mobile admin navigation. The account footer stays separate, and shorter sidebars can scroll their navigation.
- The desktop dashboard now fits the viewport, with its card grid taking the available space below the page header and figures. Activity, payment proofs, repairs and room lists scroll inside their cards; the chart adapts to its card height. Scroll regions are keyboard-focusable. Narrower desktop room maps use one column to keep bed cells readable.
- The phone dashboard keeps a vertical layout. Billing has its own invoice scroll layout (see below).
- Validation: the full verification command passed with 166 unit/database tests, typecheck, lint, security scan and build. Focused live browser checks confirmed no document overflow at 1440×900, 1366×768, 1280×720, 1024×768 and 1280×600, card scrolling by keyboard, Settings directly after Announcements, normal report scrolling, and phone menu navigation. Screenshots are in gitignored `test-results/dashboard-review/`.

## Billing scroll layout (2026-11-03)

- Desktop Billing now fits the viewport. The invoice list scrolls within the remaining space below the summary, status tabs and search/month filters. Column headings stay visible while invoice rows scroll; wide tables scroll horizontally to keep invoice numbers, names, periods and dates readable.
- Added an opt-in viewport layout to the shared DataTable and enabled it for invoices. Scroll regions are keyboard-focusable, and status tabs only scroll horizontally. Settings was confirmed immediately below Announcements on desktop and phone navigation.
- Validation: full verification passed with 166 unit/database tests, typecheck, lint, security scan and build. Focused signed-in browser checks covered 1440×900, 1366×768, 1280×720, 1024×768 and 1280×600; invoice scrolling, sticky headings, fixed controls, keyboard use, search empty state, status/month filters, sorting and invoice details all passed. Dashboard, reports and phone navigation checks also passed. Screenshots are in gitignored `test-results/billing-review/`.

## Fixed desktop admin frame (2026-11-03)

- The entire desktop admin shell is now fixed to the viewport across all admin routes. Sidebar and top bar stay in place; long pages scroll inside the right-hand main panel. Billing and Dashboard retain their own inner list/card scroll areas. Route changes reset the main panel to the top.
- Navigation groups keep their natural height in the sidebar's scroll region, with Settings immediately after Announcements and the account footer separate.
- Validation used the actual LAN URL `http://172.20.10.4:3000` and mouse-wheel input, including a 1516×686 viewport at 1.25 device scale to match the owner's screenshot. At that size, plus 1366×768, 1280×600 and 1024×768, the document remained one viewport tall, window scroll stayed zero, sidebar top stayed zero, and the Billing heading stayed fixed while invoice rows scrolled. Reports scrolled only in the right panel, navigation reset that panel, and phone menu order passed. Screenshots are in gitignored `test-results/admin-frame-review/`.
- `npm run verify` passed: 166 unit/database tests, typecheck, lint, security scan and production build. The owner's existing server on port 3000 was left running.

## Sidebar reference match (2026-11-03)

- Matched the owner's latest sidebar reference: Settings is a separate, unlabelled navigation group with a 24 px gap after Announcements. It follows that group naturally rather than being pinned with an automatic top margin.
- Tightened desktop footer spacing so the complete Settings row and account footer fit at the reference's laptop height. The fixed desktop frame and invoice-only scrolling remain in place.
- Verified on the actual LAN URL at 1516×686 and 1.25 device scale with Rooms & beds selected, plus invoice wheel scrolling and phone Settings navigation. Screenshot: gitignored `test-results/sidebar-reference.png`. `npm run verify` passed with 166 tests, typecheck, lint, security scan and build.

## Rentora boarding-house logo (2026-11-03)

- Replaced the old mark with an original navy house silhouette and an R-shaped doorway/window. Shared vector geometry lives in `src/lib/brand-artwork.ts`; the app wordmark keeps IBM Plex Sans and its existing layout dimensions.
- `npm run icons` now uses `scripts/generate-icons.ts` to export the transparent SVG master, SVG favicon, PNG app icons, Apple touch icon and maskable icon. The maskable artwork fits inside the central safe circle. Root metadata selects the SVG favicon; the service-worker cache version was rotated for the new assets.
- Validation: full verification passed with 166 unit/database tests, typecheck, lint, security scan and build; all four existing PWA desktop/phone browser checks passed. Live wordmark/favicon review and PNG dimensions were checked. Clean logo preview: gitignored `test-results/brand-review/rentora-logo-preview.png`.

## Account controls in the top bar (2026-11-03)

- Moved the staff name, email and Sign out from the sidebar footer to the right end of the desktop top bar, opposite the boarding-house name. Settings remains below Announcements. This supersedes the account-footer placement in the earlier sidebar notes.
- On phones, the top-right account button opens the same details and sign-out form. The navigation drawer contains navigation only. Sign out remains a real POST form to the existing origin-checked route.
- Validation: full verification passed with 166 tests, typecheck, lint, security scan and build. Live LAN browser checks covered desktop widths 1516, 1366 and 1024, and phone widths 393 and 320; account positioning, keyboard focus, the POST form, navigation and fixed desktop scrolling passed. Logout was not submitted to avoid revoking the owner's other demo sessions. Screenshots: gitignored `test-results/header-review/desktop.png` and `phone-account.png`. The owner's existing port-3000 server remains running.
- Separate visual-review follow-up: the existing Reports collections grid overflows horizontally at a 393 px phone width; the new header/account controls and Billing fit the phone viewport.

## Dashboard chart spacing (2026-11-03)

- Replaced the dashboard's shrinking row minimums with content-sized rows: the rent card is at least 380 px tall and grows with wrapped content; the lower row is at least 240 px. The card grid now scrolls inside the available desktop space, keeping the sidebar, top bar, dashboard heading and figures fixed. This supersedes the earlier dashboard behavior that compressed every card into the viewport.
- The collections chart keeps at least 220 px of height, with more space after the rent summary and around axis labels. Bars have a maximum width of 48 px. Phones keep normal vertical page flow.
- Validation: full verification passed with 166 unit/database tests, lint, typecheck, security scan and build. After the final content-sized-row adjustment, a fresh production build passed. Live LAN checks passed at 1516x686 (1.25 scale), 1366x768, 1280x600, 1024x768 and 1920x1080, plus phone widths 393 and 320. Checked chart height, desktop document bounds, keyboard/wheel scrolling, access to lower cards, fixed header/title, mobile account controls and Billing frame regression. Screenshots: gitignored `test-results/dashboard-spacing-review/`.

## Browser tab icon refresh (2026-11-03)

- The root icon metadata now uses a versioned SVG URL with `sizes="any"` so browsers request the house/R logo rather than reusing an older tab icon. Replaced the 192 px tab fallback with a matching ICO containing 16, 32 and 48 px frames, generated by `npm run icons` at `public/favicon.ico`.
- Validation: icon generation, typecheck, lint and production build passed. Fresh-tab browser checks confirmed both metadata links, successful SVG/ICO requests and the default `/favicon.ico` fallback; all three embedded PNG frames decoded at their expected sizes. Local previews: gitignored `test-results/favicon-review/`.

## Auth screen redesign (2026-11-03)

- Follow-up: centered the Sign in button label independently of the right-side arrow and left-side pending spinner. Focused lint passed; live localhost checks confirmed centered alignment at 1516, 393 and 320 px widths. The earlier LAN IP was unreachable during this check.
- Replaced the small floating sign-in card with a framed desktop layout: a warm-white introduction and original boarding-house SVG drawing beside the white form panel. The shared auth layout also frames password recovery, setup and email-link confirmation. Phones and tablets show the form without the decorative panel.
- Refined sign-in headings, spacing, 48 px white inputs and primary action; moved password recovery beside its label and added invitation guidance. The show/hide password button preserves the field value, supports keyboard use and announces its state. Existing form validation, server actions, guards and redirects remain in use.
- Full verification passed with 166 unit/database tests, typecheck, lint, security scan and production build. Final layout refinements passed lint and a fresh build. All 10 selected desktop/phone browser regressions passed (local sign-in validation, expired/missing email sessions, invalid PKCE codes and mocked invitation completion).
- Live visual review covered 1516x686 at 1.25 scale, 1366x768, 1280x600, 1024x768, 768x1024 and phones at 393x852 and 320x740. No horizontal overflow; typical laptop and phone screens fit without page overflow, while short screens scroll naturally. Checked recovery navigation, error display, password visibility/value preservation, autocomplete and keyboard focus without submitting credentials or sending recovery emails. Screenshots: gitignored `test-results/auth-design-review/`. The owner's existing port-3000 server remains running.

## Desktop sidebar open/close (2026-11-03)

- Edge-position follow-up: moved the chevron from the top bar onto the shared upper-left corner of the sidebar/content card. It stays anchored there in expanded and collapsed modes and during content scrolling. Added clearance above the first compact menu item so its hit area does not overlap the arrow. Focused lint and a fresh production build passed. Live checks at 1516/1280/1024 px desktop and 393/320 px phone widths confirmed corner alignment, pointer/keyboard activation, unobstructed menu targets, red badges, fixed scrolling and phone navigation. Screenshots: gitignored `test-results/sidebar-edge-review/`.
- Latest follow-up: the collapsed rail now includes all clickable menu icons beneath the Rentora logo, with accessible names, hover/focus tooltips and the current-page highlight. Navigation and notification counts remain available while collapsed, superseding the logo-only state below. Maintenance and pending-payment badges are now red with white text in expanded, collapsed and phone navigation; zero counts are hidden and counts above 99 display `99+` while retaining the full accessible count. Full verification passed (166 tests, typecheck, lint, security scan and build). Live checks at desktop widths 1516/1280/1024 and phone widths 393/320 passed for icon links, badge color/placement, tooltips, keyboard/click navigation, active state and fixed-frame sizing. Screenshots: gitignored `test-results/sidebar-icons-review/`.
- Follow-up: replaced the panel icons with simple left/right chevrons. Collapsing now keeps a 64 px rail showing only the Rentora house/R logo; the name, organization and navigation are hidden. The arrow controls the navigation region and retains keyboard focus. This supersedes fully hiding the sidebar. Full verification passed again (166 tests, typecheck, lint, security scan and build); live desktop/phone checks confirmed the logo-only rail, workspace sizing, preserved navigation/filter state and phone drawer behavior.
- Added an accessible toggle at the left end of the desktop top bar to hide and reopen the sidebar. Closing it gives the main panel the available width while keeping the fixed frame and account controls. The state stays in place during client navigation; a fresh load starts with the sidebar open. Phone drawer navigation remains separate.
- Full verification passed: 166 unit/database tests, typecheck, lint, security scan and production build. Live localhost checks covered desktop widths 1516, 1280 and 1024 plus phone widths 393 and 320: toggle state/labels, keyboard activation and focus, workspace width, navigation/filter state, fixed document bounds, Billing scrolling and mobile drawer navigation passed. Screenshots: gitignored `test-results/sidebar-toggle-review/`. The owner's existing dev server was left running.

## Boarding-house location in the header (2026-11-03)

- Replaced the header's hardcoded timezone label with active property addresses saved in **Settings → Properties**. The owner chose the boarding house's saved location rather than device geolocation. Duplicate/blank addresses are handled; multiple distinct locations are shown together and truncated visually with the full value in the title. Missing addresses show a Settings link to set the location. The Settings page description uses the same saved location.
- Property save/archive actions now revalidate the admin layout so the header updates immediately. Reads still use the authorized user's Supabase client and RLS. Billing dates remain on `Asia/Manila`, and currency remains PHP.
- Updated the current demo property's old Manila sample address to `Davao City` through the existing guarded Settings form, as requested. The location persists in Supabase; no migrations or service-role writes were needed.
- Validation: `npm run verify` passed (166 unit/database tests, typecheck, lint, security scan and build). Live browser checks confirmed save-to-header revalidation, the persisted address, navigation/reload, expanded/collapsed headers at 1516 and 1024 px, phone Settings access, and unchanged organization timezone/currency. Manual formatting checks covered missing, duplicate and multiple addresses. Screenshots: gitignored `test-results/location-review/`.

## Utility, damage and other separate charges (2026-11-03)

- New charge's Type now offers security deposit, water bill, electricity bill, internet/Wi-Fi, damage/repair, cleaning fee, lost key/lock replacement, late payment fee and other charges. Utility hints specify when the service is not included in rent and encourage entering the billing period/meter reading. These are manual separate invoices, not automatic monthly additions.
- Selecting a type prefills the first line's description and accounting kind. Custom descriptions, amounts, notes and extra lines are preserved on type changes. Add line supports combining utilities, repairs and discounts. The dialog's line layout now fits narrow phones.
- Presets use the existing deposit/other invoice kinds and deposit/fee/other line kinds; descriptive details are saved in invoice lines. `createCharge`, schema validation, one-time peso parsing and the authorized `create_invoice` RPC remain the write path. No migration or direct financial write grants were added.
- Full verification passed with 169 tests, typecheck, lint, security scan and build. Three new embedded-Postgres checks cover exact utility/damage/discount totals independent of rent, rejecting boarder-created charges, and rejecting cross-organization charges. Live browser checks verified all nine options, descriptions, retained data, validation, multi-line totals and 393/320 px layouts. Submission was intercepted to verify raw peso strings without creating a live test invoice. Screenshots: gitignored `test-results/charge-types-review/`.

## Dropdown spacing and Reports filters (2026-11-03)

- Added a shared `controls.css` imported by the root layout: native single-selects reserve 40 px for a 16 px chevron inset 12 px from the right, with consistent left padding. Native keyboard/touch pickers remain in use; forced-colors mode restores the system arrow. Multi-selects/listboxes are excluded. The shared Radix Select trigger also has a larger gap and padding.
- Reports filters now use a responsive grid with matching 40 px date/select controls and aligned Apply/Reset actions. Reset restores this month-to-date and the six-month chart for both applied filters and unsaved edits. Next's GET Form keeps navigation inside the app shell; a key based on raw search parameters lets normalized/blank dates return to the server's validated range. Labels are explicitly associated with controls.
- Constrained Reports grid/collection panels so charts and tables no longer expand the phone document; wide report tables retain their internal horizontal scrolling. This resolves the earlier Reports phone-overflow follow-up.
- Validation: full verification passed with 169 tests, typecheck, lint, security scan and production build. Confirmed the custom rule is present in production CSS. Live browser review passed 14 dropdown checks across Reports, Billing, New charge, rent generation, payments and rooms, plus applied/unsaved/blank-date reset cases, preserved sidebar state, 1024/393/320 px layouts and forced-colors fallback. No live writes were submitted. Screenshots: gitignored `test-results/control-spacing-review/`.

## Boarder announcement notifications (2026-11-03)

- The boarder header bell now shows a red unread badge: 1–9, then 9+, with the full count in its accessible label. The list and Home previews link to a dedicated full announcement page and show unread status. Opening the list or prefetching a detail route does not mark announcements read.
- On opening/resuming the app, unread announcement cards appear one at a time for five seconds. X advances to the next card. Dismissal and timeout only affect the current app session; unread cards return on the next foreground opening. Hover/keyboard focus pauses the timer, and time spent in a hidden tab does not consume cards. Cards are suppressed while viewing the announcements list/details. Visible apps refresh the inbox every minute, and resuming refreshes it immediately.
- Read receipts are saved per boarder and publication version only after the visible detail page mounts. Failed saves offer a retry. Republishing an announcement makes it unread again; drafts, future publications and archived announcements are excluded. The guarded action uses the user's client and the `mark_announcement_read` RPC; no service-role access or direct receipt writes were added.
- Added `20261103000001_announcement_reads_functions.sql`: RLS-protected `announcement_reads`, own-receipt SELECT only, and a version-checked SECURITY DEFINER RPC with boarder/organization/status checks. All 104 database tests passed, including 18 new receipt authorization/isolation/version tests. Verified the linked project is `rentora-dev`, reviewed the single-migration dry run, then applied this additive migration successfully.
- Isolated browser checks exercised the actual client components without publishing test announcements: badge cap/color, X/timeout sequencing, foreground replay, detail-only reads, hidden-page behavior, retry, zero count, republishing, keyboard pause and widths 320/393/768/1440 passed. A live read-only boarder check matched the database's one unread announcement and confirmed that list navigation/prefetch left receipts unchanged. Physical phone/PWA lifecycle verification remains pending.

## Animated logo loading screen (2026-11-03)

- Navigation follow-up: restored the previous admin/table, boarder and receipt skeletons for ordinary route changes; auth pages also have an in-card skeleton. Sidebar, header and mobile bottom navigation stay available while content loads. The house-logo animation is reserved for whole-app startup and is hidden for the first 800 ms to avoid flashing on quick requests. Reduced-motion retains the delay with no fade. Lint/build and actual production browser checks passed with held navigation responses at admin 1440 px, phone 393 px and tablet 768 px: scoped skeletons, unchanged navigation bounds, no full-screen logo during navigation, eventual destination rendering, and delayed startup visibility. Screenshots: gitignored `test-results/navigation-loading-review/`.
- House-outline follow-up: the loading line now follows the actual house silhouette, tracing the roof, walls and base close to the logo (1.8-second linear loop). The perimeter comes from the same shared artwork as the filled logo, and both move together during the gentle loading animation. It scales on phones/tablets/desktops, stops for reduced motion, and remains hidden in print. Lint, production build and browser checks at 320/393/768/1440 px passed, including stroke progress along the path and reduced-motion behavior. Screenshots updated in `test-results/logo-animation-review/`.
- Smooth-animation follow-up: all shared app logos now enter with a short eased fade/rise, including auth, header, expanded/collapsed sidebar and phone drawer. Clickable logos have a subtle hover/keyboard-focus lift on desktop. Loading uses a gentler 2.6-second floating/breathing loop. Reduced-motion disables both animation and hover transforms; print output remains still. Browser checks passed at 320/393/768/1440 px for reveal, hover, keyboard focus, stable layout, the loading loop, reduced motion and print; a fresh final production build passed. Local screenshots: gitignored `test-results/logo-animation-review/`.
- Initial app startup uses the shared full-screen Rentora house/R logo on the warm-white ground while authenticated layouts load. Page navigation uses the restored content skeletons described above. The animation gently lifts, scales and fades the existing vector logo; reduced-motion settings show a still logo, and a status label supports screen readers.
- The fallback disappears when content is ready, with no artificial delay. Form submission buttons retain their existing pending/disabled behavior.
- Full verification passed with 187 unit/database tests, typecheck, lint, security scan (18 tables/55 SQL functions) and production build. Browser checks validated actual streamed loading, centering, animation and removal at phone 393x852, tablet 768x1024 and admin 1440x900, plus isolated responsive/reduced-motion checks. All 14 selected desktop/phone security and protected-detail-route regressions passed. The owner's existing dev server was left running.

## Next steps (pick up here)

1. Test a fresh invitation, first-password setup and recovery from the owner's real inbox using the default email provider. For the already-confirmed failed invite, use the recovery path above; old email links may already be consumed.
2. **Choose an SMTP provider** (owner decision, may cost money), then configure sender/domain and the templates in `supabase/templates/`.
3. Exercise live uploads and payment-proof review on the dev project: submit as a boarder, open as staff, verify private access and signed URL expiry, then approve/reject and inspect the resulting bill/receipt. Also test a maintenance photo.
4. Test PWA installation/offline behaviour on a physical phone and complete the visual review of the remaining screens and dialogs.
5. For future verification, build first, then run the live suite. In PowerShell: `npm.cmd run build`, then `$env:E2E_SUPABASE='1'; npm.cmd run test:e2e -- --workers=2`. If managing the production server separately, start `node node_modules/next/dist/bin/next start -p 3100` and set `$env:E2E_BASE_URL='http://localhost:3100'` for the test command.
6. Later: production Supabase project in Singapore, Vercel deploy (needs owner approval), provision the first landlord.
7. Optional: revoke `SUPABASE_ACCESS_TOKEN` in the Supabase dashboard once CLI work is done.

Existing demo logins use password `DemoPass2026`: `admin@demo.rentora`, `boarder1@demo.rentora`, `boarder2@demo.rentora` (see `scripts/seed-demo.ts`). The project is already seeded; the script is not a reset or resumable seed.
