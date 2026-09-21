---
name: clinical-question-routing
description: >
  Decide whether a clinician's question asks for record state (answerable with
  citations) or clinical judgment (refused under NMC TPG 2020). Returns the class,
  the stage that decided it, and for a refusal the practitioner it must be routed to.
---

<!-- STATUS: draft scaffold. Body written Days 11-12. Frontmatter is correct as-is:
     name and description only. Execution instructions belong HERE, in the body -
     an agent ignores an instructions: key in frontmatter and fails silently. -->

# Clinical question routing

## When to use this skill

Before any retrieval, on every incoming question. A refusal that depends on the
agent choosing to refuse is not a control, so this runs upstream of tool selection.

## Procedure

Call `SAARTHI.OPERATIONAL.CLASSIFY_QUESTION`. Do not reimplement the cascade here -
the keyword list has one home, and a second copy in a skill file will drift from it.

The cascade, for context when reading its output:

1. keyword scan - `should`, `recommend`, `safe`, `prognosis`, `survival`, `dose`,
   `advise` and the rest of the list -> **Class A**, at zero latency
2. structure scan - state, status, list, comparison, lookup -> **Class B**
3. `AI_CLASSIFY` on whatever is left
4. **default -> Class A**

## The boundary test

If the answer requires the word *"should"*, it is Class A. If it can be phrased as
*"the record shows"* or *"the rule returns"*, it is Class B.

## On a Class A result

Stop. Do not call a clinical tool to build an opinion. Return the refusal object
naming the treating practitioner and offering an evidence packet. The refusal does
not enter conversation history as an answer and cannot be built on next turn.

**Refused for every role, including the treating oncologist.** A refusal a senior
enough user can override is not a control; the NMC boundary does not move with
seniority.

## Never

Output a confidence percentage. Report the observed evidence state instead -
*"final report not received"*, *"two sources disagree"*, *"3 claims verified against
5 sources"*. A percentage invites a clinical decision; an evidence state invites a
human to look.

## Reuse test

Against the second synthetic schema: one question it classifies correctly with no
schema knowledge at all (classification depends on the question, not the data), and
one genuinely ambiguous question - *"is she ready?"* - which it must route to Class A
rather than resolve.
