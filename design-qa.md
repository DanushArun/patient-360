# CareThread reference implementation — 1 October 2026

## Source and implementation
- Visual source: /Users/aaa/Documents/sitar/output/CareThread.html
- Reference capture: /Users/aaa/Documents/sitar/artifacts/browser/carethread-desktop.png (1440 × 1000).
- Implementation: http://localhost:3000/design-preview/PAT-DC-09
- Live component: web/app/patient/[id]/patient-client.tsx
- Both reference and rendered desktop implementation were emitted together for comparison in the browser-tool output.
- Implementation captures are inline conversation evidence; no standalone screenshot file was saved.
- Desktop CSS viewport: 1440 × 1000. Mobile: 390 × 844.

## Fidelity
Reused the exact supplied SVG logo mark with SAARTHI branding. Implemented the
248px roster sidebar, 74px breadcrumb bar, heading placement, identity card,
three summary cards, tab underline, attention cards, 338px evidence assistant,
serif assistant heading, suggestion controls, and composer.
Source colors, spacing and type sizes are recorded in web/app/carethread.css.
Existing clinical status words, glyphs and border patterns remain unchanged.

## Intentional differences
All clinical values come from patient-360. Reference demo patients, documents,
counts, upload/export features and invented activity were not imported.
The preview uses only frontend/fixtures/daycare_census_recorded.json, labels its
recorded timestamp, and disables AI/service requests and clinical actions.
Missing consent and source pages are labelled unavailable. No live route silently
falls back to fixture data. Live record and task APIs are unchanged.
The original supported timeline and family checklist remain available; unsupported
reference tabs were not introduced.

## Checks and iterations
- Production build and TypeScript passed.
- Desktop patient selection updated both identity and patient-specific gates.
- Timeline fixture absence displayed an explicit empty state.
- Browser error log returned no errors.
- First mobile pass found horizontal navigation overflow (1289px document in a
  390px viewport). Fixed inherited flex wrapping and constrained sidebar children.
- Post-fix mobile capture and DOM geometry showed document width 390px.
- Desktop full-view comparison showed matching major-region alignment, logo,
  typography hierarchy, card rhythm and assistant placement. Content length and
  fixture disclosure deliberately change some vertical positions.

## Remaining validation
Connected live patient records, AI answers, source retrieval, and task persistence
cannot be verified until Snowflake is configured. Standalone normalized screenshot
files have not been saved. The populated design preview is available for review.

final result: blocked

The visual preview is implemented and browser checked. Full connected-workflow QA
remains blocked by missing Snowflake configuration.
