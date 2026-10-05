# SAARTHI — 180-second presentation and evidence defense

This script separates demonstrated behavior from proposed impact. Rehearse to the listed
time windows. Use synthetic patients only. Do not substitute a recorded preview for a live
execution. The hosted preview has no Snowflake credentials and cannot save live actions.

| Seconds | Screen | Verbatim narration |
| --- | --- | --- |
| 0–15 | Day-care census; show the synthetic-data disclosure | “A cancer visit depends on more than a lab result. A coordinator must reconcile reports, coverage letters and missing records before the next appointment.” |
| 15–30 | PAT-DC-04 workspace and evidence-state checks | “SAARTHI makes that coordination work traceable. It reports what the records show, what is missing and which sources disagree. The treating practitioner retains every clinical decision.” |
| 30–45 | Recorded platelet fact; open its evidence | “Here is the platelet record. The value comes from SQL, not an invented model conclusion. Its evidence carries the event time, source-recorded time and ingestion time.” |
| 45–60 | Guarded answer with its evidence IDs and known-as-of | “The model can propose claims. A deterministic boundary resolves their evidence within the bound patient and snapshot. Supported values become canonical record facts.” |
| 60–78 | Validator failure-and-fix receipt | “We tested an unsupported value and foreign-shaped evidence identifiers. The validator returned no supported claims. A citation is a pointer; the validator must also verify the claim against the record.” |
| 78–98 | PAT-DC-07 coverage-source comparison and cutoff control | “For a disagreement, we retain both sources. Changing the cutoff shows the record available at that time. A missing final report stays missing; it never becomes a negative finding.” |
| 98–120 | Reviewed action and persisted receipt, only after live verification | “The coordinator reviews the evidence and saves a follow-up. The receipt links the patient, evidence and action. A retry must return the same saved action, rather than create a second one.” |
| 120–140 | Architecture slide; permission migration receipts | “Patient scope is enforced before retrieval. Cortex Search runs with owner rights, so its hits are re-authorized through bound procedures. Internal helpers and direct agent access are excluded from the app role.” |
| 140–160 | Clinical refusal; show actual treating practitioner packet | “Ask whether treatment should proceed and SAARTHI refuses clinical judgment. It prepares factual evidence for the named treating practitioner. Prepared is distinct from delivered.” |
| 160–180 | Engineering evidence slide and measurement disclosures | “The latest run passed 465 Python tests, with 14 live-dependent skips. Web checks passed 273 tests and 40 fixture browser scenarios. A live guarded answer completed in 8.9 seconds. Thirty simulated workflow pairs suggest a measurement plan; actual operator benefit and cost still require observed runs.” |

## Recording gates

Before recording the saved-action, cutoff or packet segments, execute them on the final account
and attach their receipts. If unavailable, show the limitation plainly and do not narrate a
successful action. The warehouse hit its configured suspension threshold during verification.
Native agent execution is denied on this trial account. The bounded SQL record fallback is live.
One latency sample is not p95. Fixture browser tests are not live Snowflake isolation tests.

## Adversarial answers

**“Why do citations not prove the conclusion?”**

They do not. We resolve each proposed evidence identifier against the authorized patient and
cutoff, require typed values to match SQL facts, and return canonical record text. Document
claims also require extraction verification and entailment checks. On NY64016, query
`01c781ed-0004-0d3e-0001-fe5a0016b112` stripped all three unsupported candidates. This is
boundary evidence, not a completed held-out accuracy measurement.

**“Does owner-rights search bypass patient isolation?”**

Cortex Search does not enforce row policies. Our agent has only bound generic procedure tools,
with no patient selector in its tool inputs. Search returns identifiers; content is separately
authorized using `CURRENT_USER()`, care-team membership and current consent. App sessions disable
secondary roles. The approved migration removes blanket procedure and direct agent access.
Ten concurrent-session probes are implemented; their final-account execution remains required
before claiming zero observed cross-session leaks.

**“Why would a hospital pay?”**

The buyer is a coordination operator paying to reduce record reconciliation effort while keeping
the evidence auditable. We have not measured operator savings yet. The 30-pair simulation uses
assumptions: median manual 259.984 seconds versus assisted 123.374 seconds, a 52.55% modeled
reduction. Those numbers are not observed benefit. The adoption gate is a counterbalanced pilot
with timed reviews, correctness adjudication and actual Snowflake usage per completed review.

## Artifact links

- Deck: `docs/submission/SAARTHI-submission-2026-10-04.pptx`
- Release evidence: `evidence/qa/RELEASE-CHECKPOINT-2026-10-04.md`
- Restart plan: `docs/AGENT-EXECUTION-HANDOFF-2026-10-04.md`
- Hosted recorded preview: https://saarthi-sooty-psi.vercel.app/

Portal submission is intentionally untouched. Video is the final packaging step.
