# SAARTHI homepage and chat composer design

## Goal

Give the census homepage a clearer, calmer work-queue layout and make the patient-page
composer feel as polished as ChatGPT while staying within SAARTHI's existing visual system.
The design combines Apple's restrained hierarchy and spacing with ChatGPT's direct, low-friction
question entry.

## Scope

- Redesign only the Next.js root route (`web/app/page.tsx`) layout.
- Redesign only the patient-page composer in `web/app/patient/[id]/patient-client.tsx`.
- Preserve all existing data, copy, status vocabulary, date grouping, links, loading and error
  behavior, session storage, backend routes, and safety rules.
- Keep the Streamlit reference and the rest of the patient page unchanged.
- Add no homepage search, filters, new actions, metrics, or data sources.

## Selected approach

Three directions were considered:

1. **Prioritized work queue (selected):** compact readiness counts, then visit-day groups with
   blockers first and patient rows as the main content.
2. Search-first landing page: puts a new natural-language census search at the center. Rejected
   because it adds a capability beyond the requested layout change.
3. Status overview: makes readiness categories the main dashboard and puts the patient list
   second. Rejected because it delays the coordinator's next action.

The selected work queue follows the existing product rule that the unbound home state is the
upcoming day-care list, sorted by readiness urgency. It uses whitespace, clear typography, and
quiet separators instead of multiple competing card treatments.

## Homepage structure

1. Retain the existing SAARTHI masthead and practitioner context in a quieter, tighter header.
2. Present each visit day as a clear section heading.
3. Place that day's five readiness counts in one compact summary row, retaining the existing
   order and labels: Ready, Advisory, Waiting, Conflict, Blocked. Keep words and counts legible
   without large boxed metric cards.
4. Make each patient an aligned, spacious row: identity and regimen together; readiness status
   and reason together; the existing `Open` action at the trailing edge.
5. Keep blocker-first ordering and existing date grouping from `buildCensus`.
6. Keep “Also under your care” visually secondary to the upcoming visits.
7. Preserve the existing empty and Snowflake-error states.

At narrow widths, rows stack in the same reading order and the action remains easy to reach.

## Patient chat composer

Use one docked composer surface aligned to the patient conversation column. Remove the current
stack of visible dock, input, and button borders. At rest, show one soft rounded surface with a
single low-contrast outline. On keyboard or pointer focus, strengthen that outline and show a
clear focus ring. Keep the input transparent within the surface and place the send action inside
its trailing edge as a high-contrast, circular control. Use the existing send label for
accessibility and retain the current placeholder, fixed position, max width, submit handling, and
loading-disabled behavior.

The composer remains visually quiet until focused. The focus state must be obvious and meet
existing keyboard focus visibility requirements. No chat semantics, text, network behavior, or
patient scope changes.

## Data flow and safety

No data or server behavior changes. The homepage continues using `fetchCensus` and `buildCensus`.
The composer continues calling the existing `/api/ask` route with the current patient ID and
question, and the server continues binding the patient before executing the request. The agent
still receives only the question.

## Validation

- Run TypeScript checking and a production webpack build.
- Inspect the root page and patient composer in the running Next.js app at desktop and narrow
  viewport sizes.
- Verify keyboard focus, submit enabled/disabled state, and that existing patient links, counts,
  reasons, and empty/error states still render.
- Review the final screenshot for hierarchy, border clutter, and alignment with the existing
  patient-page design.
