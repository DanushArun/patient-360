-- =============================================================================
-- STEP 8 - Attach policies   *** RED STEP ***
-- =============================================================================
-- DOC_PAGE gets the row access policy. DOC_CHUNK gets NONE.
-- F4: CREATE CORTEX SEARCH SERVICE fails with "Change tracking is not
-- supported on queries with correlated subquery expressions" over a
-- RAP-protected table. The index holds no content and returns IDs; content
-- lives behind the policy. The platform forced this security architecture.
-- Do not "fix" this by adding a RAP to DOC_CHUNK.
ALTER TABLE SAARTHI.DOCUMENTS.DOC_PAGE
  ADD ROW ACCESS POLICY SAARTHI.GOVERNANCE.patient_scope ON (doc_id);

ALTER TABLE SAARTHI.CORE.PATIENT MODIFY COLUMN name SET MASKING POLICY SAARTHI.GOVERNANCE.mask_direct_identifier;
ALTER TABLE SAARTHI.CORE.PATIENT MODIFY COLUMN abha_ref SET MASKING POLICY SAARTHI.GOVERNANCE.mask_direct_identifier;
ALTER TABLE SAARTHI.CORE.PATIENT MODIFY COLUMN dob SET MASKING POLICY SAARTHI.GOVERNANCE.mask_dob;

ALTER TABLE SAARTHI.CORE.PATIENT MODIFY COLUMN name SET TAG SAARTHI.GOVERNANCE.pii_classification = 'direct_identifier';
ALTER TABLE SAARTHI.CORE.PATIENT MODIFY COLUMN abha_ref SET TAG SAARTHI.GOVERNANCE.pii_classification = 'direct_identifier';
ALTER TABLE SAARTHI.CORE.PATIENT MODIFY COLUMN dob SET TAG SAARTHI.GOVERNANCE.pii_classification = 'quasi_identifier';
