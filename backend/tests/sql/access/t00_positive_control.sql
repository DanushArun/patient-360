-- TEST-MANIFEST.md #1, t00. Not optional: proves the negative tests below
-- mean something, by confirming an authorized caller gets a real result.
-- Expect: a binding_id (not an error object).
CALL SAARTHI.OPERATIONAL.bind_patient('PAT-DEEP-0001');
-- ASSERT: result contains "binding_id", not "error"
