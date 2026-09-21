---
prompt_id: pass_b_verify
extractor_version: pass_b_verify@2
model: claude-haiku-4-5
model_parameters: {temperature: 0}
model_fallbacks: [mistral-large3, qwen3-32b, openai-gpt-5-mini]
pass: B
doc_types: [all]
runs_when: CLINICAL_ONTOLOGY.is_safety_critical = TRUE
source: AI-INTEGRATION-ARCHITECTURE.md 4.3 - verbatim
status: ready
---

# Pass B — independent verification

**R7. The differentiator no competitor has.** Runs only where the concept is flagged `is_safety_critical` on `CLINICAL_ONTOLOGY`: a platelet count gets two reads, a patient's address gets one. Cost is spent where harm lives — roughly 30% of pages, so R7 adds about 30% to extraction spend, not 100%.

## Prompt

```
A previous reader extracted this finding from the page below:

  predicate: {predicate}
  value:     {pass1_value}
  unit:      {pass1_unit}

Independently re-read the page. Do not assume the previous reading is correct.

Return ONLY JSON:
{
  "value_found":  "<the value you read for this predicate, verbatim>",
  "unit_found":   "<unit as written, or null>",
  "agrees":       true | false,
  "not_present":  true | false,
  "legibility":   "clear" | "degraded" | "illegible"
}

If you cannot locate this predicate on the page, set not_present = true.
If the page is rotated, skewed or partially unreadable, say so in legibility.

PAGE TEXT:
{page_text}
```

## Resolution table

| Pass A | Pass B | `verification_status` | Gate effect |
|---|---|---|---|
| value | agrees | `verified` | value usable |
| value | disagrees | **`conflicting`** | **`not_evaluated` — value never asserted** |
| value | `not_present` | **`conflicting`** | `not_evaluated` |
| value | `legibility != 'clear'` | **`unverified`** | `not_evaluated`, limitation shown |
| value | errors or times out | **`unverified`** | `not_evaluated`. Fail closed. |

Both readings are retained in `pass1_value` and `pass2_value`. **The audit trail is the point** — a clinician resolving the conflict needs to see what each read said, not a note that they differed.

## Two model families, not one model twice

Running `llama3.3-70b` twice **correlates its errors**. The same architecture misreads the same degraded glyph the same way, so agreement between two runs of one model measures nothing except that model's confidence.

⚠️ **Corrected 20 Sept — `@1` → `@2`.** Pass B was `llama3.1-70b`, which is **the same Meta family as pass A**: Llama 3.3 70B and Llama 3.1 70B share an architecture and differ by post-training, so the independence this whole file argues for did not exist. `llama3.1-70b` has also been marked `[legacy]`, end-of-life pending. Pass B is now `claude-haiku-4-5` — different vendor, different architecture, different training data, current, and priced for per-page volume.

**`temperature: 0` on both passes.** A disagreement produced by sampling is not an independent read, and `verification_status` cannot tell the two apart — it would mark random variation as `conflicting` and refuse to assert perfectly good values.

**If the Day-1 probe says `claude-haiku-4-5` is unreachable**, take the first reachable fallback and record which and why. **Never fall back to a second Llama.** The requirement is a different vendor and architecture from pass A, not any specific model.

> **Same-model self-consistency measures confidence. Cross-family disagreement measures correctness.**

That sentence is the whole of R7, and it belongs in the README — a judge who has built RAG systems will assume we ran the same model twice unless told otherwise.

**Pass B is framed differently on purpose.** It is not "extract this page again"; it is "here is what someone else read, now re-read it yourself and say whether you agree." Different framing plus a different family makes a shared failure mode less likely than either alone.

## The transition that does not exist

Diagram 12 has **no edge** from `Conflicting` or `Unverified` to `Asserted`. Implement it as a state machine where that path is absent, not as a guard clause that returns early — a guard can be bypassed by the next person who needs a value badly enough at 2am.

The only route out is `HumanReview → Verified`, where a clinician confirms one of the two readings. **That route must exist:** refusing to assert is only acceptable if there is a path to resolution, otherwise the system degrades into an unhelpful sceptic.

## The demo beat this prompt produces

Hand the system a photograph of a CBC where the platelet count is genuinely ambiguous. The passes disagree. The answer says *"two reads of this page disagree on the platelet value — a human must confirm"*, and the gate returns `not_evaluated`.

**It refuses to assert a number it cannot verify.** Every competitor asserts whatever their single pass returned, with no mechanism to know it was wrong.

`not_evaluated` is not `fail`. An unverifiable lab does not mean the count is low — it means we do not know, and those two states demand different actions from different people.
