# Decisions log

Choices made where `HOD-BUILD-PROMPT.md` is silent or where the build environment forced a change. Newest phase last.

## Phase 0: foundation and design system

### Stack versions

- **Next.js 16.4.5 with React 19.3, Tailwind CSS 4, shadcn/ui (Radix base, "nova" preset).** This is what `create-next-app@latest` produced on 6 Nov 2026. Cache Components and Partial Prefetching are on (the new defaults).
- **Cache Components and time.** Luxon reads the current time internally, which Next refuses during a static prerender. Client trees that use the clock or Luxon in render are wrapped in `<Suspense>` with a skeleton fallback (`PageSkeleton`). This is the framework's recommended fix and also gives every page a loading state.
- **`cn` helper.** The current shadcn CLI generates `cn` from the `cn` package (a drop-in, faster replacement for `clsx` + `tailwind-merge`). `clsx`, `tailwind-merge` and `class-variance-authority` from the spec are still installed; `class-variance-authority` is used for variants.
- **SheetJS** is installed from the official SheetJS CDN tarball (`xlsx-0.20.3`) because the npm `xlsx@0.18.5` package is outdated and has published security advisories.
- **next-themes** added for the light, dark and system theme toggle.
- **`@types/node` 24** instead of 20, required by Vitest 5's peer range.

### Colours and logo

- Colours sampled from `HOD-logo.webp`: navy `#263472` and red `#d31a21`. The logo is navy and red, not gold. The spec tokens (navy, gold, teal) were **kept** because the spec defines role accents around them; the two logo colours were added as `--hod-logo-navy` and `--hod-logo-red` (red is used for the unread badge).
- **Added for contrast:** `--gold-700 #85600f` (5.7:1 on white) and `--teal-700 #0f766e` (5.5:1) for gold and teal _text_ on light surfaces. `--gold-500` and `--teal-500` fail AA as text on white, so they are used for fills, rings and on-navy accents only.
- Role buttons: Member royal 600 with white text (8.7:1), Volunteer teal 700 with white text, Admin gold 500 with navy text (7.4:1).
- Status chips use a tint background plus a dark text colour (all above 7:1), an icon and a word.
- Chart series colours (`--series-1..4`: royal, ochre, teal, violet) were checked with a colour-blind-safety validator in light and dark; all adjacent pairs pass. Status colours (green, amber, red, blue) always ship with an icon or label, because green and amber are close for protanopia.
- The logo artwork has a white-filled ellipse, so it is shown full colour on navy too, without a white pill.
- Icons (favicon, apple-touch, PWA 192, 512 and maskable) were generated from the logo with Pillow.

### Imagery

Photo downloads were blocked by the build environment, so every photo slot renders branded gradient and pattern art (`PhotoCard` reads `public/images/photos/photos.json`). Nothing links to a missing file. To add real photos, save each file in `public/images/photos/`, then fill `file`, `photographer`, `sourceUrl` and `license` in `photos.json`; credits then appear automatically. Photos to add (Unsplash or Pexels, free licence, no identifiable church members):

| Slot                  | Search for                                             |
| --------------------- | ------------------------------------------------------ |
| `church-interior`     | bright modern church interior, empty seats, warm light |
| `volunteers-cleaning` | volunteers cleaning a hall together                    |
| `sparkling-floor`     | sparkling clean floor reflecting window light          |
| `cleaning-supplies`   | cleaning supplies arranged neatly                      |
| `team-aprons`         | team in matching aprons                                |
| `city-sunrise`        | sunrise over a city skyline (Lagos if available)       |
| `mop-bucket`          | hands holding a mop and bucket                         |
| `clean-lobby`         | clean modern entrance lobby                            |

### Layout and components

- Buttons are 44 px tall on touch devices (`pointer-coarse`), with compact sizes only on fine pointers. Inputs and select triggers are 44 px.
- Rounded "pill" buttons, matching the reference screenshots.
- The heatmap uses one tab stop with arrow-key navigation (roving tabindex) rather than 100+ tab stops, and puts a small glyph in each square so status is not colour alone.
- Every chart has a "Table" toggle showing the numbers, plus a legend for two or more series.
- The phone bottom bar shows four destinations and "More" (spec allows 4 or 5).
- `/` is a temporary build-preview page until the landing page in Phase 2.

### Demo clock

~~Originally the demo clock was pinned to Friday 6 November 2026 at the current Lagos time of day.~~ **Changed on 7 November 2026:** that made the landing countdown disagree with the date it displayed once the real date moved on (on Saturday 7 November it counted a full extra day to "Sat 7 Nov, 9:30 am"). The app clock now uses the **real time** by default; the seeded history still ends on 6 November. Demo "Simulate time" presets on `/dev/data` move the clock deliberately, and "Back to real time" resets it. Weekly Saturday and Thursday meetings beyond the seeded ones are generated from the recurring rules (`withRecurringMeetings` in `src/lib/time/schedule.ts`), so there is always a next meeting to count down to; stored rows (for example a cancelled Saturday) always win. Phase 6 will persist generated meetings when admins manage the schedule.

## Phase 1: data, rules and logic

### Business rules

- **Name similarity uses optimal string alignment** (Levenshtein plus adjacent transposition counted as one edit) instead of plain Levenshtein. With plain Levenshtein, "Adebayo Jonhson" vs "Adebayo Johnson" scores 0.867 and would be Not found, which contradicts the acceptance checklist ("the misspelled name appears as Suggested"). With transpositions it scores 0.933. The 0.90 threshold is unchanged.
- **Which meetings count:** held (start time not in the future), not cancelled, on or after `approvedAt`, **and with a record**. A held meeting with no record yet (for example a Thursday whose sheet is still in Preview) is pending and not counted. Absent records are written when a meeting closes (window end for geolocation, confirmation for sheets); that job arrives with the admin screens.
- **Streaks:** consecutive attended (On time or Late) meetings ending at the latest counted one. Excused neither adds to nor breaks a streak.
- **At risk:** below 60 percent, or three absences in a row (excused skipped). Both are settings.
- **Badges:** Perfect Month needs a completed calendar month with at least 4 counted meetings, all attended (Excused is not attended). On-time x10 is ten consecutive On time (Excused skipped; Late or Absent breaks the run). Faithful Servant needs a completed calendar quarter with at least 8 counted meetings at 90 percent or more. Comeback compares the last 3 months with the 3 before (at least 6 meetings in each, +15 points). Service Star needs 20 verified hours in a calendar month; automatic hours from check-in count as verified.
- **Perfectly round coordinate** (anti-spoofing) means both latitude and longitude have three or fewer decimal places; real GPS fixes carry five or more.
- **Excuse decisions** never downgrade an attended record. Approval turns Absent (or not yet recorded) into Excused.
- **Sheet confirmation** ignores Suggested and Not found rows until the admin resolves them, never counts Duplicates, and expects active people approved before the meeting start. Re-uploading deletes earlier SHEET records for that meeting only; geolocation and manual records are kept.
- **Sheet times** are read as Lagos wall-clock time on the meeting date ("20:41", "8:41 pm", "20:41:10" or a full ISO timestamp).

### Notifications

- Meeting reminders go to every **active** person (admins included, because they also attend), except Saturday-only messages, which skip Remote members.
- Optional messages are the weekly summary, the absence follow-up and the low-attendance nudge. Only these respect the "nudges" and "weekly summary" preferences and quiet hours. A message that lands in quiet hours is deferred to the end of quiet hours in the recipient's zone.
- Push is opt-in. In-app is always on. Email cannot be turned off for meeting reminders.
- The absence follow-up fires on the Sunday 09:00 after a Saturday meeting. Thursday absences are not followed up, because sheets may arrive later.
- The scheduler's dedupe key is `userId:meetingId:type` as specified. Stored `Notification` rows append the channel (`:IN_APP`, `:EMAIL`), because one reminder produces one row per channel and `dedupeKey` is unique. The weekly summary uses `week-<ISO week>` in place of a meeting id.

### Permissions (admin levels)

The spec's matrix says "Yes" for admins on several rows, but also describes narrow demo roles ("uploads and exports only", "messaging only", "read-only"). `src/lib/auth/permissions.ts` reconciles them:

| Capability                                                    | Super | Unit | Attendance Officer | Comms Officer | Auditor |
| ------------------------------------------------------------- | ----- | ---- | ------------------ | ------------- | ------- |
| Unit statistics, directory, team view                         | Yes   | Yes  | Yes                | Yes           | Yes     |
| Download reports                                              | Yes   | Yes  | Yes                | No            | Yes     |
| Uploads, corrections, excuse review, marshal tools            | Yes   | Yes  | Yes                | No            | No      |
| Meetings, duty roster, issues, hours verification             | Yes   | Yes  | No                 | No            | No      |
| Add, approve, suspend, remove people; assign roles and titles | Yes   | Yes  | No                 | No            | No      |
| Change admin levels                                           | Yes   | No   | No                 | No            | No      |
| Messaging                                                     | Yes   | Yes  | No                 | Yes           | No      |
| Settings and automation                                       | Yes   | No   | No                 | No            | No      |
| Audit log                                                     | Yes   | Yes  | No                 | No            | Yes     |

The Auditor holds no write capability (tested). Volunteers get Marshal tools only with the Check-in Marshal title, and Team view only with the Team Lead title. Pending, Suspended and Removed accounts hold nothing.

### Data model and repository

- Types in `src/lib/repo/types.ts` mirror the Prisma schema, with dates as ISO strings. Fields added that Phase 8 must carry into the schema: `User.statusChangedAt`, `User.statusReason`, `User.consentLocationAt`, `User.consentRemindersAt`, `Venue.verified`, `Meeting.statusNote`, `ServiceHour.note`. Composite-key models (`TeamMember`, `UserBadge`) have a synthetic `id` in the mock.
- The json-mock repository is **in memory**. It is rebuilt from the deterministic seed when the server starts, keeps changes for the life of the process (also across dev hot reloads), and can be reset. Filters are equality and "in" lists only, so they map directly to Prisma.
- Mock passwords are stored as a marker (`demo-plain:Demo@2026`). Phase 8 stores Argon2 hashes.
- A Unit Admin demo account was added (**Funke Lawal**, `unit@hod-demo.example.com`), because the spec requires five admins, one per level, but lists only four demo admins.

### Dummy data

- Approval cohorts: 40 people approved about 12 months ago (October and early November 2025), 14 about 6 months ago (early May 2026; Emeka later, so exactly 41 meetings count for him), 6 within the last 8 weeks (Tobi on 16 October) and 4 pending.
- The 52 past meetings span only the last 26 weeks, so the 12-month and 6-month cohorts both see the full history.
- **Thursday 5 November is in Preview** (the upload with exactly 3 exceptions), so it has no records yet, and 50 meetings count for long-standing members. Planted percentages are computed on those 50.
- Only the two confirmed uploads (22 and 29 October) are linked from Thursday records. Older Thursday records have no `sourceUploadId`, because the spec asks for 3 uploads in total.
- Generated records total about 2,700 (spec: about 3,000), because pending and recently approved people have short histories. Distribution: 64 percent On time, 12 percent Late, 18 percent Absent, 6 percent Excused.
- Grace's 31 service hours are 13 Saturdays since 1 August at 2 automatic hours each, plus 5 verified manual hours. Automatic hours start on 1 August 2026, when the hours feature is assumed to have launched.
- Special events: Training Morning on Tuesday 17 November 2026 at 10:00 (sheet), and Deep Clean Day on Saturday 28 November 2026 at 07:30 (geolocation).
- The cancelled Saturday is 15 August 2026 ("venue maintenance").

### Review page

`/dev/data` (demo mode only) shows the seed and evaluates the rules at the simulated time through `GET /api/v1/demo/summary?at=`. Only this demo endpoint accepts a time from the client; real endpoints use the server clock (spec 6.2).

### Privacy

Final wording of the privacy notice and consent text must be confirmed by qualified counsel (Nigeria Data Protection Act 2023, plus GDPR for members abroad).

## Phase 2: public pages and authentication

### How sign-in works (mock phases)

- **Session:** a signed (HMAC-SHA256) HTTP-only, same-site cookie `hod_session` holding the user id, role, admin level, titles, issue time, expiry and last activity. Members and volunteers: 30 days. Admins: ended after 8 hours without activity (the proxy slides the activity stamp at most every 5 minutes). "Remember this device" makes the cookie persistent; otherwise it is a browser-session cookie with the same server-side expiry. Phase 8 replaces this with Auth.js behind the same helpers.
- **Two layers of protection.** `src/proxy.ts` (Next 16's renamed middleware) does fast checks from the cookie alone: signed out, expired or idle sends you to `/login?next=…&tab=…`, and a wrong area (for example a member opening `/admin`) sends you to `/forbidden`. Every page then calls `requirePage(path)`, which reloads the person from the repository and applies the full permission matrix, including titles and admin levels. Hiding navigation is only a convenience.
- **Forbidden page:** a redirect to `/forbidden?path=…`, because `forbidden()` is still experimental in Next 16.
- **Login tabs** must match the account: the Admin tab is for admins only (then a two-factor code), admins cannot use the Member or Volunteer tabs, and the Volunteer tab is for volunteers. Each case gets a specific message.
- **Error messages** are specific but safe: an unknown email and a wrong password give the same message. Pending, unverified, suspended and rejected states are revealed only after the correct password.
- **Lockout:** 5 failed attempts within 15 minutes lock that email for 15 minutes from the fifth failure. This also applies to emails that do not exist, so lockout cannot be used to discover accounts. Wrong two-factor codes count as failures too.
- **Rate limits** per IP address (in memory): sign-in 30 per minute, sign-up and resend 10 per 10 minutes, forgot password 10 per 10 minutes, two-factor 10 per 10 minutes.
- **Rejected applicants** are stored as `REMOVED` with a `statusReason` starting "Rejected", because the schema has no Rejected status. They see a polite message with a contact link.
- **New-device email:** a long-lived `hod_device` cookie identifies the browser. A sign-in from a device not yet seen for that account sends a "New sign-in" email. Known devices are held in memory for now.
- **Passwords** are hashed with scrypt (node:crypto) in the mock phases; Phase 8 moves to Argon2 and can rehash on next sign-in. Seeded demo accounts use a `demo-plain:` marker that is accepted only in demo mode.
- **Two-factor (TOTP):** implemented with node:crypto per RFC 6238 (tested against the RFC vectors), so `otplib` is not needed. In demo mode any six digits are accepted, as the spec says.
- **Signing secret:** `AUTH_SECRET` (32+ characters). A built-in fallback is used only in demo mode or development; production without demo mode refuses to sign.

### Sign-up, verification and recovery

- **Sign-up does not reveal registered emails.** If the email already has an account, the response is the same and that address gets a "you already have an account" email instead.
- Sign-up stores country, city, preferred language, unit code and both consents (with timestamps). The time zone is guessed from the country and can be changed later in Settings. Volunteers also give zones of interest, availability and notes (`User.signupDetails`).
- Both consents are required, because Saturday attendance depends on check-in location and meeting reminders cannot be turned off.
- Only English is selectable; French, Spanish and Yoruba are listed as "coming soon".
- **Email verification** links are signed tokens valid for 48 hours. **Password reset** links last 1 hour and stop working once the password changes, because they embed a fingerprint of the current password hash.
- **Admin invitations** are stored as SHA-256 hashes of the token. The demo invite `/accept-invite/demo-invite-2026` (Communications Officer) is seeded with an expiry far in the future so the demo keeps working; `/accept-invite/demo-invite-expired` shows the expired state. Real invitations last 7 days.
- `User` gained `emailVerifiedAt` and `signupDetails`; one seeded pending volunteer has not verified their email.

### Email in demo mode

- Emails go through an `EmailSender` interface. The console sender logs one line (recipient domain only) and keeps the full message in an in-memory outbox at `/dev/outbox`, where the links can be opened. Phase 8 adds the Resend sender.
- The branded HTML layout (navy header, logo on a white pill, gold button, footer with address and settings link) lives in `src/lib/notifications/email-layout.ts` and will be reused by the Automation screen's email preview.

### Public pages

- The landing countdown fetches the public schedule (`GET /api/v1/meetings?upcoming=true`, which returns only schedule fields) and picks the next meeting with the browser's simulated demo clock.
- The map uses Leaflet with OpenStreetMap tiles and a custom gold pin, loaded only in the browser. The address is always printed beside it, and "Get directions" opens Google Maps.
- Protected areas show working placeholders for screens built in later phases. Each placeholder runs the same permission guard, so access rules can already be tested.
- Server-rendered screens use the real time (see "Demo clock" above). Session expiry and lockouts always use real time.

### Next.js 16 notes

- Code that reads the session calls `connection()` after `cookies()`. Without it, Partial Prefetching pre-renders protected pages with cookies but forbids clock reads, which logged errors on prefetch.
- React Compiler lint rejects react-hook-form's `watch()`, so forms use `useWatch()`.

### Testing

- Playwright runs with one worker, because every spec talks to the same in-memory demo server and the auth flows change its state. `POST /api/v1/demo/reset` (demo only) restores the seed before the auth spec.

## Phase 3: member area

- **Simulate time reaches the server (demo mode only).** The browser saves the simulated clock in the `hod_clock` cookie (`ClockSync`), and the server's `serverNow()` / `nowForRequest()` honour it, so check-in windows match what the screen shows. Outside demo mode the cookie is ignored (spec 6.2).
- **Time presets** are worked out from the real date: the coming Saturday (until its window closes) and Thursday.
- **Early check-ins count straight away:** a meeting that has not started counts once the person has checked in On time, so the percentage updates on success.
- **Weekly meetings not yet stored** are created in the repository on first use (check-in, excuse, RSVP, calendar file).
- **Remote members** skip Saturday check-in; their check-in page offers the next in-person event instead.
- **Uploads** (excuse proofs, profile photos) are checked by file signature, limited to 2 MB, and kept in memory until Phase 8 storage. Seeded proofs point to `public/files/sample-proof.pdf`.
- **PDF statements** use @react-pdf with the logo as PNG bytes (WebP is not supported).
- **Account deletion requests** set `User.deletionRequestedAt` (new field) and are logged; an admin confirms them in Phase 5.
- **Messages** gained an optional `attachments` list; the Deep Clean message carries `public/files/deep-clean-checklist.pdf`.

## Phase 4: volunteer area

- **Zone capacities and arrival times** (`src/lib/volunteer/zones.ts`): Sanctuary 5, Restrooms 3, Entrance 3, Kitchen 3, Outdoors 4. Entrance and Kitchen arrive 30 minutes early; the other zones arrive 15 minutes early. Each zone lists its supplies and tasks.
- **One duty per Saturday.** The board shows the next two Saturdays. Assigned, swap-requested and done duties hold a spot; a swapped duty frees it.
- **Withdrawing** is allowed up to 12 hours before the meeting. After that the volunteer asks for a swap, and the Team Lead of their team (or an admin with duty rights) approves or declines it. Both decisions are audited.
- **Automatic hours:** when a volunteer checks in for a Saturday or special meeting (by phone or manually), the meeting's length is logged once as verified service hours. Thursday prayer meetings do not count.
- **Manual hours** cover the last 60 days, 0.5 to 12 hours per entry, and wait for admin verification. The year certificate counts verified hours only.
- **Marshal manual check-in** is only for people on the expected list while the window is open. The marshal can't check themselves in this way. The record is marked Manual, flagged for admin review, and audited with the marshal's name.
- **The rotating QR code** changes every 30 seconds and links to the member check-in page with the code filled in.
- **Encouragement** goes to one person at most once every 24 hours. It arrives as a message and an in-app notification.
- **Volunteers needed** on Events: open duty spots for Saturdays; for special events, 20 minus the people going.
- **Shared screens:** Attendance, Messages and Settings are the same server components (`src/components/screens`) under `/member` and `/volunteer`, each with its own permission check.

## Phase 5: admin core

- **Global date range.** The top-bar picker (presets: last 4 or 12 weeks, this month, last month, this quarter, this year, or custom Lagos dates) is stored in the `hod_range` cookie, so it follows the admin from page to page. Custom ranges stop at today and are at most two years long.
- **"Change versus previous period"** compares with the period just before: the previous calendar month, quarter or year for calendar presets, and a period of the same length for rolling and custom ranges. Attendance and on-time figures pool every counted person-meeting of active people (spec 6.3 rules per person). Head counts (active members, volunteers, pending) compare the count at the end of each period. Open issues compare reports made in each period, because issues do not record when they were resolved.
- **Dashboard lists.** At risk and Top 10 use each person's whole history (like their own screens); Top 10 needs at least 8 counted meetings. The arrivals heatmap shows check-ins by meeting day and minutes from the start, in 15-minute slots, with the count printed in every cell.
- **Members.** Admins added by hand or by CSV import are active at once and get a welcome email with a 7-day link to choose a password. Imports show a preview and a line-by-line error report; valid rows can be imported while the rest are fixed. Remove is a soft delete: the account can be restored for 30 days (declined sign-ups cannot). Suspend and remove need a reason, which goes to the audit log. Only a Super Admin can act on another admin's account, and nobody can act on their own.
- **Approvals.** Approving sends the "approved" email and an in-app welcome. Declining needs a reason (kept in the audit log, not sent) and sends a polite email. Approval is allowed before the person confirms their email; they can sign in once they do. Account deletion requests (Phase 3) are confirmed or declined here; confirming is a soft delete.
- **Admin notes** are a new `MemberNote` table, visible to admins only. The audit records that a note was written, not its text.
- **Roles and titles.** The confirmation lists what the person gains or loses, worked out from the permission matrix. Titles are for volunteers; a volunteer who becomes a member loses their titles and their upcoming duty spots. Admin roles and levels need a Super Admin, the unit always keeps one Super Admin, and admins cannot change their own role.
- **Becoming an admin is by invitation only** (two-factor must be set up). A Super Admin invites from Roles and titles; if the email already belongs to an active member or volunteer, accepting the invitation turns that account into an admin account.
- **Settings.** One save; the audit entry keeps only the fields that changed, with before and after. Accuracy, the geofence and percentage rules apply at once. Grace and window minutes are the defaults for new meetings (existing meetings keep their own values; Phase 6 edits them). Moving the venue pin clears "Pin confirmed on site". Meeting rules always run in Lagos time; the unit time zone is for reports and emails. Demo mode follows `NEXT_PUBLIC_DEMO_MODE`, so the settings page explains it and offers "Restore the demo data" instead of a switch that could turn demo tools on in the live app.
- **Quick messages.** `POST /api/v1/admin/messages` already sends to hand-picked people (in-app and email, `{first_name}` filled in), used from the dashboard, the directory and profiles. Phase 7 adds audiences, templates and scheduling to the same endpoint.
- **Instant navigation (Cache Components).** Every page in the member, volunteer and admin areas has a `loading.tsx` next to it, because the dev check requires a `<Suspense>` boundary at each page's own segment for client navigations. The page fade is now a CSS animation, and the attendance ring always starts empty, so reduced-motion browsers hydrate without mismatches.
- **Scroll areas are positioned** (`relative`) so screen-reader-only text inside them cannot stretch the page.
- **Dev store versioning.** The in-memory repository on `globalThis` carries a schema version; bump `SCHEMA_VERSION` when tables change so a running dev server rebuilds it after a hot reload.

## Phase 6: admin operations

- **Closing a meeting writes the absentees.** When a location meeting's check-in window ends, everyone expected without a record becomes Absent, or Excused with an approved excuse, and the meeting is marked Closed (`src/lib/attendance/close.ts`). The scheduler does this for meetings whose window ends while it is running (it looks back at most 15 minutes). Older meetings that were never closed (for example the Saturdays after the seed ends, if nobody opened the app) are **not** closed automatically, so a server that was off, or a demo opened weeks later, never marks the whole unit absent; an admin closes them from Meetings ("Close and record absentees"). Sheet meetings close when their upload is confirmed.
- **Meetings.** Weekly meetings are still generated from the rules; any change (edit, cancel, reschedule, a check-in) saves that week's row, and a saved row always wins. A meeting can be edited, moved or cancelled only before it starts; after that, attendance is corrected instead. Editing keeps the date and time (Reschedule moves them). Cancelling and rescheduling need a reason, which is included in the in-app notice and email to everyone expected (Saturday notices skip Remote members). Reminders follow automatically because they are worked out from each meeting's start. New meetings can repeat weekly for up to 12 weeks; a week that already has a saved Saturday or Thursday meeting is refused (edit that one instead). Each meeting can override the geofence radius (50 to 300 m) and require the rotating code.
- **Live board.** Shows the meeting whose window is open, otherwise the next one, and lets the admin pick any location meeting from two weeks back to one week ahead. It refreshes every 5 seconds in demo mode while check-in is open (15 seconds in the live app, every minute otherwise). The map shows positions only for check-ins with a location; the list beside it is the text alternative.
- **Uploads.** The wizard detects the columns, then lets the admin change the mapping before matching. Not found rows can be assigned to a person by hand; Suggested rows must be confirmed or skipped before confirming. Starting a new preview for a meeting replaces an older unconfirmed preview for the same meeting. A confirmed upload that replaced an earlier sheet keeps those records, so **rolling it back restores the earlier sheet** (and marks that upload Confirmed again). Seeded uploads have no stored file, so "Original file" rebuilds a CSV from their rows.
- **Excuses.** Approving a held meeting's absence makes it Excused at once. Approving an excuse for a meeting that has not happened yet is applied when the meeting closes or its sheet is confirmed. Declining needs a note, which is sent to the member.
- **Corrections and disputes.** Every change needs a reason (sent to the person and kept in the audit with before and after), marks the record Manual and clears its flag. "Looks fine" clears a flag without changing the record. Members can query one of their records for 30 days after a meeting (`POST /api/v1/me/disputes`, new `AttendanceDispute` table); accepting a query corrects the record, declining keeps it, and both send the member a note.
- **Duty roster.** The board covers the next four Saturdays. Suggestions rank volunteers by how often they served in that zone, then their team's zone, then the fewest duties so far; people who answered "Can't make it" or have an approved excuse are left out. Nothing is saved until the admin adds suggestions. Publishing (new `Meeting.rosterPublishedAt`) sends each volunteer their zone and arrival time by email and in the app; after publishing, each change is sent to the person affected. Drag and drop has a keyboard alternative (each name has a "Move to" menu).
- **Reports.** Every download is generated from the live records when clicked and is written to the audit log; "Past downloads" reads those entries and can download the same report again. The register's PDF shows totals only when a period has more than 26 meetings (the XLSX always has every meeting). Reports use the global date range by default, with the presets plus custom dates.
- **Analytics.** Cohorts are people grouped by approval month (last 12 months). Drop-off lists active people whose last 30 days are at least 20 points below the three months before. Leaderboard hours count automatic and verified manual hours.
- **Range helper.** `recurringBetween` returns every saved meeting whatever its date (plus the generated weeks in the range); `meetingsBetween` keeps only meetings that start in the range, and is what the screens use.

## Phase 7: messaging and notifications

- **One scheduler run, three triggers.** `runScheduler` (`src/lib/notifications/runner.ts`) covers the time since its last run (at most 15 minutes back, only the current minute after a restart or when the demo clock moves backwards). It closes meetings whose check-in ended, sends scheduled messages, sends due reminders, escalates repeated absences and retries failed emails. It is triggered by `POST /api/v1/cron/notifications` every minute in the live app (protected by `CRON_SECRET` as a Bearer token, always real time), by "Run the scheduler now" on the Automation screen, and in demo mode by the signed-in shell every 30 seconds and right after "Simulate time" moves the clock (`POST /api/v1/demo/tick`, at the simulated time). Overlapping runs wait for each other, and dedupe keys (`userId:meetingId:type`) make every reminder go out once.
- **Delivery log.** A new `Delivery` table records every attempt per person and channel (in-app, email, push), with status, attempts and the last error. Failed emails are retried after 1, 2, 4 and 8 minutes and then given up (five tries); the email content is kept for the retries. Web push is logged as Skipped until Phase 9 adds the service worker and VAPID keys. The seed adds rows for its weekly-summary emails, one of them a permanent bounce, so the log shows what a failure looks like.
- **Automation settings** live in `AppSettings.automation` (missing means the defaults): each notification type can be switched off, its email or push switched off, and its subject, title and wording overridden ("Use the built-in wording" removes the override). Timings stay as spec 8 sets them, because they follow each meeting's start; the screen shows the next seven days of reminders so the effect of a reschedule is visible. Members still cannot turn off meeting reminders; the admin switches apply to everyone.
- **Escalation rule.** On, after 2 absences in a row (adjustable 2 to 10). It runs with the Sunday absence follow-up: each absent person who reached the threshold is reported once to the Team Lead of each of their teams (in-app and email, unless that lead turned email off), never to themselves.
- **Low attendance.** Checked when a location meeting closes and when a sheet is confirmed: anyone who drops below the threshold (60 percent by default) gets the encouraging note once per meeting (it respects their nudges switch), and Super and Unit Admins get one in-app flag listing them.
- **Messages.** The audience is worked out when the message goes out, by the same `resolveAudience` the composer uses for its live count, so a scheduled message reaches whoever matches at that time. Only active people receive messages; emails respect each person's email switch. Merge fields (`{first_name}`, `{percentage}`, `{band}`, `{next_meeting}`) are filled per person. Messages can be scheduled up to 60 days ahead (Lagos time) and cancelled until they go out. SMS and WhatsApp show as "coming soon".
- **Rich text** is a small, safe subset (bold, italic, bullets, links to http(s), mailto or app paths) parsed into blocks and rendered as React or escaped HTML; raw HTML is never rendered, so pasted text cannot inject markup.
- **Attachments** use the same file upload (PDF or image, 2 MB, up to 5). People who received a message can open its attachments.
- **Announcements** can be pinned, edited and deleted, and optionally notify everyone in the app. In the notification center an announcement that was also sent as a notification shows once, with its read state.
- **Notification bell.** Every role's bell now opens the notification center at `/member/notifications` (admins receive in-app notices too: tests, low-attendance flags). It previously pointed admins to Automation, which only Super Admins can open.
- **Meeting change notices** (cancelled, rescheduled) and duty notices are filed under Reminders in the notification center; excuse decisions, corrections and escalations under System.
