# HOD Sanitation Hub: project memory

Attendance tracker and reporting tool for the Sanitation Unit of Household of David (global church).
The full specification is `HOD-BUILD-PROMPT.md` (single source of truth). Decisions taken where the spec is silent are in `docs/DECISIONS.md`.

@AGENTS.md

## The one rule

**Business rules live in `src/lib` only.** Attendance status, percentages, geofence, sheet matching, reminder timing, badges and permissions are pure, unit-tested functions under `src/lib`. Screens, route handlers, exports and emails call them and never re-implement them.

Other rules:

- "Now" comes only from `src/lib/time/clock.ts` (`now()`), never `Date.now()` or `new Date()` in business logic. All meeting rules run in `Africa/Lagos` (`src/lib/time/zone.ts`).
- Data access goes through the repository interface `src/lib/repo/interfaces.ts`. Until Phase 8 the implementation is `src/lib/repo/json-mock` (in-memory, seeded deterministically from `src/data/seed`).
- Authorization is enforced on the server via `src/lib/auth/permissions.ts`; hiding a button is never enough. Every protected page starts with `await requirePage("/its/path")` (`src/lib/auth/session.ts`); `src/proxy.ts` only does fast cookie-based redirects.
- Route handlers live under `src/app/api/v1`, validate bodies with Zod (`parseJson`) and answer errors as `{ error: { code, message } }` (`src/lib/http.ts`).
- Every screen needs loading, empty, error and success states, works from 360 px, and meets the accessibility rules in spec section 3.8 (status never by colour alone, 44 px touch targets, labelled inputs).
- Next.js 16 with Cache Components: client trees that read the clock or call Luxon during render must sit inside `<Suspense>` (see `docs/DECISIONS.md`).

## Commands

| Command               | What it does                                                             |
| --------------------- | ------------------------------------------------------------------------ |
| `npm run dev`         | Dev server on http://localhost:3000                                      |
| `npm run lint`        | ESLint, zero warnings allowed                                            |
| `npm run typecheck`   | `next typegen` then `tsc --noEmit`                                       |
| `npm run test`        | Vitest unit and component tests                                          |
| `npm run build`       | Production build                                                         |
| `npm run e2e`         | Playwright, one worker (run `npm run build` first; serves on port 3100)  |
| `npm run check`       | All of the above in order                                                |
| `npm run seed:sheets` | Regenerate the sample CSV and XLSX sheets in `src/data/sample-sheets`    |
| `npm run seed:report` | Print a summary of the deterministic seed (counts, demo account targets) |

Husky pre-commit runs lint-staged (Prettier), lint, typecheck and unit tests.

## Folder map

```text
src/app/                  routes (public, member, volunteer, admin, api/v1, design-system, dev)
src/components/ui/        shadcn primitives + HOD variants (GlassCard, DataTable, EmptyState, ThemeToggle)
src/components/brand/     Logo, HeroBanner, PhotoCard, GradientBackdrop, CountdownHero
src/components/charts/    AttendanceRing, Heatmap, KpiCard, TrendLine, StackedBars, Donut, Sparkline
src/components/layout/    AppShell, Sidebar, BottomNav, TopBar, RoleBadge, DemoRibbon, nav config
src/components/attendance StatusChip, CheckInPanel
src/components/volunteer/ DutyBoard, HoursPanel, IssueReporter, MarshalBoard, TeamView, RsvpButtons
src/components/screens/   screens shared by member and volunteer (Attendance, Messages, Settings)
src/lib/time/             clock (simulated now), zone helpers, meeting schedule
src/lib/attendance/       status, geofence, percentage, aggregation, badges, excuses
src/lib/volunteer/        zones, duties, hours, marshal lists (pure); service, data, auto-hours (server)
src/lib/matching/         normalize, similarity, columns, parse (CSV/XLSX), matchSheet, upload
src/lib/notifications/    schedule (dueNotifications), templates, audience
src/lib/auth/             permissions, session cookie (claims, tokens), sign-in service, lockout, TOTP, passwords
src/lib/notifications/senders/  EmailSender interface; console sender + demo outbox
src/components/auth/      LoginForm, SignupForm, PasswordField, AuthShell
src/components/public/    PublicHeader, PublicFooter, NextMeetingCountdown
src/lib/repo/             types, interfaces, json-mock implementation
src/lib/demo/             simulate-time and simulate-location presets, /dev/data summary
src/lib/validation/       Zod schemas
src/data/seed/            deterministic generators (mulberry32, seed 20261106)
src/data/sample-sheets/   downloadable CSV/XLSX with deliberate errors
src/styles/tokens.css     design tokens (spec 3.2)
src/tests/unit, e2e       Vitest and Playwright
docs/                     DECISIONS.md, reference-screenshots/
```

## Review pages (until the real screens exist)

- `/design-system` and `/design-system/shell`: tokens, components and the app frames.
- `/dev/data`: seed totals, demo accounts and the rules at a simulated time (`GET /api/v1/demo/summary?at=`).
- `/dev/outbox`: emails the app would have sent (verification, reset, new device). `POST /api/v1/demo/reset` restores the seed.
- Demo admin invitation: `/accept-invite/demo-invite-2026`. Admin two-factor accepts any six digits in demo mode.

## Demo facts

The seeded history runs up to Friday 6 November 2026; the app clock is the real time unless "Simulate time" on `/dev/data` moves it. Upcoming weekly meetings come from the recurring rules (`withRecurringMeetings`). Demo accounts use password `Demo@2026` (spec 10.4). Demo mode is on unless `NEXT_PUBLIC_DEMO_MODE=false`.
