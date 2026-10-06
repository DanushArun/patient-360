# Polarity Checking & Answer Validation Implementation

**Researched 2026-09-16. How to implement the "no family history" vs "family history" guard.**

> **Headline finding: Verity's approach (Cortex Search → AI_FILTER for polarity) is valid and the right tool. AI_FILTER takes a prompt and returns TRUE/FALSE for each row — it can check "does this passage SUPPORT the claim, or does it CONTRADICT it?" Snowflake bills AI_FILTER at standard Cortex AI credit rates. The implementation is: retrieve candidate passages via Cortex Search, then filter each passage through AI_FILTER with a polarity-checking prompt before accepting it as evidence.**

---

## 1. The problem AI_FILTER solves

When Cortex Search returns passages matching a query like "family history of cardiotoxicity", it retrieves by semantic similarity. A passage saying "no family history of cardiotoxicity" is semantically similar to one saying "family history of cardiotoxicity" — both contain the same terms. Without a polarity check, the system cites the negation as evidence for the positive claim.

This is the most dangerous citation failure mode: the answer LOOKS cited (it has a source) but the source says the opposite of what the claim states.

---

## 2. AI_FILTER implementation

### Basic pattern
```sql
-- After Cortex Search returns candidate passages:
SELECT chunk_id, text, page_index
FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))
WHERE SNOWFLAKE.CORTEX.AI_FILTER(
    text,
    'This passage provides POSITIVE evidence that the patient ' || :claim
) = TRUE;
```

### More precise pattern with structured claims
```sql
-- For a specific claim like "patient has family history of cardiotoxicity"
SELECT chunk_id, text, page_index,
    SNOWFLAKE.CORTEX.AI_FILTER(
        text,
        'This passage confirms that ' || :claim_text
    ) AS supports_claim,
    SNOWFLAKE.CORTEX.AI_FILTER(
        text,
        'This passage explicitly denies or negates that ' || :claim_text
    ) AS contradicts_claim
FROM candidate_passages;
```

This gives three states per passage:
- `supports = TRUE, contradicts = FALSE` → evidence SUPPORTS the claim
- `supports = FALSE, contradicts = TRUE` → evidence CONTRADICTS the claim (preserve as conflicting evidence per R3)
- `supports = FALSE, contradicts = FALSE` → passage is IRRELEVANT (discard)
- `supports = TRUE, contradicts = TRUE` → passage is AMBIGUOUS (flag for human review)

### Cost
AI_FILTER uses the same credit model as other Cortex AI functions. At ~0.01 credits per call, filtering 10 candidate passages = 0.1 credits. Negligible compared to AI_PARSE_DOCUMENT.

---

## 3. Beyond polarity: the full validation pipeline

The answer validator checks 5 things in order:

### Check 1: Evidence existence
Every claim in the generated answer carries ≥1 evidence ID. An evidence ID without a match in the evidence store → claim STRIPPED.

### Check 2: Scope membership
Every evidence ID must belong to the bound patient/tenant scope. An ID from another patient → claim STRIPPED + security event logged.

### Check 3: Version currency
Every evidence ID must match the `known_as_of` version window. An evidence ID from a document that arrived after the cutoff → claim STRIPPED + temporal violation logged.

### Check 4: Polarity (AI_FILTER)
The passage behind the evidence ID must actually support the claim direction. "No history of X" cited as evidence for X → claim STRIPPED + polarity error logged.

### Check 5: Type match
Numeric claims must match numeric evidence (value, unit, threshold direction). Date claims must match date evidence. Status claims must match status evidence. A claim "ANC is 2100" evidenced by a passage that says "ANC 1200" → claim STRIPPED + value mismatch logged.

### What happens when a claim is stripped
The claim is NOT silently removed. It is replaced with an explicit limitation:
- **Before**: "ANC is 2100/µL, safe to proceed."
- **After**: "[LIMITATION: claim removed — supporting evidence does not match. The ANC value in the cited source does not agree with this statement. Verify manually.]"

The removal is logged in `ANSWER_RUN.validation_results` with the specific check that failed, the evidence ID, and the mismatch detail.

---

## 4. Implementation as a stored procedure

```sql
CREATE OR REPLACE PROCEDURE validate_answer(
    answer_json VARIANT,
    patient_id VARCHAR,
    known_as_of TIMESTAMP_NTZ
)
RETURNS VARIANT
LANGUAGE SQL
AS
BEGIN
    -- For each claim in the answer:
    -- 1. Check evidence IDs exist
    -- 2. Check scope (patient_id matches)
    -- 3. Check version (ingested_at <= known_as_of)
    -- 4. Check polarity (AI_FILTER)
    -- 5. Check type match (numeric/date/status)
    -- Return validated answer with stripped claims replaced by limitations
END;
```

The procedure runs AFTER the LLM generates the answer and BEFORE it's displayed. It is deterministic except for step 4 (AI_FILTER), which is a model call but is checking factual polarity, not generating content.

---

## 5. Verity's approach vs ours

| Dimension | Verity | SAARTHI |
|---|---|---|
| Polarity check | AI_FILTER on search results | AI_FILTER on search results (same) |
| Scope check | Request-time member-ID filter | Pre-retrieval SQL gate + content re-fetch through RAP |
| Version check | Policy effective-date matching | Three-clock `known_as_of` (stricter) |
| Type match | Not implemented | Numeric/date/status checking |
| Unsupported claims | Returns "INSUFFICIENT_EVIDENCE" | Strips the specific claim, replaces with explicit limitation |
| Logging | Not documented | Every removal logged with check type, evidence ID, mismatch detail |

**We beat Verity on checks 2, 3, and 5.** We match on check 4. This is the validator's competitive position.

---

## Sources

docs.snowflake.com: AI_FILTER function reference · Verity source code (sql/05_rollup.sql) · Cortex AI function pricing.
