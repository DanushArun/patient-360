-- TEST-MANIFEST.md #4, t42. "Is she ready?" is the named ambiguous case:
-- neither a keyword-scan Class A trigger nor a clear structural Class B
-- lookup. Caught a real bug live: an earlier structure-scan regex used
-- generic words ("is","are","what") and wrongly classified this as
-- CLASS_B/structure before ever reaching the ambiguous case.
CALL SAARTHI.OPERATIONAL.classify_question('Is she ready?');
-- ASSERT: classification = "CLASS_A"
