---
name: risk-stratification
description: >
  Report care-readiness gate outcomes produced by versioned SQL rules. Stratifies
  documentation, coverage and safety-surveillance risk. Does not model clinical
  deterioration, prognosis or survival, and computes nothing itself.
---

<!-- Execution instructions live in the markdown body; frontmatter carries name and
     description only (agents ignore an instructions: key in frontmatter). -->

# Risk stratification

## When to use this skill

Readiness, gaps, blockers, "what is missing", "what is failing".

## Procedure

Call `GetReadiness`. **Never compute readiness yourself, and never infer an outcome
from facts you retrieved separately.** Every status, number, date and threshold
comparison comes from SQL against a versioned rule. You report them; you do not
compute or judge them.

Report each gate with the `rule_id` and `rule_version` that produced it, the reason,
the evidence ids, and the action.

## Four outcomes, never a boolean

| Outcome | What it means | Who acts |
|---|---|---|
| `pass` | the rule was evaluated and met | nobody |
| `fail` | evaluated and not met | **fix this thing** |
| `not_evaluated` | the evidence is missing, unreadable, or R7-conflicting | **obtain this evidence** |
| `conflicting` | two sources disagree | **a human must reconcile them** |

`not_evaluated` **is not** `fail`. A missing ANC does not mean the count is low - it
means we do not know. Three different people do three different jobs from these four
states, and a boolean cannot dispatch any of them.

## Provenance travels with the outcome

Where a threshold is practice consensus rather than a guideline requirement, say so
in the same breath as the number. Three of the sixteen rules are in that category.
**Presenting institutional practice as a guideline mandate is the same dishonesty we
document in competitors.**

Two specific cases that must never be reported as blockers or as mandates:
- `ENDO-HBA1C-001` is **advisory and must never block** - cancer surgery is not
  deferred for glycaemic optimisation
- only the anti-VEGF 28-day post-operative interval is FDA-mandated; the general
  21-day interval is practice consensus

## Never

Say or imply that treatment may or may not proceed. Present the record state and
route the decision to the treating practitioner.

## Reuse test

Against the second synthetic schema: one gate it evaluates correctly through renamed
columns, and one rule whose required input is ambiguous in that schema - which it must
return as `not_evaluated` rather than guess at.
