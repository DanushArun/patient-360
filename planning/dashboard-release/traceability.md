# Designer-to-frontend traceability

All 22 steps are exercised by frontend/tests/e2e/storyboard-visual.spec.ts.

Parent reviewed references and captures; live integration remains unverified.

| Step | Designer screen | Implementation | Capture | Data-dependent difference |
|---|---|---|---|---|
| 01 | Doctor opens Day care | frontend/app/census-search.tsx | Counts and readiness labels follow returned SQL; no treatment clearance is inferred. | Counts and readiness labels follow returned SQL; no treatment clearance is inferred. |
| 02 | Compare visits in a table | frontend/app/visit-table.tsx | v2 is the latest available image. The journey names v3, but no v3 image was supplied. | v2 is the latest available image. The journey names v3, but no v3 image was supplied. |
| 03 | Search authorized patients | frontend/components/patient-search.tsx | Authorized display selection uses returned patient IDs; name is not an identity join. | Authorized display selection uses returned patient IDs; name is not an identity join. |
| 04 | Establish the patient context | frontend/components/workspace-patient-overview.tsx | ABHA and active-consent status are not inferred from absent fields. Source dates retain their supplied zone. | ABHA and consent badges appear only when governed data supports them. Source dates retain their zone. |
| 05 | Inspect structured facts and provenance | frontend/components/workspace-patient-facts.tsx | Source links and expanded provenance consume returned facts; normalized values are not invented. | Source links and expanded provenance consume returned facts; normalized values are not invented. |
| 06 | Read the record chronology | frontend/app/patient/[id]/patient-timeline.tsx | Three-clock sorting is implemented; historical rule reconstruction requires backend snapshots. | Three-clock sorting is implemented; historical rule reconstruction requires backend snapshots. |
| 07 | Inspect received and expected documents | frontend/components/workspace-patient-data.tsx | Received files and expected records remain separate; preliminary is not automatically superseded. | Received files and expected records remain separate; preliminary is not automatically superseded. |
| 08 | Trace the platelet check to its source | frontend/app/patient/[id]/patient-evidence.tsx | Exact excerpt and clocks render from verified matching source_spans. Backend propagation remains required. | Selected SQL rule and evidence IDs are displayed. Exact CBC coordinates require backend mapping; the full source-page viewer is implemented separately. |
| 09 | Read coverage without hiding disagreement | frontend/components/workspace-patient-coverage.tsx | Benefit amounts and reconciled dates are not invented when missing from the response. | Benefit amounts and reconciled dates are not invented when missing from the response. |
| 10 | Compare the disagreeing authorization sources | frontend/components/workspace-authorization-comparison.tsx | Structured and source values remain side by side, with supplied span coordinates and clocks. | Structured and source values remain side by side, with supplied span coordinates and clocks. |
| 11 | Prepare the bounded follow-up | frontend/components/review-task-draft.tsx | Task draft is unsaved until submitted; cancel performs no write. | Task draft is unsaved until submitted; cancel performs no write. |
| 12 | Confirm the recorded follow-up | frontend/components/review-task-feedback.tsx | Success is shown only for confirmed receipt/read-back. Task save does not change readiness. | Success is shown only for confirmed receipt/read-back. Task save does not change readiness. |
| 13 | See follow-up work and its evidence state | frontend/app/review-queue/review-queue-view.tsx | Board groups actual task states; unresolved SQL checks remain after a task closes. | Board groups actual task states; unresolved SQL checks remain after a task closes. |
| 14 | Follow the next-day evidence update | frontend/app/history/[id]/history-client.tsx | Before/after rule comparison consumes optional validated changes; absent history is stated explicitly. | Before/after rule comparison consumes optional validated changes; absent history is stated explicitly. |
| 15 | Open the copilot in patient context | frontend/components/workspace-patient-copilot.tsx | Patient/reference scopes remain separate; reference browsing needs a supplied viewer endpoint. | Patient/reference scopes remain separate; reference browsing needs a supplied viewer endpoint. |
| 16 | Verify the copilot's answer | frontend/app/patient/[id]/patient-answer-artifact.tsx | Only a validated typed artifact is exposed. Raw model prose stays hidden. | Only a validated typed artifact is exposed. Raw model prose stays hidden. |
| 17 | Handle a clinical-judgment question | frontend/components/evidence-packet-preview.tsx | The packet preview is explicitly a draft at the answer cutoff. Final persisted contents belong to the server. | The packet preview is explicitly a draft at the answer cutoff. Final persisted contents belong to the server. |
| 18 | Prepare a family bring-list | frontend/components/workspace-patient-family.tsx | Bring-list uses returned expected records. Only headings have reviewed translations; this limitation is visible. | Bring-list uses returned expected records. Only headings have reviewed translations; this limitation is visible. |
| 19 | Read the updated patient snapshot | frontend/components/use-patient-record.ts | No image was supplied. Checked against the prompt and journey: new cutoff, superseded letter, unchanged platelet issue. | No image was supplied. Checked against the prompt and journey: new cutoff, superseded letter, unchanged platelet issue. |
| 20 | Continue with the next patient | frontend/app/census-search.tsx | No image was supplied. Prior Visits view/filter restoration is verified; no fake completion banner is added. | No image was supplied. Prior Visits view/filter restoration is verified; no fake completion banner is added. |
| 21 | Recover safely when data or access changes | frontend/components/route-loading.tsx | Fallback reference is the prior failure sheet. Actual recovery is shown in the appropriate context, not as simultaneous demo panels. | Fallback reference is the prior failure sheet. Actual recovery is shown in the appropriate context, not as simultaneous demo panels. |
| 22 | Review on tablet and phone | frontend/app/workspace-responsive.css | Fallback reference is the prior responsive sheet. Phone source reading is additionally captured and tested. | Fallback reference is the prior responsive sheet. Phone source reading is additionally captured and tested. |

## Recovery and interaction checks

| Branch | Verified frontend behavior | Evidence |
|---|---|---|
| X1 | Scoped selection, stale response isolation, access withdrawal purge. | authorized-patient-search, workspace-facts, workspace-flow |
| X2 | Visit sorting, restored view/search/date, unavailable counts. | visit-table, worklist-recovery |
| X3 | Evidence states, source bounds, three clocks, readable sources. | workspace-documents, workspace-facts, workspace-recovery |
| X4 | Patient/reference scopes, Class A refusal, question recovery. | workspace-flow, artifact/lifecycle unit tests |
| X5 | Draft cancel, uncertain receipt, same-ID retry, versioned updates. | workspace-flow, workspace-recovery |
| X6 | Packet draft, named recipient, language limits, clipboard fallback. | storyboard-visual, workspace-family |

## Cross-screen gates

- One contextual panel; mobile focus trapping and return on close/Escape.
- Responsive checks at 390, 768, 897, 1024 and 1440 px; zoom-equivalent source wrapping.
- Task state never changes a displayed SQL rule result.
- Failed refresh retains the snapshot and disables evidence write actions.
- Confirmed receipt/read-back required before success copy.
- No generated metrics, confidence percentages, clinical clearance or raw model prose.
- Missing fields remain unavailable, not replaced with mockup claims.

Logs: evidence/frontend-unit-render-245.txt, evidence/frontend-browser-40.txt,
evidence/frontend-history-layout-browser.txt, evidence/frontend-reviewed-build.txt.

Full-system gates remain pending in acceptance.json. See frontend-handoff.md.
