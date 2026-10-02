# Designer-to-implementation traceability

Checked 2 October 2026 against `acceptance.json`, the current storyboard journey and
implementation/tests. The acceptance manifest still marks every S, X and G item `pending`,
`parent_reviewed: false`, with no evidence entries. This is a crosswalk, not a release sign-off.

## Evidence limits

- `dashboard-design/patient-360-notion-design-2026-10-01/authoring/journey.json` and the
  stage prompts/images supply the latest in-repository storyboard. I also reviewed the supplied
  one-page PDFs at `/Users/danusharun/Downloads/SAARTHI_Information_Architecture_One_Page.pdf`
  and `/Users/danusharun/Downloads/SAARTHI_User_Flow_One_Page.pdf`.
- `S04/X3 recorded preview preserves identity and cutoff` and other browser checks use the
  recorded synthetic preview. They prove rendered UI behavior on that fixture, not an
  authorized live Snowflake journey. Source/helper tests prove bounded code contracts, not
  that the deployed procedures return real data or that source text is clinically validated.
- `planning/dashboard-release/README.md` records live data access and end-to-end evidence as
  incomplete. The family checklist now renders returned SQL checks and reasons. Heading-only language
  translation is disclosed; reviewed full translations and live handoff remain open. The
  next-day update and successful task-result storyboard plates are proposed synthetic states;
  they are not live proof.
- The IA PDF defines two cross-patient destinations (Day-care list and Review queue), one
  persistent selected-patient context, and patient lanes for records/evidence, Ask, tasks/history,
  and visit preparation. The later storyboard expands that context into seven labeled sections.
  Keep one workspace shell and patient identity across those sections. The user-flow PDF keeps
  reload/recompute, evidence verification, task read-back, and clinical judgment as separate
  transitions.

## Journey crosswalk

| ID | Designer intent → implementation | Exact evidence and owner | Remaining gap |
|---|---|---|---|
| S01 | Day care worklist → `web/app/page.tsx`, `web/app/census-search.tsx`, `web/components/patient-roster.tsx` | E2E: `S01/S13 unavailable live workspaces expose recovery`; `test_worklist_when_service_unavailable_does_not_claim_zero_counts`; frontend | Live authorized worklist and storyboard's eight-row mix are not demonstrated by preview. |
| S02 | Aligned Visits comparison table → `web/app/census-search.tsx` | E2E: `X1 roster switching replaces patient identity, cutoff, and evidence together`; frontend | Current E2E does not assert every storyboard column, sorting, or filter restoration. |
| S03 | Authorized patient search → `web/components/patient-roster.tsx`, `web/app/census-search.tsx` | E2E: `workspace roster stays readable, searchable, and selected on desktop`; `X1 roster switching replaces patient identity, cutoff, and evidence together`; frontend | Search filters returned worklist identities; no separate live search/ambiguous-match browser proof. |
| S04 | Patient context first → `web/components/workspace-patient-overview.tsx`, `web/components/workspace-patient-screen.tsx` | E2E: designer overview structure; `S04/X3 recorded preview preserves identity and cutoff`; `X1 roster switching replaces patient identity, cutoff, and evidence together`; frontend | Preview only; live identity authorization and consent binding are not established by these browser tests. |
| S05 | Facts, units and provenance → `web/components/workspace-patient-data.tsx`, `/api/patient/[id]/workspace?view=facts` | Unit: `fact reads use only an allowlisted domain and return the governed envelope`; frontend/workflow | No browser evidence for populated live domains, source links, or ANC derivation. Empty/missing data must remain explicit. |
| S06 | Three-clock timeline → `web/app/patient/[id]/patient-timeline.tsx`, workspace timeline read | Current route renders returned timeline clocks; no exact S06 browser test; frontend/workflow | No live timeline/source-return proof; scheduled future visits must remain separate from received history. |
| S07 | Document inventory and expected missingness → `web/components/workspace-patient-data.tsx`, `/api/patient/[id]/workspace?view=documents` | Unit: `document detail is scoped by its bound id and fixed as-of cutoff`; frontend/workflow | No browser test proving a populated list or missing final report from live data. |
| S08 | Exact source page beside claim → workspace document detail and `web/app/patient/[id]/patient-evidence.tsx` | Document API helper test above; no browser test selecting and returning from a real evidence page; frontend/workflow | Returned page text is not proof of a rendered PDF highlight tied to source coordinates. No live source artifact verified. |
| S09 | Coverage conflict visible → patient Coverage section in `workspace-patient-views.tsx` and governed facts | Facts envelope helper test; frontend/workflow | No live two-source conflict demonstrated. Do not choose a date or infer a coverage amount in UI. |
| S10 | Compare source dates/values → selected evidence in `patient-evidence.tsx` and document detail | No named E2E comparison test; frontend/workflow | Side-by-side comparison with actual original letter remains unproven. |
| S11 | Bounded task draft → `web/components/task-actions.tsx`, `web/app/patient/[id]/patient-evidence.tsx` | Unit: `test_receipt_rejects_empty_readback`; `test_receipt_reports_uncertain_save_when_readback_fails`; frontend/workflow | UI draft-to-submit browser flow and retained-draft retry are not covered by current E2E names. |
| S12 | Server-confirmed receipt/replay → `web/lib/write-receipts.mjs`, task route/history | Unit: `test_receipt_confirms_persistence_when_readback_matches`; `test_receipt_rejects_readback_with_changed_version`; frontend/workflow | No live persisted task/replay browser evidence; synthetic storyboard receipt is illustrative only. |
| S13 | Review queue → `web/app/review-queue/review-queue-client.tsx`, `web/lib/review-queue.mjs` | E2E: `S01/S13 unavailable live workspaces expose recovery`; unit: `queue preserves exact source identity, rule, reason and timestamp`; frontend/workflow | No E2E proving populated authorized queue, assignment, or closure; unavailable state is not a zero queue. |
| S14 | Patient review history → `web/app/patient/[id]/patient-review-history.tsx` and review evidence panel | Write-receipt tests above; no named history E2E; frontend/workflow | No live history or next-day rule version transition proof. |
| S15 | Contextual Ask with corpus boundary → `web/components/workspace-patient-copilot.tsx`, patient workspace panel | E2E: `X4 accepts reference scope explicitly and rejects mixed scope`; frontend/workflow | No browser proof that Ask opens/closes from every section or source citation replaces the single panel. |
| S16 | Cited answer → copilot answer artifact and `patient-evidence.tsx` | Unit: `test_answer_when_frozen_contract_valid_is_accepted`; `fabricated citations are stripped before reaching SQL validation`; frontend/workflow | No live cited answer/source round trip. Preview has no patient turns; helper acceptance is not rendered evidence. |
| S17 | Class A refusal and practitioner packet offer → copilot routing, `recordPatientAnswer`, and `prepareEvidencePacket` workflow | Local tests cover named-practitioner refusal, blank/whitespace context rejection, access-error propagation, and no reference search; workflow SQL tests: `evidence packet recipients require active patient consent`; frontend/workflow | Fixture-only context. No live YJ28449 practitioner/consent binding or refusal read-back is proven. A prepared packet is not delivered. |
| S18 | Family evidence checklist and clipboard-only feedback → `web/components/workspace-patient-family.tsx` | Final clipboard E2E checks cover exact SQL text, copy success, and denied clipboard recovery; frontend | Pure record tests reject unsupported all-clear and clinical timing. Reviewed full translations and live packet handoff remain unproved; clipboard is not delivery or approval. |
| S19 | Next-day updated overview → live patient data route and patient header | No E2E exercises a later live snapshot; frontend/workflow | Storyboard's 2 Oct updated authorization is synthetic. No UI may hardcode it or claim the SQL recomputation occurred. |
| S20 | Return to same worklist → census page and browser history | Worklist storage tests: `test_worklist_when_restored_preserves_view_filter_and_scroll`; `test_worklist_when_saved_round_trips_current_state`; frontend | Storage helper proof does not establish an end-to-end return preserving actual live selection/filter/scroll. |
| S21 | Distinct loading, empty, error, access-revoked states → page, patient client, API purge handling | E2E: `X1/S21 live patient route hides fixture content when unavailable`; `S01/S13 unavailable live workspaces expose recovery`; `test_worklist_when_service_unavailable_disables_patient_selection`; frontend/workflow | Browser proves unavailable response behavior, not an actual consent revocation during every in-flight request. |
| S22 | Responsive, keyboard-visible workspace → `workspace-patient-screen.tsx`, `workspace-shell.css` | E2E: `X1/S22 keyboard navigation keeps a visible focus indicator`; `S22 workspace has no horizontal overflow at 1024px`; same at `390px`; `test_workspace_when_897px_wide_keeps_patient_context_visible`; frontend | Overflow/focus checks do not prove 44px touch targets, 200% zoom, screen-reader source reading, or full mobile source-return flow. |

## Cross-cutting workflow checks

| ID | Requirement and evidence | Owner | Remaining gap |
|---|---|---|---|
| X1 | Identity/access: `X1 roster switching replaces patient identity, cutoff, and evidence together`; `X1/S21 live patient route hides fixture content when unavailable`; patient response race/purge helper tests | workflow/frontend | Browser route is synthetic or unavailable; no real role/consent revoke session verified. |
| X2 | Visits/availability: `test_visit_date_when_scheduled_value_has_date_date_label_is_included`; `test_worklist_when_service_unavailable_does_not_claim_zero_counts` | workflow/frontend | No live appointment availability/visit cohort evidence; do not invent appointment status. |
| X3 | Evidence quality: `S04/X3 recorded preview preserves identity and cutoff`; `document detail is scoped by its bound id and fixed as-of cutoff`; `test_stored_artifact_when_citation_is_missing_rejects_unsupported_answer` | workflow/frontend | Synthetic fixture and contract tests only; extraction agreement/live citation truth not proven in browser. |
| X4 | Question/service errors: `X4 ask endpoint rejects malformed and array request bodies`; `X4 ask endpoint enforces its request byte cap`; `X4 accepts reference scope explicitly and rejects mixed scope`; chat lifecycle tests | workflow | No live provider/Snowflake question-answer journey; error tests do not establish provider availability. |
| X5 | Persistence/concurrency: `X5 review writes reject requests without an Origin header`; `X5 same-origin writes accept the default 127.0.0.1 development host`; `X5 review writes reject a foreign Origin`; write-receipt and worklist-storage tests | workflow | Origin/idempotency/readback contracts are not a live DB persistence/replay demonstration. |
| X6 | Handoff/language: two named clipboard E2E tests above; family checklist component | workflow/frontend | No navigator review persistence or packet handoff; current evidence is clipboard-only. |

## G6 visual fidelity and AI-slop rejection record

The designer's own hard rejects are concrete: no KPI/status-card grid, gradients/glass, decorative
icon backgrounds, repeated card template, permanent empty evidence rail, seven equally-weighted
tabs, generic hero slogans, nested cards, decorative sparklines, stock avatars/mascots, invented
clinical conclusions, missingness-as-negative, mixed patient/reference results, or unsupported
write controls. The approved structure is one patient page with Overview/Facts/Timeline/Documents,
then Coverage/Review/Family; contextual Ask and one evidence panel; distinct board, table, record,
timeline, source, comparison, and conversation layouts.

Observed repairs recorded in the task review: the prior inherited `carethread.css` layout made
roster navigation row-oriented and left a large blank gap; the replacement workspace shell makes
the roster/sidebar intentional. Unavailable service responses previously risked looking like zero
patients or a successful refresh; recovery UI now disables search/selection and states the list is
unavailable. Recorded preview's authoritative cutoff is 23 September 2026; storyboard dates are
not valid live fixture data. Earlier mobile truncation of patient identity/cutoff and the dead
evidence-preview action were flagged for repair; this document does not treat those visual reviews
as proof of completed live evidence rendering.

G6 status remains pending in `acceptance.json`: its design gate is a manual self-review, not
independent designer acceptance. The record-only repair passed local tests. Final browser suite: 26/26; the complete live
journey and independent designer acceptance remain pending. No release acceptance is claimed.
