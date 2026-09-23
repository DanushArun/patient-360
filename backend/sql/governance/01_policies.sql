-- =============================================================================
-- STEP 7 - Policies   *** RED STEP ***
-- =============================================================================
-- 1 row access policy + 2 masking policies + 1 sensitivity tag.
-- F3 (AGENTS.md #1): the RAP keys on CURRENT_USER(), NEVER CURRENT_ROLE().
-- CURRENT_USER() survives owner's-rights elevation (verified), so this policy
-- filters correctly even when called from inside an EXECUTE AS OWNER
-- procedure - that survival is exactly what makes Layer 3 of R5 real instead
-- of cosmetic.
--
-- NOTE: SPEC.md names "1 RAP + 2 masking + 1 sensitivity tag" but does not
-- spell out which columns the masking policies cover - this is genuinely
-- under-specified in the plan. Filling it in per the spirit of R4/R5 (PII
-- protection, direct-identifier minimisation) rather than inventing a
-- requirement: PATIENT.name/abha_ref get a full-mask, PATIENT.dob gets a
-- year-only mask. Flagging this as a judgment call, not a spec citation.

-- Idempotency: CREATE OR REPLACE ROW ACCESS POLICY fails once the policy is
-- attached to DOC_PAGE ("cannot be dropped/replaced as it is associated with
-- one or more entities") - verified live on a second deploy run. A fresh
-- account has nothing attached yet, so the detach must not fail there either;
-- an anonymous scripting block with EXCEPTION WHEN OTHER makes "nothing to
-- detach" and "something to detach" both succeed. 02_attach_policies.sql
-- re-attaches it afterward - detach-then-recreate-then-reattach is the only
-- sequence Snowflake allows for a policy that must change while in use.
EXECUTE IMMEDIATE $$
BEGIN
    ALTER TABLE SAARTHI.DOCUMENTS.DOC_PAGE DROP ROW ACCESS POLICY SAARTHI.GOVERNANCE.patient_scope;
    RETURN 'detached';
EXCEPTION
    WHEN OTHER THEN
        RETURN 'nothing to detach';
END;
$$;

-- Layer 3 of R5: even a leaked chunk_id yields nothing, because DOC_PAGE
-- content is re-fetched through this policy, keyed on the real caller.
--
-- Two-branch design:
--   Top branch — reference-corpus docs (SPEC R6). Public clinical guidelines
--     (WHO, NCCN, etc.) with no patient PII. Visible to any authenticated
--     caller; no CURRENT_USER() filtering because reference docs have no
--     user-specific access rules. Required for parse_documents_proc's
--     reference loop and chunk_documents_proc to see reference DOC_PAGE
--     rows at all (patient_id IS NULL means the bottom branch can never
--     match a CARE_TEAM row).
--   Bottom branch — patient-scope enforcement, unchanged. F3: keys on
--     CURRENT_USER(), never CURRENT_ROLE(); survives owner's-rights
--     elevation exactly as R5 Layer 3 requires.
CREATE OR REPLACE ROW ACCESS POLICY SAARTHI.GOVERNANCE.patient_scope
  AS (doc_id VARCHAR) RETURNS BOOLEAN ->
    EXISTS (
      SELECT 1 FROM SAARTHI.DOCUMENTS.DOCUMENT d
       WHERE d.doc_id = doc_id AND d.scope = 'reference'
    )
    OR EXISTS (
      SELECT 1
      FROM SAARTHI.GOVERNANCE.CARE_TEAM ct
      JOIN SAARTHI.GOVERNANCE.PRACTITIONER p
        ON p.practitioner_id = ct.practitioner_id
      JOIN SAARTHI.DOCUMENTS.DOCUMENT d
        ON d.patient_id = ct.patient_id
      WHERE p.snowflake_user = CURRENT_USER()
        AND d.doc_id = doc_id
        AND (ct.active_to IS NULL OR ct.active_to > CURRENT_TIMESTAMP())
    );

-- Sensitivity tag - direct identifiers vs de-identifiable dates.
CREATE OR REPLACE TAG SAARTHI.GOVERNANCE.pii_classification
  ALLOWED_VALUES 'direct_identifier', 'quasi_identifier'
  COMMENT = 'Applied to PATIENT columns that carry PII, for masking + classification tooling';

-- Masking policy 1 - full mask on direct identifiers (name, ABHA reference).
-- Exempts ACCOUNTADMIN because that is the table owner's role: an
-- EXECUTE AS OWNER procedure runs as this role, and access is re-validated
-- there via CARE_TEAM/CONSENT before any value is returned to the caller.
-- A direct SELECT by any other role (e.g. SAARTHI_JUDGE browsing raw tables)
-- sees the masked value.
CREATE OR REPLACE MASKING POLICY SAARTHI.GOVERNANCE.mask_direct_identifier
  AS (val VARCHAR) RETURNS VARCHAR ->
    CASE WHEN CURRENT_ROLE() = 'ACCOUNTADMIN' THEN val ELSE '***MASKED***' END;

-- Masking policy 2 - date-of-birth reduced to year only outside the owner context.
CREATE OR REPLACE MASKING POLICY SAARTHI.GOVERNANCE.mask_dob
  AS (val DATE) RETURNS DATE ->
    CASE WHEN CURRENT_ROLE() = 'ACCOUNTADMIN' THEN val
         ELSE DATE_FROM_PARTS(YEAR(val), 1, 1) END;
