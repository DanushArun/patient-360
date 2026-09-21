---
name: evidence-reconciliation
description: >
  Match assertions across sources and classify their relationship: agreement,
  supersession, append, cross-source conflict, or discordance across specimens.
  Never auto-resolves a disagreement.
---

<!-- STATUS: draft scaffold. Body written Days 11-12. -->

# Evidence reconciliation

## When to use this skill

"Does anything contradict anything", "where did this come from", "has this been
superseded", and whenever two sources report the same concept.

## The five relations

| Relation | Meaning | Effect |
|---|---|---|
| `supports` | two sources agree | strengthens nothing - do not count agreement as confidence |
| `supersedes` | a corrected or amended document replaces a prior one | the prior value stops contributing evidence |
| `complemented_by` | an **appended** report adds detail | the original **stays valid** |
| `conflicts_with` | two sources disagree on the same concept and specimen | outcome `conflicting`; a human reconciles |
| `discordant_across_specimens` | two **different specimens** report different values | **neither is wrong.** Surface both. |

## An append is not a supersession

FHIR `DiagnosticReport.status` separates `appended` from `amended`/`corrected`, and so
must you. An append completes the record. A correction means **a prior clinical
decision may have rested on a wrong value** and triggers re-evaluation of every gate
that depended on it. Collapsing them loses exactly the signal that matters.

The real FISH result arrived as an ADDITIONAL REPORT two weeks after the IHC. The
original pathology report stayed valid.

## Discordance across specimens is the one people get wrong

The outside biopsy read Grade II / HER2 IHC 1+. The surgical specimen read Grade III /
IHC 2+. **Different accession ids, so specimen-keyed matching never collides and no
conflict is detected** - yet this is the finding that triggered FISH and changed the
treatment.

It is neither a match nor an error. It is a third relation, and both readings are
shown with their specimen ids. **Never merge specimens and never pick the later one.**

## Never auto-resolve

Do not prefer the newer value, the higher-quality scan, or the more specific source.
Report the disagreement, name what would resolve it, and let a human decide. An
assertion marked `conflicting` or `unverified` is never asserted as a value.

## Reuse test

This is the skill named in the plan for the reuse proof. Against the second synthetic
schema: one successful mapping of a supersession chain expressed with different column
names, and **one ambiguity it correctly refuses to resolve** - two candidate version
columns where picking either would be a guess.
