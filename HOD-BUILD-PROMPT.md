# HOD Sanitation Hub: Complete Build Prompt

**Project:** Sanitation Attendance Tracker and Reporting Tool for the Sanitation Unit of **Household of David**, a global church.
**Document type:** Master specification and build prompt for Claude Code.
**Version:** 1.0 (6 November 2026)

---

## How to use this file (instructions to Claude Code)

You are a senior full-stack engineer and product designer. Read this entire file before writing any code. It is the single source of truth for what to build.

1. Build in the phases listed in section 14, in order. Finish each phase completely, run the checks listed for it, then give a short summary of what exists and what the person should look at in the browser.
2. Do not stop to ask permission between phases unless you are blocked by something only the person can supply (for example a missing file). When this file is silent, choose the most sensible option, build it, and record the decision in `docs/DECISIONS.md`.
3. Phases 0 to 7 run entirely on dummy data with no external services. Phase 8 connects the real database, email and scheduler. Never put real secrets in the repository.
4. Keep business rules (attendance status, percentages, geofence, sheet matching, reminder timing) in pure, unit-tested functions under `src/lib`. Screens must call these functions and never re-implement the rules.
5. Every screen needs loading, empty, error and success states, must work from 360 px wide upward, and must meet the accessibility rules in section 3.
6. Commit after each phase with a clear message (see section 14).

---

## 0. Project facts and assumptions

| Item | Value |
| --- | --- |
| Product name | HOD Sanitation Hub |
| Church | Household of David (global church) |
| Unit | Sanitation Unit |
| Logo | `images/HOD-logo.webp` in the project folder. Copy it to `public/images/HOD-logo.webp` and use it everywhere. Generate favicon, apple-touch icon and PWA icons from it. |
| Design reference screenshots | Files named `Screenshot (562).png` to `Screenshot (582).png` in `images/`. Move them to `docs/reference-screenshots/`, look at them, and treat them as visual inspiration only. Do not copy them into the app. |
| Venue | 7 Surulere Industrial Road, Off Adeniyi Jones, Ikeja, Lagos, Nigeria |
| Venue coordinates | Not known precisely. Seed the placeholder latitude 6.6018 and longitude 3.3515 (near Adeniyi Jones, Ikeja), store it in `Venue`, and show a banner in Admin settings: "Verify this pin on site before launch." |
| Meeting time zone | `Africa/Lagos` (UTC+1, no daylight saving). All rules run in this zone. Display times in the viewer's own zone as well. |
| Saturday meeting | Every Saturday 9:30 am. Tracked by geolocation. |
| Thursday prayer meeting | Every Thursday 8:30 pm. Tracked by admin-uploaded attendee sheet. |
| Late rule | Anyone checking in after the start time (9:30 am Saturday) is Late. The original brief said "9:30pm"; it is treated as 9:30 am. Grace period defaults to 0 and is configurable. |
| Today in the demo | Friday 6 November 2026. The next Saturday meeting is 7 November 2026, 9:30 am. |

### Decisions already taken (change only if the person says so)

- Thursday prayer is attended in person or online and recorded by the sheet. Saturday uses location only.
- Members who live outside Lagos can be marked **Remote** by an admin; Remote members are excluded from the Saturday geofence requirement and are recorded through sheets or manual entry.
- Late counts as attended in the attendance percentage; punctuality is shown separately as the on-time rate. An optional admin setting counts Late as half.
- Check-in window: opens 60 minutes before start (8:30 am) and closes 2 hours after (11:30 am).
- Admins approve every new member and volunteer. Admin accounts are created by invitation only.

---

## 1. Tech stack and setup

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 or newer, App Router, React, TypeScript (strict) |
| Styling | Tailwind CSS, shadcn/ui, `class-variance-authority`, Framer Motion |
| Charts and maps | Recharts; Leaflet with OpenStreetMap tiles (no paid map key) |
| Forms and validation | React Hook Form, Zod |
| Data fetching | TanStack Query |
| Dates and time zones | Luxon |
| Files | PapaParse (CSV), SheetJS `xlsx` (XLSX), `@react-pdf/renderer` (PDF), `ics` (calendar files) |
| Database (Phase 8) | PostgreSQL with Prisma (Neon or Supabase) |
| Auth (Phase 8) | Auth.js (credentials provider), Argon2 hashing, TOTP for admins via `otplib` |
| Email (Phase 8) | Resend (primary) behind an `EmailSender` interface; console sender for development |
| Jobs (Phase 8) | Cron-triggered route every minute plus a queue (Inngest or BullMQ) |
| Push | Web Push with a service worker (`web-push`) |
| Tests | Vitest, React Testing Library, Playwright |
| Quality | ESLint, Prettier, TypeScript strict, Husky pre-commit (lint, type-check, unit tests) |

### Scaffold commands (Windows, run in the project root)

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
npm install framer-motion recharts react-hook-form zod @hookform/resolvers @tanstack/react-query luxon papaparse xlsx @react-pdf/renderer ics leaflet react-leaflet lucide-react clsx tailwind-merge class-variance-authority
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test @types/luxon @types/papaparse @types/leaflet prettier husky lint-staged
npx shadcn@latest init
```

If `create-next-app` refuses because the folder already contains files, scaffold into a temporary subfolder and move everything up one level, keeping `images/` intact.

Environment files: create `.env.example` listing every variable (see section 12) and add `.env*` (except `.env.example`) to `.gitignore`.

---

## 2. Folder structure

```text
hod-sanitation-hub/
  public/
    images/HOD-logo.webp
    images/photos/                    royalty-free photos with credits in photos.json
    manifest.webmanifest
    sw.js                             service worker (offline shell, push)
  prisma/
    schema.prisma                     schema from section 9 (used from Phase 8)
    seed.ts
  src/
    app/
      (public)/                       landing, login, signup, accept-invite, forgot, verify, pending, privacy
      (member)/member/...
      (volunteer)/volunteer/...
      (admin)/admin/...
      api/v1/...                      route handlers (Phase 8; mock handlers before that)
      layout.tsx
      globals.css
    components/
      ui/                             shadcn primitives and HOD variants
      brand/                          Logo, HeroBanner, PhotoCard, GradientBackdrop
      charts/                         AttendanceRing, Heatmap, TrendLine, StackedBars, Donut, KpiCard
      layout/                         AppShell, Sidebar, BottomNav, TopBar, RoleBadge, DemoRibbon
      attendance/                     StatusChip, CheckInPanel, HistoryTable
      admin/                          UploadWizard, AudienceBuilder, RosterBoard, MembersTable
    lib/
      time/                           Luxon helpers, meeting schedule, simulated clock
      attendance/                     status.ts, percentage.ts, geofence.ts, badges.ts
      matching/                       normalize.ts, similarity.ts, matchSheet.ts
      notifications/                  schedule.ts, templates.ts, senders/
      reports/                        csv.ts, xlsx.ts, pdf.tsx, ics.ts
      auth/                           session.ts, guards.ts, permissions.ts
      repo/                           interfaces.ts, json-mock/, prisma/
      validation/                     Zod schemas
    data/
      seed/                           deterministic generators
      sample-sheets/                  downloadable CSV and XLSX with deliberate errors
    styles/tokens.css
    hooks/
    tests/
      unit/
      e2e/
  docs/
    DECISIONS.md
    reference-screenshots/
    USER-GUIDE.md
    RUNBOOK.md
  README.md
  CLAUDE.md                           short project memory (see section 14, Phase 0)
```

---

## 3. Design system and visual implementation

### 3.1 Look and feel

Dignified, warm, modern and premium. Royal navy and gold with a fresh teal accent, generous white space, large rounded cards, soft shadows, subtle glass effects on dark backgrounds, and smooth, restrained motion. It should feel like a well-run global ministry, not a generic admin template.

### 3.2 Tokens (`src/styles/tokens.css`)

Replace values with exact colors sampled from `HOD-logo.webp` if they differ, and record that in `docs/DECISIONS.md`.

```css
:root {
  --navy-950: #060f2b;
  --navy-900: #0a1a44;
  --navy-800: #11275f;
  --royal-700: #1e3a8a;
  --royal-600: #1e40af;
  --royal-500: #2563eb;
  --sky-400: #60a5fa;
  --sky-100: #dbeafe;
  --gold-600: #b8861b;
  --gold-500: #d4a437;
  --gold-300: #f5d27a;
  --gold-100: #fdf3d4;
  --teal-600: #0d9488;
  --teal-500: #14b8a6;
  --green-500: #22c55e;
  --success: #16a34a;
  --warning: #f59e0b;
  --danger: #e11d48;
  --info: #3b82f6;
  --ink: #0f172a;
  --slate-600: #475569;
  --mist: #e2e8f0;
  --paper: #f8fafc;
  --white: #ffffff;

  --grad-hero: linear-gradient(135deg, #0a1a44 0%, #1e3a8a 55%, #2563eb 100%);
  --grad-gold: linear-gradient(135deg, #f5d27a 0%, #d4a437 100%);
  --grad-fresh: linear-gradient(135deg, #0ea5a4 0%, #22c55e 100%);
  --grad-sunrise: linear-gradient(120deg, #1e3a8a 0%, #7c3aed 50%, #f59e0b 100%);
  --grad-glass: linear-gradient(135deg, rgba(255,255,255,.16), rgba(255,255,255,.04));

  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-xl: 28px;
  --shadow-soft: 0 8px 30px rgba(10, 26, 68, .10);
  --shadow-lift: 0 14px 40px rgba(10, 26, 68, .18);
}

.dark {
  --paper: #0b1226;
  --ink: #e8eefc;
  --mist: #243056;
  --slate-600: #9fb0d6;
}
```

Role accents: Member = royal blue (`--royal-600`), Volunteer = teal (`--teal-500`), Admin = gold (`--gold-500`) on navy.

### 3.3 Typography

- Headings: **Fraunces** (600, 700), loaded with `next/font`.
- UI and body: **Plus Jakarta Sans** (400, 500, 600, 700), tabular figures for numbers in tables and KPIs.
- Scale: 12, 14, 16, 20, 24, 32, 48 px. Body line height 1.5, headings 1.2.

### 3.4 Imagery

- Download 6 to 8 royalty-free photos (Unsplash or Pexels) into `public/images/photos/` and list photographer and URL in `photos.json`; render credits in the landing footer. Subjects: bright modern church interior, volunteers cleaning together, sparkling floors and windows, cleaning supplies arranged neatly, a team in matching aprons, sunrise over a city skyline, hands holding a mop and bucket, a clean entrance lobby.
- If photo downloads are blocked in the environment, generate rich gradient and pattern placeholders in the same slots and list the exact photos to add in `docs/DECISIONS.md`. Do not use broken links.
- Always overlay photos with a navy gradient (55 to 70 percent) when text sits on them.
- Never use photos of identifiable real members. Dummy avatars are initials on gradient circles.
- Logo: place on a white rounded pill over dark backgrounds if it is dark; show full-color on light backgrounds.

### 3.5 Core components

| Component | Behavior |
| --- | --- |
| Glass card | 20 px radius, 1 px translucent border, soft shadow, 2 px lift on hover. Dark variant with `--grad-glass`. |
| AttendanceRing | SVG ring with animated fill, big percentage in the center, small label under it, color by band: 90 and above gold, 75 to 89 green, 50 to 74 amber, below 50 red. Never color alone: also print the band name ("Gold standard", "Strong", "Needs attention", "At risk"). |
| StatusChip | On time (green), Late (amber), Absent (red), Excused (blue), Manual (grey outline), Flagged (red outline). Each has an icon and text. |
| Heatmap | 12 months by week, one square per meeting, colored by status, tooltip with date and status, keyboard focusable. |
| KpiCard | Label, big number, delta versus previous period with arrow and color, tiny sparkline. |
| CountdownHero | Gradient hero with next meeting name, live countdown (days, hours, minutes, seconds), venue, and primary action. |
| Table | Sticky header, sortable columns, row selection, density toggle, mobile card view below 640 px. |
| Empty state | Illustration, one sentence, one action button. |
| Toasts, dialogs, drawers | shadcn based, focus trapped, Escape closes. |
| DemoRibbon | Corner ribbon "Demo data" shown whenever demo mode is on. |

### 3.6 Layout and navigation

- Phone (below 768 px): top bar with logo and notification bell, content, and a **bottom tab bar** with 4 or 5 main destinations; "More" opens a sheet.
- Tablet and desktop (768 px and up): collapsible left **sidebar** (navy gradient) with role-colored active item, top bar with search, date range, notifications and avatar menu.
- Breakpoints: 360, 640, 768, 1024, 1280, 1536. Content max width 1280 px, centered.
- Page header pattern: title (Fraunces), one-line subtitle, primary action on the right.

### 3.7 Motion

Framer Motion for page fade and rise (200 ms), ring fill (800 ms), list stagger (40 ms), check-in success burst of gold confetti (once). All motion disabled under `prefers-reduced-motion`.

### 3.8 Accessibility and quality

WCAG 2.2 AA contrast, visible focus rings (`--sky-400`, 2 px), labeled inputs, error text linked with `aria-describedby`, 44 px minimum touch targets, status never by color alone, alt text on photos, semantic landmarks, skip link, and screen-reader announcements for check-in results via `aria-live="polite"`.

### 3.9 Dark mode and PWA

Light and dark themes with a toggle and system default. Installable PWA (manifest, icons from the logo, offline shell). Check-in requests made while offline are queued and retried, with the pending state visible.

---

## 4. Roles, sign-in and permissions

### 4.1 Roles

| Role | Who | Notes |
| --- | --- | --- |
| Member | Regular unit members | Default role after sign-up approval |
| Volunteer | Members who serve actively | Own sign-up form; keeps all member features |
| Admin | Leaders who run the unit | Invitation only, two-factor required |

Admin levels: **Super Admin**, **Unit Admin**, **Attendance Officer**, **Communications Officer**, **Auditor**.
Titles (assigned by admins, additive): Team Lead, Zone Captain, Check-in Marshal, Supplies Keeper, Welcome Team, Prayer Coordinator.
Account status: Pending, Active, Suspended, Removed (soft delete for 30 days).

### 4.2 Permission matrix

| Capability | Member | Volunteer | Admin |
| --- | --- | --- | --- |
| Check in by geolocation | Yes | Yes | Yes |
| Own attendance, percentage, history, report | Yes | Yes | Yes |
| Upcoming events and meeting times | Yes | Yes | Yes |
| Reminders and announcements | Yes | Yes | Yes |
| Submit excuse request | Yes | Yes | Review and approve |
| Duty board, service hours, report an issue | No | Yes | Manage |
| Marshal tools (live list, manual check-in) | No | With Marshal title | Yes |
| Team view | No | With Team Lead title | Yes |
| Unit-wide statistics | No | No | Yes |
| Upload attendance sheets | No | No | Yes (Super, Unit, Attendance Officer) |
| Download any-period reports | No | No | Yes |
| Add, approve, suspend, remove people | No | No | Yes (Super, Unit) |
| Message all or specific people | No | No | Yes (Super, Unit, Communications Officer) |
| Assign roles and titles | No | No | Yes (Super, Unit; admin-level changes Super only) |
| Settings, geofence, schedule, reminders | No | No | Super Admin |
| Audit log | No | No | Yes (Super, Unit, Auditor) |

Enforce on the server for every page and API route through `src/lib/auth/permissions.ts`. Hiding a button is never sufficient. Add a unit test that walks the matrix.

### 4.3 Sign-up, sign-in and approval

- One login page with three tabs: Member, Volunteer, Admin. Email plus password, show-password toggle, remember this device, forgot password link.
- Member and Volunteer sign-up: full name, email, phone, password (strength meter, minimum 10 characters), country, city, preferred language, optional unit code, consent to location use at check-in only, and consent to receive reminders.
- After sign-up: email verification, then the **Pending** screen until an admin approves. Rejected users see a polite message and a contact link.
- Admin: invitation email with one-time link (expires in 7 days) leads to Accept Invite (set password, enable two-factor with QR code). In demo mode accept any six-digit code.
- Sign-in errors are specific but safe: wrong credentials, pending approval, suspended, too many attempts (lockout 15 minutes after 5 failures).
- New-device sign-in sends an email. Sessions expire after 30 days (members) and 8 hours of inactivity (admins).

---

## 5. Meetings, times and schedule

All times are `Africa/Lagos`. Use Luxon everywhere. A simulated clock (`src/lib/time/clock.ts`) must be the only source of "now" so that demo mode and tests can set it.

| Meeting | Recurrence | Start | Tracking | Window | Reminders |
| --- | --- | --- | --- | --- | --- |
| Saturday Sanitation Meeting | Weekly, Saturday | 09:30 | Geolocation | 08:30 to 11:30 | Friday 09:30, Saturday 08:30 |
| Thursday Prayer Meeting | Weekly, Thursday | 20:30 | Sheet upload | Not applicable | Wednesday 20:30, Thursday 19:30 |
| Special event | Admin defined | Admin defined | Geolocation or sheet | Admin defined | 1 day and 1 hour before |

Admins can add, edit, cancel and reschedule meetings. Recurring rules generate dated meeting rows. Cancelling or rescheduling updates reminders automatically and notifies people.

---

## 6. Business rules (reference implementation)

Implement exactly this behavior in pure functions with unit tests. TypeScript below is the reference; adapt names as needed.

### 6.1 Status for geolocation check-in

```ts
import { DateTime } from 'luxon';

export type AttendanceStatus = 'ON_TIME' | 'LATE' | 'ABSENT' | 'EXCUSED';

export type CheckInRejection =
  | 'WINDOW_NOT_OPEN'
  | 'WINDOW_CLOSED'
  | 'OUT_OF_RANGE'
  | 'LOW_ACCURACY'
  | 'ALREADY_CHECKED_IN'
  | 'MEETING_CANCELLED';

export interface WindowRules {
  graceMinutes: number;       // default 0
  openBeforeMinutes: number;  // default 60
  closeAfterMinutes: number;  // default 120
}

export function evaluateCheckInTime(
  nowUtc: DateTime,
  meetingStartUtc: DateTime,
  rules: WindowRules
): { ok: true; status: 'ON_TIME' | 'LATE' } | { ok: false; reason: CheckInRejection } {
  const opens = meetingStartUtc.minus({ minutes: rules.openBeforeMinutes });
  const closes = meetingStartUtc.plus({ minutes: rules.closeAfterMinutes });
  if (nowUtc < opens) return { ok: false, reason: 'WINDOW_NOT_OPEN' };
  if (nowUtc > closes) return { ok: false, reason: 'WINDOW_CLOSED' };
  const lateAfter = meetingStartUtc.plus({ minutes: rules.graceMinutes });
  return { ok: true, status: nowUtc <= lateAfter ? 'ON_TIME' : 'LATE' };
}
```

Boundary tests: 09:29:59 is On time; 09:30:00 is On time; 09:30:01 is Late; 08:29:59 is rejected; 11:30:01 is rejected; grace of 10 minutes makes 09:40:00 On time and 09:40:01 Late.

### 6.2 Geofence

```ts
const R = 6371000; // metres
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function evaluateLocation(
  p: { lat: number; lng: number; accuracyM: number },
  venue: { lat: number; lng: number; radiusM: number },
  maxAccuracyM = 50
) {
  if (p.accuracyM > maxAccuracyM) return { ok: false as const, reason: 'LOW_ACCURACY' as const };
  const d = distanceMetres(p.lat, p.lng, venue.lat, venue.lng);
  return d <= venue.radiusM
    ? { ok: true as const, distanceM: d }
    : { ok: false as const, reason: 'OUT_OF_RANGE' as const, distanceM: d };
}
```

- Default radius 100 m (adjustable 50 to 300 m per venue or event). Default maximum accuracy 50 m.
- The browser sends coordinates; the **server** (or the mock handler) computes distance and time using its own clock. Never trust a client-supplied time or status.
- Anti-spoofing flags (a flagged check-in is saved with `flagged = true` and a reason and goes to Corrections; it is not silently rejected): same `deviceId` used by more than one account for the same meeting; a jump of more than 2 km from the previous check-in in under 30 minutes; accuracy of exactly 0 or a perfectly round coordinate; more than 5 attempts in 10 minutes.
- Optional second proof: a rotating QR code (new token every 30 seconds) shown on the Marshal screen; when enabled for a meeting, the member must scan or type the code.

### 6.3 Percentages

```ts
export interface Counts { onTime: number; late: number; absent: number; excused: number; }

export function attendancePercent(c: Counts, lateWeight = 1): number | null {
  const denominator = c.onTime + c.late + c.absent;           // excused removed
  if (denominator === 0) return null;
  const earned = c.onTime + c.late * lateWeight;
  return Math.round((earned / denominator) * 1000) / 10;      // one decimal
}

export function onTimeRate(c: Counts): number | null {
  const attended = c.onTime + c.late;
  if (attended === 0) return null;
  return Math.round((c.onTime / attended) * 1000) / 10;
}

export function band(pct: number | null) {
  if (pct === null) return { key: 'none', label: 'No meetings yet' };
  if (pct >= 90) return { key: 'gold', label: 'Gold standard' };
  if (pct >= 75) return { key: 'green', label: 'Strong' };
  if (pct >= 50) return { key: 'amber', label: 'Needs attention' };
  return { key: 'red', label: 'At risk' };
}
```

Rules:
- Only meetings **held**, on or after the person's `approvedAt` date, and not cancelled count.
- Worked example: 20 meetings held, 14 on time, 3 late, 1 excused, 2 absent gives attendance 17 / 19 = 89.5 percent and on-time rate 14 / 17 = 82.4 percent.
- Show these views everywhere: overall, Saturday only, Thursday only, last 3 months, year to date. The same function feeds every screen, export and email.

### 6.4 Sheet upload matching

Accepted files: CSV and XLSX up to 5 MB and 5,000 rows. Required columns: name and email (case-insensitive header detection with synonyms such as "Full Name", "E-mail"). Optional: phone, check-in time, status.

```ts
export const normalizeEmail = (s: string) => s.trim().toLowerCase();

export const normalizeName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')
   .toLowerCase().replace(/[^a-z\s]/g, ' ')
   .split(/\s+/).filter(Boolean).sort().join(' ');   // order-insensitive

export function similarity(a: string, b: string): number {
  // 1 - levenshtein / max length, on normalized names
  const x = normalizeName(a), y = normalizeName(b);
  const m = x.length, n = y.length;
  if (!m && !n) return 1;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + (x[i-1] === y[j-1] ? 0 : 1));
  return 1 - dp[m][n] / Math.max(m, n);
}
```

Order of matching for each row:
1. Exact email match (primary or secondary email) gives **Matched**.
2. Otherwise best name similarity of 0.90 or more gives **Suggested** (admin must confirm).
3. Otherwise **Not found**.
4. Rows repeating an email or normalized name already seen in the same file are **Duplicate** (kept once).
5. Rows matching a Pending or Suspended person are flagged with a warning.

Confirming an upload: matched and confirmed people become Present (On time, or Late if the file has a time after the start); expected active people not in the file become Absent unless they have an approved excuse. Uploading again for the same meeting replaces earlier sheet-based records after a confirmation dialog. Every upload stores the original file, uploader, time and a one-click **Rollback**. Provide a downloadable template and a sample sheet with 3 deliberate errors (a misspelled name, an unknown email, a duplicate row).

### 6.5 Badges

Perfect Month (every meeting attended in a calendar month), On-time x10 (ten consecutive On time), Faithful Servant (90 percent or above for a quarter), Comeback (percentage up 15 points in 3 months), Service Star (20 volunteer hours in a month).

### 6.6 Excuses

Members submit a reason (and optional proof image or PDF) for a meeting from 7 days before to 7 days after it. Admin approves or declines with a note. Approved excuses set the record to Excused (removed from the denominator). Declined stays Absent.

### 6.7 Notification timing

Implement `dueNotifications(now, meetings, people, alreadySent)` as a pure function returning what to send in the current minute. Rules are in section 8. Deduplicate by key `${userId}:${meetingId}:${type}`.

---

## 7. Screens (complete specification)

Each screen lists route, purpose, content, interactions, and states. Build all of them. Items marked **(added)** go beyond the original brief and are required.

### 7.1 Public area

| Route | Screen | Specification |
| --- | --- | --- |
| `/` | Landing page | Full-width hero on `--grad-hero` with church photo overlay, logo, headline "Serving God with excellence, one clean space at a time", live countdown to the next meeting, two schedule cards (Saturday 9:30 am, Thursday prayer 8:30 pm), venue card with Leaflet map pinned at the Ikeja address and "Get directions" link, "How it works" in three steps (Join, Check in, Grow), three sign-in buttons (Member, Volunteer, Admin), photo strip, footer with address, privacy link and photo credits. **(added)** |
| `/login` | Sign in | Tabs for Member, Volunteer, Admin; demo-account quick fill chips in demo mode. |
| `/signup/member`, `/signup/volunteer` | Sign up | Multi-field form with validation, password meter, consent checkboxes. |
| `/accept-invite/[token]` | Admin invitation | Set password, scan QR for two-factor, enter six-digit code. |
| `/verify-email`, `/forgot-password`, `/reset-password/[token]` | Recovery | Simple centered cards with logo. **(added)** |
| `/pending` | Awaiting approval | Friendly illustration, what happens next, contact link. **(added)** |
| `/privacy` | Privacy and location notice | Plain-language explanation of location use, retention (12 months), data export and delete request. **(added)** |

### 7.2 Member area (`/member`)

**Shell:** blue accent. Bottom tabs on phone: Home, Check-in, Attendance, Alerts, More.

1. **Home dashboard** (`/member`)
   - CountdownHero for the next meeting with the primary button **Check in now** (enabled only inside the window; otherwise shows "Opens Saturday 8:30 am").
   - AttendanceRing (overall percentage and band name), three stat tiles: On-time rate, Current streak, Meetings attended this year.
   - Late warning banner after 9:30 am if not yet checked in.
   - Latest announcement card, next three events, assigned cleaning zone for Saturday if set.
   - Recent activity: last five meetings with status chips.
2. **Check-in** (`/member/check-in`)
   - Steps: permission prompt, locating (spinner with accuracy meter), result.
   - Map shows the venue pin, radius circle, and the member's position, plus distance in metres and GPS accuracy.
   - States: inside range (Confirm button), outside range (distance and "Get directions"), low accuracy ("Move outdoors and retry"), permission denied (how to enable), window not open or closed, already checked in, GPS unavailable (offer "Ask a marshal").
   - Success: status chip On time or Late, exact time, updated percentage animating, gold confetti once.
   - In demo mode show the Simulate time and Simulate location panel (section 10.5).
3. **My attendance** (`/member/attendance`): full history table (date, meeting, status, check-in time, method), filters (period, meeting type, status), 12-month heatmap, export my data as CSV.
4. **My performance** (`/member/performance`): monthly percentage line chart for 12 months, on-time rate, longest streak, comparison of Saturday vs Thursday, badges grid with locked and earned states. **(added)**
5. **Schedule and calendar** (`/member/schedule`): list and month calendar, filter by type, **Add to calendar** (.ics download, Google and Outlook links), cancelled and rescheduled markers. **(added)**
6. **Notifications** (`/member/notifications`): reminders, late notices, announcements, system messages; unread dot; mark all read; filter by type.
7. **Excuse requests** (`/member/excuses`): list with status (Pending, Approved, Declined, admin note), "New request" drawer with meeting picker, reason, optional proof upload. **(added)**
8. **Messages inbox** (`/member/messages`): messages from admins with search, read state, attachments.
9. **My report** (`/member/report`): choose period, preview, **Download PDF** statement with logo, percentages, and meeting list. **(added)**
10. **Help and guidelines** (`/member/help`): unit rules, lateness policy, what to bring, FAQs, how to contact an admin. **(added)**
11. **Profile and settings** (`/member/settings`): photo, details, time zone, language (English now, structure ready for French, Spanish and Yoruba), reminder channels (email, in-app, push), quiet hours, change password, **Privacy** panel (when location was used, request data export, request account deletion), install-app prompt.

### 7.3 Volunteer area (`/volunteer`)

**Shell:** teal accent. Everything in the member area is available under a "My member view" link; the volunteer home emphasizes duties.

1. **Home**: today or next-Saturday duty card (zone, team, supervisor, arrival time, supplies), upcoming events with RSVP buttons (Going, Maybe, Can't make it), AttendanceRing, service hours this month, pinned admin updates with "New" tag.
2. **Events and schedule** (`/volunteer/events`): feed of upcoming events and meeting times with date, time, venue, volunteers needed, countdown; updates posted by admins appear at the top; RSVP; add to calendar. This is the "regular updates of upcoming events" requirement.
3. **My attendance** (`/volunteer/attendance`): the same percentage, band, history and heatmap as members, computed by the same functions.
4. **Duty board** (`/volunteer/duties`): open tasks by zone (Sanctuary, Restrooms, Entrance, Kitchen, Outdoors) for the next Saturday, sign up, withdraw, request swap (Team Lead or admin approves). **(added)**
5. **Service hours** (`/volunteer/hours`): automatic hours from check-in, manual entries awaiting admin verification, monthly bar chart, yearly certificate PDF. **(added)**
6. **Report an issue** (`/volunteer/issues`): photo upload with preview, area, urgency (Low, Medium, Urgent), note; status tracker (Open, In progress, Resolved). **(added)**
7. **Marshal tools** (`/volunteer/marshal`, only with Check-in Marshal title): live present, late and expected lists with search, **Manual check-in** dialog (recorded with marshal name, shown as Manual, flagged for admin review), rotating QR code display. **(added)**
8. **Team view** (`/volunteer/team`, only with Team Lead title): team members with percentage, last five meetings, one-tap "Send encouragement" message. **(added)**
9. **Messages and settings**: same as member equivalents.

### 7.4 Admin area (`/admin`)

**Shell:** navy sidebar, gold accent, global date-range picker in the top bar that drives dashboard cards and reports.

1. **Dashboard** (`/admin`)
   - KPI row: Active members, Volunteers, Average attendance, On-time rate, Pending approvals, Open issues; each with change versus previous period.
   - Charts: 12-week attendance trend (line), Saturday vs Thursday (grouped bars), On time vs Late vs Absent (donut), attendance by team (horizontal bars), weekday and time heatmap.
   - Lists: At-risk (below 60 percent or three absences in a row, with Message button), Top 10 most consistent, New sign-ups, Upcoming meetings, Recent activity.
   - Quick actions: Upload sheet, Send message, Add member, Download report.
2. **Live Saturday board** (`/admin/live`): while the window is open, map with check-in dots, counters (Expected, Present, Late, Not yet), live list updating every 5 seconds in demo, filter by team, flagged check-ins highlighted. **(added)**
3. **Members directory** (`/admin/members`): search, filters (role, status, team, band, remote), bulk actions (message, assign team, suspend), **Add member** form, **Import CSV** with preview and error report, row menu (view, edit, suspend, remove with reason). Remove is a soft delete for 30 days.
4. **Pending approvals** (`/admin/approvals`): cards with details and verification status; approve, reject with reason, bulk approve. **(added)**
5. **Member profile** (`/admin/members/[id]`): header with percentage ring, attendance timeline, notes (admin only), titles, team, messages sent, excuse history, audit entries.
6. **Attendance upload** (`/admin/uploads`): upload wizard (see section 6.4): choose meeting, drop file, map columns, validation summary, match preview tabs (Matched, Suggested, Not found, Duplicates), resolve exceptions, confirm; upload history with rollback; download template and sample.
7. **Meetings and events** (`/admin/meetings`): calendar and list, create or edit (type, title, date, time, venue, tracking method, window, grace, geofence radius, recurrence), cancel or reschedule with automatic notifications.
8. **Reports and exports** (`/admin/reports`): pick period (this month, last month, quarter, year, custom), meeting type, team or person; report types (attendance register, member summary with percentage, late arrivals, absentees, volunteer hours, leadership one-pager); formats CSV, XLSX (with summary sheet) and PDF with logo; generation from the live records; history of past downloads. Files must actually generate.
9. **Performance analytics** (`/admin/analytics`): cohort comparison by sign-up month, punctuality trend, drop-off analysis, team leaderboards, filters. **(added)**
10. **Messaging center** (`/admin/messages`): compose with audience builder (Everyone, All members, All volunteers, A team, A percentage band, Absent last Saturday, Hand-picked), channels (in-app, email; SMS and WhatsApp shown as "coming soon"), merge fields (`{first_name}`, `{percentage}`, `{next_meeting}`), templates (welcome, reminder, congratulations, absence follow-up), rich text, attachments, preview as member, send now or schedule, delivery and read report. Also an **Announcements** tab to post pinned updates to the Events feed.
11. **Reminders and automation** (`/admin/automation`): table of all automated notifications with enable switch, timing, channel and template editor; escalation rule (after two consecutive absences notify the Team Lead); **Send test to me**; delivery log. **(added)**
12. **Roles and titles** (`/admin/roles`): assign primary role, admin level, titles; confirmation dialog describing what the person gains or loses; admin-level changes need Super Admin.
13. **Excuse requests** (`/admin/excuses`): queue with proof preview, approve or decline with note. **(added)**
14. **Duty roster and zones** (`/admin/duties`): drag-and-drop board of zones and teams for a chosen Saturday, auto-suggest by past assignments, publish to volunteers, handle swap requests. **(added)**
15. **Corrections and disputes** (`/admin/corrections`): flagged check-ins, manual check-ins and disputes; change a record only with a required reason; shows before and after. **(added)**
16. **Audit log** (`/admin/audit`): who, what, when, from where; filters; export. **(added)**
17. **Settings** (`/admin/settings`): venue pin on a map and radius, accuracy threshold, grace period, check-in window, percentage thresholds and late weight, reminder defaults, branding (logo, colors), retention, time zone, demo mode switch. **(added)**

---

## 8. Notifications and reminders

Channels: in-app (always), email (Phase 8 sender; HTML preview in dummy phase), web push (opt-in). SMS and WhatsApp are stubs.

| Key | When (Lagos time) | Channels | Audience | Message intent |
| --- | --- | --- | --- | --- |
| `SAT_DAY_BEFORE` | Friday 09:30 | Email, in-app, push | Active members and volunteers | Meeting tomorrow 9:30 am at the venue |
| `SAT_HOUR_BEFORE` | Saturday 08:30 | Email, in-app, push | Active, not yet checked in | Check-in is open; arrive before 9:30 am to be On time |
| `SAT_LATE_NOTICE` | Saturday 09:30 | In-app, push | Not yet checked in | Meeting started; check-in now counts as Late |
| `SAT_WINDOW_CLOSING` | Saturday 11:15 | In-app, push | Not yet checked in | Check-in closes at 11:30 am |
| `THU_DAY_BEFORE` | Wednesday 20:30 | Email, in-app, push | Active | Prayer meeting tomorrow 8:30 pm |
| `THU_HOUR_BEFORE` | Thursday 19:30 | Email, in-app, push | Active | Prayer starts at 8:30 pm |
| `THU_STARTING` | Thursday 20:30 | In-app, push | Active | Prayer is starting now |
| `ABSENCE_FOLLOWUP` | Sunday 09:00 | Email, in-app | Absent and not excused | Gentle check-in and link to submit an excuse |
| `WEEKLY_SUMMARY` | Sunday 18:00 | Email | Active | Your week and current percentage |
| `LOW_ATTENDANCE` | After a meeting drops someone below 60 percent | Email, in-app | That person, plus admin flag | Encouragement and offer to talk |
| `EVENT_DAY_BEFORE`, `EVENT_HOUR_BEFORE` | 24 hours and 1 hour before | Email, in-app, push | Invited audience | Special event reminders |
| Account events | Immediately | Email, in-app | The person | Approved, welcome, role change, reset, new device |

Rules:
- Reminder times derive from each meeting's start time, so rescheduling or cancelling moves or removes them.
- Deduplicate with a unique key per person, meeting and type. Retries use exponential back-off. Failures show in the delivery log.
- Meeting reminders and account emails cannot be turned off; weekly summary and nudges can. Quiet hours (22:00 to 06:00 local) apply only to optional messages.
- Times in messages are converted to the recipient's time zone, with the Lagos time in brackets.
- Templates support `{first_name}`, `{meeting_name}`, `{local_start_time}`, `{venue_address}`, `{checkin_link}`, `{percentage}`, `{band}`.
- Email layout: navy header with logo on a white pill, body in Plus Jakarta Sans, gold button, footer with address and link to notification settings. Build an `EmailPreview` component in the admin Automation screen.

Sample email (1 hour before Saturday):

> **Subject:** Sanitation Meeting starts at 9:30 am. Check in when you arrive.
> Hello {first_name}, the Saturday Sanitation Meeting starts in one hour at 7 Surulere Industrial Road, Off Adeniyi Jones, Ikeja, Lagos. Check-in is open now. Please arrive before 9:30 am so you are marked On time. Your attendance is currently {percentage} percent. Household of David Sanitation Unit.

---

## 9. Data model (Prisma schema)

Use this schema in Phase 8. In earlier phases, mirror the same shapes as TypeScript types and JSON seed data behind `src/lib/repo/interfaces.ts`.

```prisma
generator client { provider = "prisma-client-js" }
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  MEMBER
  VOLUNTEER
  ADMIN
}
enum AdminLevel {
  SUPER
  UNIT
  ATTENDANCE_OFFICER
  COMMS_OFFICER
  AUDITOR
}
enum UserStatus {
  PENDING
  ACTIVE
  SUSPENDED
  REMOVED
}
enum MeetingType {
  SATURDAY
  THURSDAY_PRAYER
  SPECIAL
}
enum TrackingMethod {
  GEO
  SHEET
  BOTH
}
enum MeetingStatus {
  SCHEDULED
  OPEN
  CLOSED
  CANCELLED
}
enum AttendanceStatus {
  ON_TIME
  LATE
  ABSENT
  EXCUSED
}
enum RecordMethod {
  GEO
  SHEET
  MANUAL
}
enum ExcuseStatus {
  PENDING
  APPROVED
  DECLINED
}
enum Channel {
  IN_APP
  EMAIL
  PUSH
  SMS
  WHATSAPP
}
enum NotifStatus {
  SCHEDULED
  SENT
  FAILED
  READ
}
enum Urgency {
  LOW
  MEDIUM
  URGENT
}
enum IssueStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
}
enum DutyStatus {
  ASSIGNED
  SWAP_REQUESTED
  SWAPPED
  DONE
}
enum UploadStatus {
  PREVIEW
  CONFIRMED
  ROLLED_BACK
}
enum MatchType {
  EMAIL
  NAME_SUGGESTED
  NOT_FOUND
  DUPLICATE
}

model User {
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  secondaryEmail String?
  phone         String?
  passwordHash  String
  role          Role     @default(MEMBER)
  adminLevel    AdminLevel?
  status        UserStatus @default(PENDING)
  isRemote      Boolean  @default(false)
  country       String?
  city          String?
  timezone      String   @default("Africa/Lagos")
  language      String   @default("en")
  avatarUrl     String?
  totpSecret    String?
  approvedAt    DateTime?
  lastLoginAt   DateTime?
  notifPrefs    Json     @default("{}")
  createdAt     DateTime @default(now())
  titles        UserTitle[]
  teamLinks     TeamMember[]
  records       AttendanceRecord[]
  excuses       ExcuseRequest[]
  notifications Notification[]
  duties        DutyAssignment[]
  hours         ServiceHour[]
  issues        IssueReport[]
  badges        UserBadge[]
  rsvps         EventRsvp[]
}

model UserTitle {
  id String @id @default(cuid())
  userId String
  title String           // TEAM_LEAD, ZONE_CAPTAIN, MARSHAL, SUPPLIES_KEEPER, WELCOME, PRAYER_COORDINATOR
  assignedById String?
  assignedAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id])
  @@unique([userId, title])
}

model Zone {
  id          String  @id @default(cuid())
  name        String  @unique
  description String?
  teams       Team[]
  duties      DutyAssignment[]
}

model Team {
  id         String  @id @default(cuid())
  name       String
  zoneId     String?
  leadUserId String?
  zone       Zone?   @relation(fields: [zoneId], references: [id])
  members    TeamMember[]
}

model TeamMember {
  teamId String
  userId String
  team   Team @relation(fields: [teamId], references: [id])
  user   User @relation(fields: [userId], references: [id])
  @@id([teamId, userId])
}

model Venue {
  id String @id @default(cuid())
  name String
  address String
  lat Float
  lng Float
  radiusM Int @default(100)
  meetings Meeting[]
}

model Meeting {
  id String @id @default(cuid())
  type MeetingType
  title String
  startsAt DateTime
  endsAt DateTime?
  venueId String?
  method TrackingMethod
  graceMinutes Int @default(0)
  openBeforeMin Int @default(60)
  closeAfterMin Int @default(120)
  status MeetingStatus @default(SCHEDULED)
  recurrenceRule String?
  requireQr Boolean @default(false)
  venue Venue? @relation(fields: [venueId], references: [id])
  records AttendanceRecord[]
  uploads AttendanceUpload[]
  duties DutyAssignment[]
  rsvps EventRsvp[]
  @@index([startsAt])
}

model AttendanceRecord {
  id String @id @default(cuid())
  meetingId String
  userId String
  status AttendanceStatus
  checkedInAt DateTime?
  method RecordMethod
  lat Float?
  lng Float?
  accuracyM Float?
  distanceM Float?
  deviceId String?
  flagged Boolean @default(false)
  flagReason String?
  sourceUploadId String?
  recordedById String?
  note String?
  meeting Meeting @relation(fields: [meetingId], references: [id])
  user User @relation(fields: [userId], references: [id])
  @@unique([meetingId, userId])
  @@index([userId])
}

model AttendanceUpload {
  id String @id @default(cuid())
  meetingId String
  fileUrl String
  originalName String
  uploadedById String
  status UploadStatus @default(PREVIEW)
  rowsTotal Int
  rowsMatched Int
  rowsException Int
  uploadedAt DateTime @default(now())
  rolledBackAt DateTime?
  meeting Meeting @relation(fields: [meetingId], references: [id])
  rows UploadRow[]
}

model UploadRow {
  id String @id @default(cuid())
  uploadId String
  rawName String
  rawEmail String?
  rawTime String?
  matchedUserId String?
  matchType MatchType
  similarity Float?
  resolution String?
  upload AttendanceUpload @relation(fields: [uploadId], references: [id])
}

model ExcuseRequest {
  id String @id @default(cuid())
  userId String
  meetingId String
  reason String
  proofUrl String?
  status ExcuseStatus @default(PENDING)
  reviewedById String?
  reviewNote String?
  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id])
}

model Notification {
  id String @id @default(cuid())
  userId String
  type String
  channel Channel
  title String
  body String
  scheduledFor DateTime
  sentAt DateTime?
  readAt DateTime?
  status NotifStatus @default(SCHEDULED)
  dedupeKey String @unique
  user User @relation(fields: [userId], references: [id])
  @@index([userId, readAt])
}

model Message {
  id String @id @default(cuid())
  senderId String
  subject String
  body String
  audience Json
  channels Channel[]
  scheduledFor DateTime?
  sentAt DateTime?
  recipients MessageRecipient[]
}
model MessageRecipient {
  id          String    @id @default(cuid())
  messageId   String
  userId      String
  deliveredAt DateTime?
  readAt      DateTime?
  message     Message   @relation(fields: [messageId], references: [id])
}

model Announcement {
  id        String   @id @default(cuid())
  title     String
  body      String
  pinned    Boolean  @default(false)
  authorId  String
  createdAt DateTime @default(now())
}

model EventRsvp {
  id        String  @id @default(cuid())
  meetingId String
  userId    String
  answer    String  // GOING, MAYBE, NO
  meeting   Meeting @relation(fields: [meetingId], references: [id])
  user      User    @relation(fields: [userId], references: [id])
  @@unique([meetingId, userId])
}

model DutyAssignment {
  id        String     @id @default(cuid())
  meetingId String
  zoneId    String
  userId    String
  status    DutyStatus @default(ASSIGNED)
  meeting   Meeting    @relation(fields: [meetingId], references: [id])
  zone      Zone       @relation(fields: [zoneId], references: [id])
  user      User       @relation(fields: [userId], references: [id])
}

model ServiceHour {
  id           String   @id @default(cuid())
  userId       String
  meetingId    String?
  hours        Float
  source       String   // AUTO or MANUAL
  verifiedById String?
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id])
}

model IssueReport {
  id           String      @id @default(cuid())
  reporterId   String
  area         String
  urgency      Urgency
  photoUrl     String?
  note         String
  status       IssueStatus @default(OPEN)
  resolvedById String?
  createdAt    DateTime    @default(now())
  reporter     User        @relation(fields: [reporterId], references: [id])
}

model Badge {
  id    String      @id @default(cuid())
  code  String      @unique
  name  String
  rule  String
  users UserBadge[]
}

model UserBadge {
  userId   String
  badgeId  String
  earnedAt DateTime @default(now())
  user     User     @relation(fields: [userId], references: [id])
  badge    Badge    @relation(fields: [badgeId], references: [id])
  @@id([userId, badgeId])
}

model Invite {
  id         String     @id @default(cuid())
  email      String
  adminLevel AdminLevel
  tokenHash  String
  expiresAt  DateTime
  usedAt     DateTime?
}

model AuditLog {
  id        String   @id @default(cuid())
  actorId   String?
  action    String
  entity    String
  entityId  String?
  before    Json?
  after     Json?
  ip        String?
  createdAt DateTime @default(now())
  @@index([createdAt])
}

model Setting {
  key   String @id
  value Json
}
```

---

## 10. Dummy data specification

### 10.1 Principles

Create deterministic generators in `src/data/seed/` using a seeded random function (mulberry32 with seed `20261106`) so that every run gives identical data. All emails use `example.com`. Show the **Demo data** ribbon whenever demo mode is on (environment flag `NEXT_PUBLIC_DEMO_MODE=true`, also switchable in Admin settings).

### 10.2 Volume

| Data | Amount |
| --- | --- |
| People | 64: 47 members, 12 volunteers, 5 admins (Super, Unit, Attendance Officer, Communications Officer, Auditor) |
| Zones | 5: Sanctuary, Restrooms, Entrance, Kitchen, Outdoors |
| Teams | 6, each with a lead and 8 to 12 people |
| Past meetings | 52: the 26 Saturdays and 26 Thursdays before 6 November 2026 (one Saturday cancelled) |
| Upcoming meetings | 3: Saturday 7 Nov 09:30, Thursday 12 Nov 20:30, Saturday 14 Nov 09:30; plus 2 special events (a Deep Clean Day and a Training Morning) |
| Attendance records | About 3,000, with distribution of roughly 62 percent On time, 15 percent Late, 17 percent Absent, 6 percent Excused |
| Messages | 12 (welcome, reminder, congratulations, absence follow-up, two announcements) |
| Notifications | 5 to 15 per person, mixed read and unread |
| Excuse requests | 8 across Pending, Approved, Declined |
| Issue reports | 10 across Open, In progress, Resolved |
| Duty assignments | 20 for the next Saturday and the following one |
| Uploads | 3 (two confirmed Thursday sheets and one in Preview with 3 exceptions) |
| Audit entries | 25 |
| Announcements | 4, one pinned |

### 10.3 Generation algorithm

1. Assign each person a **profile**: reliable (25 percent, attend probability 0.92), regular (35 percent, 0.82), casual (25 percent, 0.68), struggling (15 percent, 0.45).
2. For each person and each past meeting on or after their approval date, draw `u`. If `u < p` they attended; late probability by profile is 0.08, 0.15, 0.22, 0.35. If not attended, 26 percent become Excused and the rest Absent.
3. Stagger approval dates: 40 people approved 12 months ago, 14 people 6 months ago, 10 people within the last 8 weeks (to show short histories).
4. Thursday records are method SHEET and linked to the matching upload; Saturday records are method GEO with latitude and longitude jittered within 5 to 90 m of the venue and `accuracyM` between 5 and 35. A few Manual records by a marshal.
5. Plant the edge cases listed in 10.4, then compute percentages with the same functions used by the app.

### 10.4 Demo accounts (password for all: `Demo@2026`)

| Role | Name | Email | Planted state |
| --- | --- | --- | --- |
| Member | Adebayo Johnson | `member@hod-demo.example.com` | 88 percent, 6-meeting streak, 2 badges |
| Member (low) | Chioma Okafor | `chioma@hod-demo.example.com` | 52 percent (amber), low-attendance nudge, pending excuse |
| Member (gold edge) | Ngozi Eze | `gold@hod-demo.example.com` | exactly 90.0 percent |
| Member (just under) | Emeka Obi | `almost@hod-demo.example.com` | 89.7 percent |
| Member (new) | Tobi Martins | `new@hod-demo.example.com` | joined 3 weeks ago, 5 meetings, percentage starts at approval date |
| Remote member | Ruth Williams | `remote@hod-demo.example.com` | lives in London, marked Remote, Thursday sheet only |
| Volunteer | Grace Adeyemi | `volunteer@hod-demo.example.com` | 94 percent, Team Lead and Marshal, 31 service hours |
| Volunteer | Michael Danjuma | `volunteer2@hod-demo.example.com` | 71 percent, Supplies Keeper |
| Admin (Super) | Pastor Daniel Ojo | `admin@hod-demo.example.com` | full access |
| Admin (Attendance Officer) | Esther Bamidele | `attendance@hod-demo.example.com` | uploads and exports only |
| Admin (Comms Officer) | Joshua Akande | `comms@hod-demo.example.com` | messaging only |
| Admin (Auditor) | Naomi Fashola | `auditor@hod-demo.example.com` | read-only |
| Pending | Samuel Bello | `pending@hod-demo.example.com` | in the approval queue |
| Suspended | Victor Nwosu | `suspended@hod-demo.example.com` | cannot sign in; shows suspended message |

Pin the percentages above through profile overrides and add a unit test asserting each lands within 0.5 of the target.

Other names: mix common Nigerian and international names (Tobi, Ngozi, Emeka, Funke, Ruth, Michael, Esther, Joshua, Amara, Daniel, Naomi, Samuel, Blessing, Peter, Mercy, Victor, Kemi, David, Tolu, Sarah, Ife, Hannah, Segun, Precious) with surnames such as Adeyemi, Okafor, Johnson, Eze, Bello, Williams, Obi, Martins, Akande, Fashola, Danjuma, Bamidele, Ojo, Nwosu, Lawal, Ibrahim, Mensah, Smith.

### 10.5 Scenario coverage and demo helpers

- A flagged check-in (accuracy 48 m and device shared with another account) waiting in Corrections.
- One cancelled Saturday that does not change anyone's percentage.
- An upload in Preview with exactly 3 exceptions: a misspelled name ("Adebayo Jonhson"), an unknown email, and a duplicate row.
- Pending approvals: 4 people. Open issues: 3 Urgent.
- **Simulate time** control (demo only): jump to Saturday 08:25, 09:20, 09:31 and 11:20, and Thursday 19:30 and 20:31. Changing it re-evaluates windows, reminders and countdowns instantly.
- **Simulate location** control: At the venue (distance 25 m), 2 km away, Poor accuracy (120 m), GPS unavailable.
- Downloadable sample sheets in `src/data/sample-sheets/`: `thursday-clean.csv`, `thursday-with-errors.csv`, `thursday-with-errors.xlsx`, matching the seeded people.

---

## 11. API outline

REST under `/api/v1`, JSON, session cookie, Zod validation on every body and query. Before Phase 8, route handlers call the json-mock repository so the front end already uses real HTTP calls.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/signup`, `/auth/login`, `/auth/logout`, `/auth/forgot`, `/auth/reset`, `/auth/verify-email`, `/auth/accept-invite`, `/auth/2fa/verify` |
| Me | `GET, PATCH /me`; `GET /me/stats`; `GET /me/attendance?from&to&type`; `GET /me/report.pdf`; `GET, POST /me/excuses`; `GET /me/notifications`; `PATCH /me/notifications/:id/read`; `PATCH /me/preferences`; `POST /me/data-export`; `POST /me/delete-request` |
| Meetings | `GET /meetings?upcoming=true`; `GET /meetings/:id`; `GET /meetings/:id/calendar.ics`; `POST /meetings/:id/rsvp` |
| Check-in | `POST /meetings/:id/check-in` body: latitude, longitude, accuracy, deviceId, optional qrToken. Response: status, time, distance or a rejection code from section 6 |
| Volunteer | `GET, POST /duties`; `POST /duties/:id/swap`; `GET, POST /hours`; `GET, POST /issues`; `GET /team/stats` |
| Marshal | `GET /meetings/:id/live`; `POST /meetings/:id/manual-check-in`; `GET /meetings/:id/qr` |
| Admin members | `GET, POST /admin/members`; `GET, PATCH, DELETE /admin/members/:id`; `POST /admin/members/:id/approve`; `POST /admin/members/import`; `PATCH /admin/members/:id/role` |
| Admin attendance | `POST /admin/uploads`; `GET /admin/uploads/:id/preview`; `POST /admin/uploads/:id/confirm`; `POST /admin/uploads/:id/rollback`; `PATCH /admin/attendance/:id` (reason required) |
| Admin reports | `GET /admin/dashboard?from&to`; `GET /admin/reports?from&to&type&format=csv,xlsx,pdf`; `GET /admin/analytics` |
| Admin comms | `POST /admin/messages`; `GET /admin/messages/:id/delivery`; `GET, PATCH /admin/automation`; `POST /admin/automation/test` |
| Admin system | `GET, PATCH /admin/settings`; `GET /admin/audit`; `GET, PATCH /admin/excuses`; `GET, POST, PATCH /admin/meetings`; `GET, PUT /admin/roster` |
| Cron | `POST /cron/notifications` (protected by `CRON_SECRET`, runs every minute) |

Rules: every admin route checks the caller's admin level; every write creates an audit entry; every list supports pagination, search and sort; errors return `{ error: { code, message } }`.

---

## 12. Security, privacy and environment

- Passwords hashed with Argon2; HTTP-only, same-site, secure cookies; CSRF protection; rate limits on sign-in, sign-up, forgot password and check-in; account lockout after 5 failures.
- Server-side authorization on every page and endpoint. Two-factor required for admins.
- Uploads: CSV and XLSX only, 5 MB maximum, parsed in memory, never executed; neutralize formula injection (prefix cells that start with `=`, `+`, `-`, `@`) in all exports.
- Location is read only when the person presses Check in. Store coordinates, accuracy, distance and time for that moment only. Delete location values older than 12 months by default (settings).
- Personal data handling aligned with the Nigeria Data Protection Act 2023 and, for members elsewhere, rules such as GDPR. Provide data export, deletion request, consent records and a plain-language privacy page. Note in `docs/DECISIONS.md` that final wording must be confirmed by qualified counsel.
- Append-only audit log. Nightly encrypted backups (Phase 8 runbook). No personal data in logs. Content Security Policy and security headers.
- Environment variables (list in `.env.example`): `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DEMO_MODE`, `RESEND_API_KEY`, `EMAIL_FROM`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `STORAGE_BUCKET`, `STORAGE_KEY`.

---

## 13. Testing and quality gates

| Type | What to cover |
| --- | --- |
| Unit (Vitest) | Status boundaries (08:29:59, 09:29:59, 09:30:00, 09:30:01, 11:30:01), grace period, haversine distances, accuracy and radius, percentage formulas including the worked example (89.5 and 82.4), late weight 0.5, bands, mid-year joiner, cancelled meetings, excuse handling, name and email matching (typo, order swap, accents, duplicates), notification schedule per meeting type and reschedule or cancel, permission matrix, seed targets for demo accounts |
| Component | AttendanceRing bands, StatusChip, CheckInPanel states, UploadWizard exceptions, AudienceBuilder counts |
| End-to-end (Playwright) | Sign-in per role; member Saturday check-in (On time, Late, out of range, low accuracy); volunteer sign-up for a duty; marshal manual check-in; admin approves a member; admin uploads the error sheet, resolves exceptions, confirms and rolls back; exports download and open; message sent to a percentage band reaches exactly those people; role guard blocks cross-area access |
| Quality | Lighthouse 90 or higher for performance and accessibility on Home, Check-in and Admin Dashboard; axe checks with no serious violations; responsive screenshots at 360, 768, 1024 and 1280 px |
| Commands | `npm run lint`, `npm run typecheck`, `npm run test`, `npm run e2e`, `npm run build` must pass before every commit |

---

## 14. Phased execution plan

Do each phase fully, run the commands in section 13, commit, and summarize.

| Phase | Name | Deliverables | Commit message |
| --- | --- | --- | --- |
| 0 | Foundation and design system | Scaffold, tokens, fonts, logo and photos in place, all core components, `/design-system` page in light and dark, AppShell with Sidebar and BottomNav, `CLAUDE.md` containing project summary, commands, folder map and the rule "business rules live in `src/lib` only", `docs/DECISIONS.md` | `feat: foundation and design system` |
| 1 | Data, rules and logic | Types, repository interface, json-mock repository, deterministic seed (section 10), all pure functions in section 6 with unit tests, simulated clock, demo helpers | `feat: dummy data and business rules` |
| 2 | Public pages and auth | Landing, login, sign-up, accept-invite, recovery, pending, privacy; mock auth with the demo accounts, role guards and redirects | `feat: public pages and authentication` |
| 3 | Member area | All screens in 7.2, check-in flow with simulate controls, PDF report, .ics download | `feat: member area` |
| 4 | Volunteer area | All screens in 7.3 including duty board, hours, issues, marshal, team | `feat: volunteer area` |
| 5 | Admin core | Shell, dashboard, members, approvals, profile, roles and titles, audit log, settings | `feat: admin core` |
| 6 | Admin operations | Upload wizard, meetings, live board, corrections, excuses, roster, reports with real CSV, XLSX and PDF generation, analytics | `feat: admin operations and reports` |
| 7 | Messaging and notifications | Messaging center, announcements, automation screen, scheduler logic, templates, email preview, in-app notification center wired to the scheduler | `feat: messaging and notifications` |
| 8 | Real backend | Prisma with PostgreSQL behind the same repository interface, Auth.js with Argon2 and TOTP, REST handlers, Resend sender, cron route with queue and retries, file storage, seed command, `.env.example`, demo mode flag retained | `feat: real backend` |
| 9 | Polish and launch | Responsive and accessibility pass, PWA and offline queue, Playwright suite, Lighthouse fixes, `README.md`, `USER-GUIDE.md`, `RUNBOOK.md`, deployment configuration, go-live checklist (verify venue pin on site, send a test reminder, confirm privacy text) | `chore: polish, tests and launch prep` |

---

## 15. Definition of done (acceptance checklist)

**Attendance rules**
- [ ] Saturday check-in at 09:29:59 inside the radius is On time; at 09:30:01 it is Late.
- [ ] Check-in 2 km away is refused with the distance shown; accuracy worse than 50 m asks for a retry; before 08:30 and after 11:30 are refused with clear messages.
- [ ] The worked example in section 6.3 displays 89.5 percent and 82.4 percent.
- [ ] Approved excuse turns Absent into Excused and raises the percentage; a cancelled meeting changes nothing; a mid-year joiner's percentage starts at their approval date.

**Sheet upload**
- [ ] Exact email matches are accepted; the misspelled name appears as Suggested and needs confirmation; unknown email and duplicate appear as exceptions and can be resolved.
- [ ] Re-uploading for the same meeting replaces earlier sheet records without double counting; rollback restores the previous state.

**Roles and access**
- [ ] Member cannot open admin or volunteer-only pages; volunteer without Marshal title cannot see Marshal tools; Communications Officer cannot open Settings; Auditor cannot change anything.
- [ ] Pending and suspended accounts cannot sign in and see the right message.

**Notifications**
- [ ] With simulated time, reminders fire at Friday 09:30, Saturday 08:30, Wednesday 20:30 and Thursday 19:30, exactly once each; late notice reaches only people not checked in; rescheduling and cancelling move or remove reminders.

**Admin outputs**
- [ ] CSV, XLSX and PDF exports open correctly, match on-screen numbers, and carry the logo and date range.
- [ ] Messages reach exactly the chosen audience and the delivery log lists each recipient.
- [ ] Every admin write appears in the audit log.

**Design and quality**
- [ ] Logo, gradients, fonts and photos match section 3 on every screen, in light and dark mode.
- [ ] No horizontal scroll at 360 px; keyboard reaches every action; status never relies on color alone.
- [ ] Lighthouse 90 or higher for performance and accessibility on the three key screens.
- [ ] Every screen has loading, empty, error and success states.

---

## 16. Open questions (defaults are already built in)

1. Saturday lateness: confirm 9:30 am start and whether a grace period (for example 10 minutes) is wanted.
2. Thursday prayer: in person, online, or both? Should members be able to self-check-in online?
3. Remote members outside Lagos: should Saturday attendance be sheet-based, self-reported, or excluded?
4. Venue pin and radius: verify the exact coordinates on site; is 100 m right?
5. Check-in window: keep 08:30 to 11:30, or follow the actual cleaning end time?
6. Late weighting: full (default) or half credit?
7. Excuses: who approves and is proof required?
8. Languages beyond English: French, Spanish, Yoruba?
9. Extra channels: WhatsApp or SMS reminders?
10. Data ownership and which countries' privacy rules apply.

---

## 17. First message to send in Claude Code

After placing this file in the project root as `HOD-BUILD-PROMPT.md`, start Claude Code in the project folder and send:

```text
Read HOD-BUILD-PROMPT.md completely. Then execute Phase 0 and Phase 1 exactly as specified, run the checks in section 13, commit, and give me a short summary and the command to start the app so I can review it in the browser. Do not start Phase 2 until I reply "continue".
```

After each review, reply `continue` to move to the next phase, or describe changes you want first.
