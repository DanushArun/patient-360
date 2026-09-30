-- Run after deploying procedures/classify_question.sql.
-- The result must show the expected class and method for each question.

CALL SAARTHI.OPERATIONAL.CLASSIFY_QUESTION('What is wrong with this patient?');
-- Expected: CLASS_A / keyword. Clinical assessment remains refused.

CALL SAARTHI.OPERATIONAL.CLASSIFY_QUESTION('What is wrong with this patient''s record?');
-- Expected: CLASS_B / structure. This asks about documented record state.

CALL SAARTHI.OPERATIONAL.CLASSIFY_QUESTION('What is missing?');

-- Plural record-state wording must remain Class B instead of falling through
-- to AI_CLASSIFY and being mistaken for a clinical judgment request.
CALL SAARTHI.OPERATIONAL.CLASSIFY_QUESTION('What are the conflicts?');
CALL SAARTHI.OPERATIONAL.CLASSIFY_QUESTION('What are the contradictions?');

-- This is ambiguous; trial accounts without AI_CLASSIFY must return a handled
-- classification_unavailable response without invoking the answer agent.
CALL SAARTHI.OPERATIONAL.CLASSIFY_QUESTION('And what is next?');
