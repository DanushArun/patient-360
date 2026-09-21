-- =============================================================================
-- SAARTHI - model availability probe
-- =============================================================================
--
-- Owner: Builder 1. Day 1, BEFORE any extraction work.
-- Reference: AI-INTEGRATION-ARCHITECTURE.md 1.1 - 1.3
--
-- NOT PART OF THE DEPLOY. Never referenced from setup.sql. This is a probe whose
-- output is evidence, not an object the system depends on.
--
-- WHY IT EXISTS
--   GCP_ME_CENTRAL2 appears in NO Snowflake regional availability table. Every
--   model reaches this account through cross-region inference, so the published
--   roster is an upper bound and never a guarantee of what this account can call.
--
--   The only prior evidence is a probe dated 17 Sept. It found claude-4-sonnet and
--   mistral-large2 already rejected as legacy on this account. Since then
--   llama3.1-70b - which the original R7 pass B depended on - has been marked
--   legacy too, and at least one model generation has shipped. A pinned model that
--   silently stops resolving would take out the submission's strongest claim
--   during the 18 days judges hold the repository.
--
-- STATUS: NOT YET EXECUTED. Section 2 uses Snowflake Scripting and has not been
--   run against an account. If it errors, fall back to Section 1, which is plain
--   SQL and cannot fail for structural reasons. Record whichever you used.
--
-- RECORD EVERY RESULT - available AND unavailable - in
--   evidence/coco/verification-query-ids.md, with the query ID.
--   A model that failed is the more useful record: it is why the fallback exists.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. PREREQUISITES. Without both, every call below fails and the error points
--    somewhere unhelpful.
-- -----------------------------------------------------------------------------

-- Run as ACCOUNTADMIN.
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE SAARTHI_APP;

-- GCP_ME_CENTRAL2 has no local model endpoints. This is line one of setup.sql for
-- the same reason.
ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'ANY_REGION';

-- Confirm it took. Read the 'value' column, not 'default'.
SHOW PARAMETERS LIKE 'CORTEX_ENABLED_CROSS_REGION' IN ACCOUNT;


-- -----------------------------------------------------------------------------
-- 1. PLAIN PROBE - run one statement at a time.
--    An unavailable model raises an error rather than returning a row, so a
--    failure IS the result. Note the query ID either way.
-- -----------------------------------------------------------------------------

-- Pass A. Current, not legacy. Verified working 17 Sept.
SELECT AI_COMPLETE('llama3.3-70b', 'Reply with the single word OK')        AS pass_a;

-- Pass B, first choice. Different vendor and architecture from pass A, which is
-- the entire basis of R7. Small and built for per-page volume.
SELECT AI_COMPLETE('claude-haiku-4-5', 'Reply with the single word OK')    AS pass_b_primary;

-- Pass B fallbacks, in order. NEVER fall back to a second Llama - that reproduces
-- exactly the correlated-error pairing that 1.1 corrects.
SELECT AI_COMPLETE('mistral-large3', 'Reply with the single word OK')      AS pass_b_fallback_1;
SELECT AI_COMPLETE('qwen3-32b', 'Reply with the single word OK')           AS pass_b_fallback_2;
SELECT AI_COMPLETE('openai-gpt-5-mini', 'Reply with the single word OK')   AS pass_b_fallback_3;

-- Class A/B classifier fallback stage. Smallest sufficient model.
SELECT AI_COMPLETE('llama3.1-8b', 'Reply with the single word OK')         AS classifier;

-- Orchestration candidates. Pin whichever the budget supports; never leave 'auto'.
SELECT AI_COMPLETE('claude-opus-4-8', 'Reply with the single word OK')     AS orch_verified_17sep;
SELECT AI_COMPLETE('claude-opus-5', 'Reply with the single word OK')       AS orch_current_top;
SELECT AI_COMPLETE('claude-sonnet-5', 'Reply with the single word OK')     AS orch_cheaper;

-- The model the original design depended on. Expected to still answer - legacy is
-- not yet removed - but this is the row that justifies having moved off it.
SELECT AI_COMPLETE('llama3.1-70b', 'Reply with the single word OK')        AS legacy_former_pass_b;


-- -----------------------------------------------------------------------------
-- 2. AUTOMATED PROBE - one result set, failures captured rather than fatal.
--    UNTESTED. If this errors for structural reasons, use Section 1 and say so in
--    the evidence file. Do not spend more than ten minutes making it work.
-- -----------------------------------------------------------------------------

EXECUTE IMMEDIATE $$
DECLARE
    candidates ARRAY DEFAULT ARRAY_CONSTRUCT(
        'llama3.3-70b',        -- pass A
        'claude-haiku-4-5',    -- pass B, first choice
        'mistral-large3',      -- pass B fallback 1
        'qwen3-32b',           -- pass B fallback 2
        'openai-gpt-5-mini',   -- pass B fallback 3
        'llama3.1-8b',         -- classifier
        'claude-opus-4-8',     -- orchestration, verified 17 Sept
        'claude-opus-5',       -- orchestration, current top
        'claude-sonnet-5',     -- orchestration, cheaper
        'llama3.1-70b'         -- legacy, former pass B
    );
    results ARRAY DEFAULT ARRAY_CONSTRUCT();
    m       VARCHAR;
    reply   VARCHAR;
BEGIN
    FOR i IN 0 TO ARRAY_SIZE(:candidates) - 1 DO
        m := GET(:candidates, i)::VARCHAR;
        BEGIN
            reply := (SELECT AI_COMPLETE(:m, 'Reply with the single word OK'));
            results := ARRAY_APPEND(:results, OBJECT_CONSTRUCT(
                'model', :m, 'status', 'available', 'reply', LEFT(:reply, 40)));
        EXCEPTION
            WHEN OTHER THEN
                results := ARRAY_APPEND(:results, OBJECT_CONSTRUCT(
                    'model', :m, 'status', 'UNAVAILABLE', 'error', LEFT(SQLERRM, 150)));
        END;
    END FOR;
    RETURN :results;
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. WHAT DOES 'auto' RESOLVE TO TODAY?
-- -----------------------------------------------------------------------------
--
-- 'auto' selects the HIGHEST-CAPABILITY model available, so the resolved model
-- changes by itself the day a stronger one reaches the account - observed
-- elsewhere as an immediate cost jump, with no commit and no warning.
--
-- Our 17 Sept probe resolved auto to claude-opus-4-8. claude-opus-5 and
-- gemini-3.1-pro have since appeared on the published roster, so the model we
-- measured is probably not the model we are running.
--
-- Create a throwaway agent with orchestration: auto, run one question, and read
-- model_name out of the response. Then PIN that value - or a cheaper one - in
-- sql/agent/saarthi_agent.sql, and drop the throwaway.
--
--   models:
--     orchestration: claude-opus-4-8     -- pinned. Never 'auto' after this probe.
--
-- Re-evaluate ONCE after the Day-5 gate, deliberately, in a commit. A model change
-- invalidates every accuracy number measured before it.


-- -----------------------------------------------------------------------------
-- 4. AFTER RUNNING
-- -----------------------------------------------------------------------------
--
-- [ ] every result recorded in evidence/coco/verification-query-ids.md, with QIDs
-- [ ] AI-INTEGRATION-ARCHITECTURE.md 1 matrix updated if a choice changed
-- [ ] sql/prompts/pass_b_verify.md frontmatter names the model actually used
-- [ ] AGENTS.md fact 8 updated - it is the binding rules file and it currently
--     names a model roster that has moved
-- [ ] orchestration pinned in the agent spec
-- [ ] IMPLEMENTATION-STATUS.md reflects what was verified versus assumed
--
-- If claude-haiku-4-5 is unreachable, take the first reachable fallback and write
-- down WHICH and WHY. The requirement R7 actually has is a different vendor and
-- architecture from pass A - not any specific model.
-- =============================================================================
