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
