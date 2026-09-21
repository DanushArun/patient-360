-- TEST-MANIFEST.md #3, t30. An evidence id that resolves to no row must
-- strip the claim (check 1), not error and not pass through.
CALL SAARTHI.OPERATIONAL.bind_patient('PAT-DEEP-0001');
CALL SAARTHI.OPERATIONAL.validate_answer(
  PARSE_JSON('[{"text":"made up evidence","evidence":[{"kind":"structured","id":"NONEXISTENT-999"}]}]'), NULL);
-- ASSERT: claims=[] (empty), limitations contains "check1_existence"
