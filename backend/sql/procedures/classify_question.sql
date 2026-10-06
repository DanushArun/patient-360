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
        -- Record-sounding questions that ask for a judgment about the patient (6 Oct 2026):
        -- caught here so the wider record scan below can never answer them as Class B.
        OR v_q RLIKE '.*\\b(proceed|go ahead|override|ready for|fit for|fit to|okay to|ok to|fine to|enough|mean|means|imply|implies|interpret|interpretation|worry|worried|concerning)\\b.*'
        OR v_q RLIKE '.*\\bcan (she|he|we|they|the patient) (start|have|get|receive|go|continue|take)\\b.*'
        -- Treatment-course decisions, so the wider worklist scan below never answers them.
        OR v_q RLIKE '.*\\b(stop|hold|delay|withhold|defer|postpone|reschedule[a-z]*|reason to|treat first|prioriti[sz]e)\\b.*'
        OR v_q RLIKE '.*\\b(medications?|medicines?|drugs?|regimen|chemo[a-z]*)\\b.*\\b(require[sd]?|need|needs|give|start|add|change|increase|reduce)\\b.*'
        -- Severity and trajectory are clinical judgments, so the record-topic scan below never answers them.
        OR v_q RLIKE '.*\\b(serious|severe|critical|worse|worsening|improving|better|stable|urgent|emergency|alarming)\\b.*'
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
        -- A record question word plus a record noun (6 Oct 2026). Judgment wording is refused by
        -- the keyword scan above before this is reached; "Is she ready?" names no record noun.
        OR v_q RLIKE '.*\\b(what|which|when|where|has|have|do we have|is there|are there)\\b.*\\b(on record|in the record|reports?|labs?|counts?|results?|anc|platelets?|hba1c|lvef|dexa|echo[a-z]*|identifiers?|abha|consent|coverage|pm-jay|pre-?auth[a-z]*|authori[sz]ation|gates?|care team|practitioners|facilities|pathology|fish|biopsy|timeline|amended|superseded|changed|documents?|tasks?|visit|schedule)\\b.*'
        OR v_q RLIKE '.*\\bstill (valid|active|current|in force)\\b.*'
        -- Worklist and record-summary language (6 Oct 2026, live copilot). Measured on XG46956:
        -- 27 of 47 everyday record questions ("Who is blocked today?", "What's missing?",
        -- "Summarise this record") reached the AI fallback and were refused. Judgment wording
        -- ("ready for", "should", "safe", "fit for", "can he start") is still refused above first.
        OR v_q RLIKE '.*\\b(who|who''s|whom|which patients?|any patients?|anyone|anybody|everyone|my patients|my day|today|today''s|the list|my list|day ?care|worklist|census)\\b.*\\b(blocked|blocking|blockers?|waiting|pending|missing|outstanding|conflicts?|conflicting|advisory|ready|cleared|attention|issues?|problems?|looking|summary|overview|status|list|checks?)\\b.*'
        OR v_q RLIKE '.*\\b(my day|today''s (list|day ?care|schedule|patients)|summary|summari[sz]e|overview|brief me|recap|tell me about)\\b.*'
        OR v_q RLIKE '.*\\b(what''s|what is|whats) (missing|outstanding|pending|blocking|open|left)\\b.*'
        OR v_q RLIKE '.*\\b(gaps?|outstanding|blocked|blocking|blockers?|disagree[a-z]*|discrepanc[a-z]*)\\b.*'
        OR v_q RLIKE '.*\\b(issues?|problems?) (with|in) (this |the |her |his )?(record|chart|file|visit|patient)\\b.*'
        -- "What's the issue with Fatima?" (6 Oct 2026, live): a named patient's flagged record
        -- issues. "What's wrong with her" and judgment wording are refused by the keyword scan first.
        OR v_q RLIKE '.*\\b(what''s|whats|what is|what are|any|list the|show the) (the |her |his |their )?(main |open |record )?(issues?|problems?|flags?)\\b.*'
        OR v_q RLIKE '.*\\b(is|are|was|has) (the|her|his|this|their) (pre-?auth[a-z]*|authori[sz]ation|consent|coverage|claim|report|document|pathology|scan)\\b.*'
        OR v_q RLIKE '.*\\b(which|what) cycle\\b.*'
        -- Record topics a clinician or judge asks about by name (6 Oct 2026, 54-question live sweep:
        -- these 12 reached the AI fallback and were refused). Judgment wording is refused above first.
        OR v_q RLIKE '.*\\b(diagnos[a-z]*|condition|her2|receptor status|vitals?|history|timeline|pm-?jay|covered|insurance|schemes?|treating (doctor|practitioner|oncologist)|doctor|overdue|due|red flags?|attention|waiting( on evidence)?)\\b.*'
        OR v_q RLIKE '.*\\b(what|which)\\b.*\\b(medications?|medicines?|drugs?|regimen|protocol|treatment plan)\\b.*'
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
