-- TEST-MANIFEST.md #3, t35. Check 6 - the most important check in the
-- validator: an assertion with verification_status='conflicting' must be
-- downgraded to an explicit limitation, never silently stripped and never
-- passed through as if verified.
--
-- Setup (run once, clean up after): insert a deliberately conflicting
-- assertion fixture, since no real conflicting row exists in the current
-- dataset (R7 hasn't yet produced one from live extraction in this build).
INSERT INTO SAARTHI.EVIDENCE.ASSERTION (assertion_id, doc_id, predicate, value, verification_status, pass1_value, pass2_value, extractor_version)
SELECT 'TEST-CONFLICTING-001', doc_id, 'PLT', '260604', 'conflicting', '260604', '260904', 'test_fixture'
FROM SAARTHI.DOCUMENTS.DOCUMENT LIMIT 1;

CALL SAARTHI.OPERATIONAL.bind_patient('PAT-DEEP-0001');
CALL SAARTHI.OPERATIONAL.validate_answer(
  PARSE_JSON('[{"text":"platelets are 260604","evidence":[{"kind":"document_span","id":"TEST-CONFLICTING-001"}]}]'), NULL);
-- ASSERT: claims=[] (empty), limitations contains "check6_trustworthiness"
-- and a human-readable "could not be verified on a second pass" message.

DELETE FROM SAARTHI.EVIDENCE.ASSERTION WHERE assertion_id = 'TEST-CONFLICTING-001';
