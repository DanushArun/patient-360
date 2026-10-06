-- =============================================================================
-- STEP 3 - Database and 7 schemas
-- =============================================================================
-- CORE - DOCUMENTS - EVIDENCE - OPERATIONAL - GOVERNANCE - STAGES - EVAL
-- EVAL is not optional: the eval truth key lives there and must be unreachable
-- by the app role, or the system can read its own answer key (WORK-PLAN.md).
--
-- The SAARTHI database and 6 of these 7 schemas already exist in this account,
-- created 16 Sept by an archived v1 script.
-- CREATE ... IF NOT EXISTS leaves them untouched here; legacy v1 TABLES inside
-- CORE and GOVERNANCE are dropped explicitly in step 6's table files, because
-- IF NOT EXISTS cannot fix a table that exists with the wrong (v1) columns.
CREATE DATABASE IF NOT EXISTS SAARTHI
  COMMENT = 'Patient-360 Care Readiness & Evidence Copilot - Hackathon 2026 GCC PS-04';

CREATE SCHEMA IF NOT EXISTS SAARTHI.CORE
  COMMENT = 'Patient demographics, encounters, clinical events, coverage, authorizations';
CREATE SCHEMA IF NOT EXISTS SAARTHI.DOCUMENTS
  COMMENT = 'Ingested documents, pages, parsing pipeline artifacts';
CREATE SCHEMA IF NOT EXISTS SAARTHI.EVIDENCE
  COMMENT = 'Extracted assertions, evidence links, reconciliation';
CREATE SCHEMA IF NOT EXISTS SAARTHI.OPERATIONAL
  COMMENT = 'Review issues, tasks, answer runs, audit';
CREATE SCHEMA IF NOT EXISTS SAARTHI.GOVERNANCE
  COMMENT = 'Tags, masking policies, row access policies';
CREATE SCHEMA IF NOT EXISTS SAARTHI.STAGES
  COMMENT = 'Internal stages for document upload';
CREATE SCHEMA IF NOT EXISTS SAARTHI.EVAL
  COMMENT = 'Eval truth key - never granted to the app role';
