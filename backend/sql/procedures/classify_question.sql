-- =============================================================================
-- STEP 14 - classify_question (internal - sits before the agent, never inside it)
-- =============================================================================
-- SPEC.md §12. Keyword-first because the highest-harm error is a Class A
-- question answered as Class B, and a system relying on the LLM to decide
-- whether to use the LLM is circular. Diagram 6: the classifier sits inside
-- its own trust boundary, before the agent - a refusal that depends on the
-- agent choosing to refuse is not a control.
--
-- 1. Keyword scan (zero latency) -> Class A
-- 2. Structure scan -> Class B
-- 3. AI_CLASSIFY fallback only for the residue
-- 4. Default -> Class A. Err toward refusal.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.classify_question(QUESTION VARCHAR)
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'SPEC.md 12. Keyword-first Class A/B routing. Sits before the agent, never inside it.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_q          VARCHAR;
    v_class      VARCHAR;
    v_method     VARCHAR;
    v_raw        VARCHAR;
BEGIN
    v_q := LOWER(:QUESTION);

    -- 1. Keyword scan. Any one of these makes it Class A, no exceptions.
    IF (
        v_q RLIKE '.*\\b(should|recommend|right|correct|safe|safest|dangerous|dose|dosing|prescribe)\\b.*'
        OR v_q RLIKE '.*\\b(prognosis|survival|survive)\\b.*'
        OR v_q RLIKE '.*\\b(mortality|die|best treatment|change dose|switch regimen|advise)\\b.*'
        OR v_q RLIKE '.*\\bwhat( is|''s)? wrong with (this |the )?(patient|her|him)[ ?.!,]*'
    ) THEN
        v_class := 'CLASS_A';
        v_method := 'keyword';
    -- 2. Structure scan. Distinctively record-state language only - NOT
    -- generic question words like "is/are/what", which would wrongly catch
    -- genuinely ambiguous questions. "Is she ready?" (WORK-PLAN.md
    -- t42_ambiguous_defaults_to_a - must default to Class A) is exactly the
    -- case a broader pattern here would misclassify - caught live by
    -- testing against that named case, not assumed correct.
    ELSEIF (
        v_q RLIKE '.*\\b(what is missing|what does the record show|what is in the record)\\b.*'
        OR v_q RLIKE '.*\\b(what is documented|what findings are recorded)\\b.*'
        OR v_q RLIKE '.*\\bwhat( is|''s)? wrong (in|with) (this |the )?(patient''s )?record\\b.*'
        OR v_q RLIKE '.*\\b(how many|list|show me|status of|changed since)\\b.*'
        OR v_q RLIKE '.*\\b(contradict(ions?)?|conflicts?|disagreements?)\\b.*'
        OR v_q RLIKE '.*\\b(expired|remaining|received|final|pending|documented|recorded|on file)\\b.*'
    ) THEN
        v_class := 'CLASS_B';
        v_method := 'structure';
    ELSE
        -- 3. LLM fallback only for the residue neither scan caught.
        v_raw := (
            SELECT AI_CLASSIFY(
                :QUESTION,
                ['CLASS_A: clinical judgment, treatment, prognosis, dosing, emergencies',
                 'CLASS_B: record-state, documentation, coverage, timeline, gate outcome']
            ):labels[0]::VARCHAR
        );
        IF (v_raw ILIKE '%CLASS_A%') THEN
            v_class := 'CLASS_A';
        ELSEIF (v_raw ILIKE '%CLASS_B%') THEN
            v_class := 'CLASS_B';
        ELSE
            -- 4. Default -> Class A. Err toward refusal, never toward answering.
            v_class := 'CLASS_A';
        END IF;
        v_method := 'llm_fallback';
    END IF;

    RETURN OBJECT_CONSTRUCT('classification', v_class, 'method', v_method);
EXCEPTION
    WHEN OTHER THEN
        v_method := 'dependency_unavailable';
        RETURN OBJECT_CONSTRUCT('classification','CLASS_A','method',v_method);
END;
$$;
