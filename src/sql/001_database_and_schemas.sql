-- ============================================================
-- SAARTHI — Database, Schemas, Warehouse, Tags, Governance
-- Run as ACCOUNTADMIN on the HACKATHON connection
-- ============================================================

-- Database
CREATE DATABASE IF NOT EXISTS SAARTHI
  DATA_RETENTION_TIME_IN_DAYS = 90
  COMMENT = 'Patient-360 Care Readiness & Evidence Copilot — Hackathon 2026 GCC PS-04';

USE DATABASE SAARTHI;

-- Four schemas (architectural boundary: CORE, DOCUMENTS, EVIDENCE, OPERATIONAL)
CREATE SCHEMA IF NOT EXISTS CORE
  COMMENT = 'Patient demographics, encounters, clinical events, coverage, authorizations';
CREATE SCHEMA IF NOT EXISTS DOCUMENTS
  COMMENT = 'Ingested documents, pages, parsing pipeline artifacts';
CREATE SCHEMA IF NOT EXISTS EVIDENCE
  COMMENT = 'Extracted assertions, evidence links, reconciliation';
CREATE SCHEMA IF NOT EXISTS OPERATIONAL
  COMMENT = 'Review issues, tasks, answer runs, audit';

-- Governance schema for policies and tags
CREATE SCHEMA IF NOT EXISTS GOVERNANCE
  COMMENT = 'Tags, masking policies, row access policies, roles';

-- Stages for document ingestion
CREATE SCHEMA IF NOT EXISTS STAGES
  COMMENT = 'Internal stages for document upload';

-- Warehouse (use existing COMPUTE_WH for now, create a dedicated one for heavy AI tasks)
CREATE WAREHOUSE IF NOT EXISTS SAARTHI_AI_WH
  WAREHOUSE_SIZE = 'SMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  COMMENT = 'Dedicated warehouse for AI_PARSE_DOCUMENT, AI_COMPLETE, extraction tasks';
