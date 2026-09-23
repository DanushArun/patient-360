-- =============================================================================
-- STEP 14 - classify_question (internal - sits before the agent, never inside it)
-- =============================================================================
-- SPEC.md §12. Keyword-first because the highest-harm error is a Class A
-- question answered as Class B, and a system relying on the LLM to decide
-- whether to use the LLM is circular. Diagram 6: the classifier sits inside
-- its own trust boundary, before the agent - a refusal that depends on the
-- agent choosing to refuse is not a control. ask_saarthi calls it first.
--
-- 1. Class A scan (zero latency): clinical judgement - should, safe, prognosis,
--    survival, advise, ready, override, dose changes - in English and in the
--    Navigator's four Indian languages. "recommend" is Class A only when a
--    person is asked; "what does the NCCN guideline recommend" is a document
--    lookup (Class B).
-- 2. Structure scan -> Class B: distinctively record-state language (gates,
--    lab names, reports, amendments, consent, coverage, identifiers, dates),
--    plus the words for test / report / result in those four languages.
-- 3. AI_CLASSIFY with described categories, only for the residue.
-- 4. Default -> Class A. Err toward refusal.
--
-- Measured with backend/eval/harness/run_classifier_eval.py. On 24 Sept the
-- previous version scored 17/40 on the dev set: no Class A question was
-- answered, but 23 of 31 record questions were refused ("What is her ANC?"),
-- because its structure scan was narrow and its AI fallback, given bare
-- labels, called almost everything clinical. Results are in
-- backend/eval/results/.
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
    v_doc_lookup BOOLEAN;
BEGIN
    v_q := LOWER(:QUESTION);
    -- Asking what a document says, not what a person thinks.
    v_doc_lookup := v_q RLIKE '.*\\b(guideline|guidelines|protocol|label|nccn|asco|esmo|who|ncd|ncg|icmr|manual|consensus|monograph|pm-jay|hbp)\\b.*';

    -- 1. Class A scan. Any one of these, no exceptions.
    IF (v_q RLIKE '.*\\b(should|shall i|shall we|safe|unsafe|dangerous|risky|prognosis|prognostic|survival|survive|mortality|die|dying|life expectancy|advise|advice|override|overrule|proceed|go ahead|ok to|okay to|ready|fit for|fit to|best treatment|best option|best regimen|which treatment|what treatment|next line)\\b.*'
        OR v_q RLIKE '.*\\b(change|reduce|increase|adjust|modify|lower|raise|skip|hold|withhold|delay|stop|restart) (the |her |his |their )?(dose|dosing|cycle|chemo|chemotherapy|treatment|regimen|drug)\\b.*'
        OR v_q RLIKE '.*\\b(can|could|may) (she|he|they|we|the patient) (have|take|get|receive|start|continue|go|be given|be treated)\\b.*'
        OR v_q RLIKE '.*\\b(switch|swap) (regimen|treatment|drug|to)\\b.*'
        OR v_q RLIKE '.*\\b(right|correct|appropriate) (dose|dosing|treatment|regimen|choice|thing|plan)\\b.*'
        OR (v_q RLIKE '.*\\brecommend.*' AND NOT v_doc_lookup)
        -- Hindi / Marathi / Bengali / Tamil: ready, should, safe, advise.
        OR v_q RLIKE '.*(तैयार|तैयारी|तयार|प्रस्तुत|প্রস্তুত|தயார்|चाहिए|पाहिजे|উচিত|வேண்டும்|सुरक्षित|নিরাপদ|பாதுகாப்பான|सलाह|सल्ला|পরামর্শ|ஆலோசனை).*') THEN
        v_class := 'CLASS_A';
        v_method := 'keyword';
    -- 2. Structure scan: record-state language only. Not generic question words
    -- like "is/are/what" - "Is she ready?" must still default to Class A
    -- (WORK-PLAN.md t42), and step 1 catches it before it reaches here.
    ELSEIF (v_doc_lookup
        OR v_q RLIKE '.*\\b(what is missing|missing|how many|list|show me|status of|contradict|contradicts|conflict|conflicting|agree|disagree|discordant|discordance|compare|changed|change in the record|since|expired|expiry|valid|remaining|received|not received|final|pending|unreadable|documented|on file|on record|in the record|do we have|have we|is there|are there|when was|when is|which|latest|last|most recent|current|history|timeline|amended|appended|superseded|correction|corrected|revised|derived|calculated|readiness|gate|gates|blocking|blocker|blockers|overdue|stale|due)\\b.*'
        OR v_q RLIKE '.*\\b(anc|neutrophil|platelet|platelets|plt|hb|hemoglobin|haemoglobin|wbc|cbc|creatinine|crcl|bilirubin|alt|ast|lvef|echo|echocardiogram|dexa|t-score|hba1c|her2|fish|ihc|pathology|biopsy|histopathology|report|reports|document|documents|lab|labs|scan|result|results|test|tests)\\b.*'
        OR v_q RLIKE '.*\\b(consent|care team|practitioner|practitioners|facility|facilities|identifier|identifiers|abha|mrn|coverage|pre-auth|preauth|authorisation|authorization|package|scheme|claim|evidence|cite|citation|source)\\b.*'
        -- Hindi / Marathi / Bengali / Tamil: test, report, result, count, scan.
        OR v_q RLIKE '.*(जांच|जाँच|तपासणी|रिपोर्ट|अहवाल|निकाल|परिणाम|नतीजा|रक्त|প্লেটলেট|কাউন্ট|রিপোর্ট|ফলাফল|পরীক্ষা|ரிப்போர்ட்|அறிக்கை|முடிவு|பரிசோதனை|ஸ்கேன்).*') THEN
        v_class := 'CLASS_B';
        v_method := 'structure';
    ELSE
        -- 3. AI fallback with described categories (bare labels called almost
        -- everything clinical - measured on the dev set, 24 Sept).
        v_raw := (SELECT AI_CLASSIFY(:QUESTION, [
            {'label': 'CLASS_A', 'description': 'Asks for a clinical decision or opinion: whether to treat, proceed, stop or change a dose, whether something is safe, what treatment is best, prognosis or survival.'},
            {'label': 'CLASS_B', 'description': 'Asks what the patient record, a report, a guideline or coverage says: values, dates, documents, status, what is missing, what changed. Any language.'}],
            {'task_description': 'Route a clinician question about one patient record. Record and document questions are CLASS_B; requests for clinical judgement are CLASS_A.'}
            ):labels[0]::VARCHAR);
        IF (v_raw ILIKE '%CLASS_B%') THEN
            v_class := 'CLASS_B';
        ELSE
            -- 4. Default -> Class A. Err toward refusal, never toward answering.
            v_class := 'CLASS_A';
        END IF;
        v_method := 'llm_fallback';
    END IF;

    RETURN OBJECT_CONSTRUCT('classification', v_class, 'method', v_method);
END;
$$;
