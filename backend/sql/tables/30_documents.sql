-- =============================================================================
-- STEP 6c - DOCUMENTS tables (4)
-- =============================================================================
-- SPEC.md §2.6, §3. The DOC_PAGE / DOC_CHUNK split is platform-forced, not
-- stylistic (F4): CREATE CORTEX SEARCH SERVICE fails on a RAP-protected table,
-- so the index (DOC_CHUNK) must be un-RAP'd and return IDs only; content lives
-- in DOC_PAGE, which gets the row access policy in step 8. This IS Layer 3 of R5.
CREATE TABLE IF NOT EXISTS SAARTHI.DOCUMENTS.DOCUMENT (
    doc_id             VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    patient_id         VARCHAR,                     -- NULL for reference-corpus docs
    scope              VARCHAR NOT NULL CHECK (scope IN ('patient','reference')),  -- R6 starts here
    doc_type           VARCHAR,
    version            INT     DEFAULT 1,
    accession_id       VARCHAR,
    revision_type      VARCHAR CHECK (revision_type IN ('original','appended','amended','corrected')),
    file_hash          VARCHAR,                     -- SHA-256, ours, for dedup
    attachment_hash    VARCHAR,                     -- SHA-1, from FHIR Attachment.hash - kept separate
    source_quality     VARCHAR CHECK (source_quality IN ('clean_pdf','scanned','photo','rotated_photo','handwritten')),
    signed_at          TIMESTAMP_NTZ,
    effective_at       TIMESTAMP_NTZ,
    ingested_at        TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),  -- R2
    supersedes_doc_id  VARCHAR,
    source_facility_id VARCHAR,
    ingestion_method   VARCHAR CHECK (ingestion_method IN
                            ('fhir_bundle','hl7','digital_emr','physical_folder','whatsapp_photo','downloaded_pdf')),
    jurisdiction       VARCHAR,                     -- reference docs
    effective_date     DATE,                        -- reference docs
    status             VARCHAR CHECK (status IN ('active','duplicate','unreadable'))
);

-- RAP-PROTECTED (F3, F4) - the governed content store. Row access policy
-- attached in step 8, keyed on CURRENT_USER(), never CURRENT_ROLE() (F3).
CREATE TABLE IF NOT EXISTS SAARTHI.DOCUMENTS.DOC_PAGE (
    doc_id      VARCHAR NOT NULL,
    page_index  INT     NOT NULL,
    text        VARCHAR,
    char_count  INT,
    PRIMARY KEY (doc_id, page_index)
);

-- NO RAP (F4 forces this) - search index source only, returns chunk IDs.
-- Content is re-fetched from DOC_PAGE through a governed procedure (Layer 3).
CREATE TABLE IF NOT EXISTS SAARTHI.DOCUMENTS.DOC_CHUNK (
    chunk_id       VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    doc_id         VARCHAR NOT NULL,
    page_index     INT,
    chunk_index    INT,
    text           VARCHAR,
    doc_scope      VARCHAR CHECK (doc_scope IN ('patient','reference')),
    patient_id     VARCHAR,
    doc_type       VARCHAR,
    doc_version    INT,
    jurisdiction   VARCHAR,
    effective_date DATE
);

-- Semi-structured ingestion path - explainer names this a distinct category
-- twice. Bundle.entry[] flattened via LATERAL FLATTEN into CORE tables.
CREATE TABLE IF NOT EXISTS SAARTHI.DOCUMENTS.RAW_FHIR_BUNDLE (
    bundle_id       VARCHAR DEFAULT UUID_STRING() PRIMARY KEY,
    source_id       VARCHAR,
    payload         VARIANT,
    bundle_type     VARCHAR,
    received_at     TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    processed_at    TIMESTAMP_NTZ,
    process_status  VARCHAR,
    error_detail    VARCHAR
);
