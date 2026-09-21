# Prompt changelog

**`ASSERTION.extractor_version` is an audit field. A version number nobody bumps is a lie in the audit trail.**

Every prompt in this directory carries `extractor_version` in its frontmatter. The task SQL pastes the prompt in as a string literal and writes that same version onto every assertion it produces. When a clinician or a judge asks *"which extractor read this value?"*, the answer has to be checkable.

## The rule

Editing a prompt requires all three, in one change:

1. bump `extractor_version` in the file's frontmatter
2. add a row to the table below
3. update the literal in the task SQL that pastes it

`@0.x` means draft — written from the specification, never run against a page. `@1` and above means reviewed and executed at least once. **A draft prompt must not run in a scored evaluation**, because a number produced by an unreviewed extractor is not a measurement.

## When a bump is mandatory

Any change to what the model is asked to return, or to how it is asked to behave. That includes reordering the critical rules, since ordering changes emphasis.

**Not required** for edits below the prompt block — the rationale prose, the rule-mapping table, this file. Those are documentation of the prompt, not the prompt.

## History

| Date | Prompt | Version | Change | Why |
|---|---|---|---|---|
| 2026-09-20 | `pass_a_lab` | `@1` | created, verbatim from `AI-INTEGRATION-ARCHITECTURE.md` §4.2 | the specified extraction prompt, unmodified |
| 2026-09-20 | `pass_b_verify` | `@1` | created, verbatim from `AI-INTEGRATION-ARCHITECTURE.md` §4.3 | R7 pass B, unmodified |
| 2026-09-20 | `pass_b_verify` | **`@2`** | **model changed `llama3.1-70b` → `claude-haiku-4-5`; `temperature: 0` pinned on both passes; fallback chain recorded** | Pass A and pass B were the **same Meta family**, so the cross-family independence R7 depends on did not exist. `llama3.1-70b` is also now `[legacy]`, end-of-life pending. See `AI-INTEGRATION-ARCHITECTURE.md` §1.1. |

**Why #3 is a version bump and not a metadata edit.** The prompt text did not change one character — only the model behind it did. It is still a bump, because `extractor_version` exists to answer *"which extractor read this value?"* and the model is half of that answer. Every assertion produced before this change was read by a different system than every assertion produced after it, and an eval run that spans both is measuring two things at once.
| 2026-09-20 | `pass_a_pathology` | `@0.1` | draft — core + `specimen_id` and `report_status` targets | §4.1 requires type-specific prompts; only the generic one was specified. Targets derive from `DOC-PATH-001`, `DOC-HER2-001` and `discordant_across_specimens`. |
| 2026-09-20 | `pass_a_imaging` | `@0.1` | draft — core + LVEF, T-score, modality targets | `SURV-LVEF-001/002` and `ENDO-DEXA-001`. `modality` exists so a QUS result cannot become a T-score. |
| 2026-09-20 | `pass_a_discharge` | `@0.1` | draft — core + clearance, wound class targets | `SURG-CLEAR-001` requires a **documented** clearance event and must not infer one from elapsed time. |
| 2026-09-20 | `pass_a_claim` | `@0.1` | draft — core + authorisation and limit targets | `COV-AUTH-001`, `COV-LIMIT-001`. Refuses to compute a family-floater balance. |

## Why the prompts live here and not inline in the task

A prompt buried in a 300-line SQL task is a prompt nobody reviews, and prompt changes are the least visible way to change system behaviour: no schema moves, no test fails, and every downstream number shifts.

Keeping them as reviewed markdown with a version and a changelog makes the bump **a visible act** rather than a side effect. It also means the four documents a judge is most likely to ask about — what exactly did you ask the model, and when did that change — are two files, not a grep.
