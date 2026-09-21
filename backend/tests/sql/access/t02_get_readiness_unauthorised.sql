-- TEST-MANIFEST.md #1, t02. get_readiness with no care relationship to the
-- bound patient must return no_patient_access - not an error revealing the
-- patient exists, not partial data.
-- Run as a session with NO PATIENT_BINDING row and no CARE_TEAM row:
CALL SAARTHI.OPERATIONAL.get_readiness(NULL, NULL);
-- ASSERT: {"error": "no_patient_bound", ...}  (no binding exists in a fresh session)
