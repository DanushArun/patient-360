-- =============================================================================
-- STEP 5 - Stages   *** RED STEP ***
-- =============================================================================
-- PATIENT_DOCS - REFERENCE_DOCS - SKILLS
-- ALL THREE: ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE') and DIRECTORY = (ENABLE = TRUE).
-- F9 (AGENTS.md #7): AI functions cannot read SNOWFLAKE_FULL, user stages (@~)
-- or table stages. Wrong encryption fails at PARSE time, not at CREATE time -
-- days later, in a different file, with an unrelated-looking error.
CREATE STAGE IF NOT EXISTS SAARTHI.STAGES.PATIENT_DOCS
  ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE')
  DIRECTORY = (ENABLE = TRUE)
  COMMENT = 'Patient PDF/JPEG/PNG uploads - unstructured ingestion path';

CREATE STAGE IF NOT EXISTS SAARTHI.STAGES.REFERENCE_DOCS
  ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE')
  DIRECTORY = (ENABLE = TRUE)
  COMMENT = 'Real regulatory/clinical reference documents - R6 reference corpus';

CREATE STAGE IF NOT EXISTS SAARTHI.STAGES.SKILLS
  ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE')
  DIRECTORY = (ENABLE = TRUE)
  COMMENT = 'SKILL.md files for the 4 CoCo skills, referenced by folder';

GRANT READ, WRITE ON STAGE SAARTHI.STAGES.PATIENT_DOCS TO ROLE SAARTHI_APP;
GRANT READ ON STAGE SAARTHI.STAGES.REFERENCE_DOCS TO ROLE SAARTHI_APP;
GRANT READ ON STAGE SAARTHI.STAGES.SKILLS TO ROLE SAARTHI_APP;
