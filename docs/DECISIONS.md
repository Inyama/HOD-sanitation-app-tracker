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

The demo world is anchored on Friday 6 November 2026 (spec section 0). In demo mode the clock starts on that date at the current Lagos time of day and keeps ticking, so the demo behaves the same whichever day it is opened.

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
