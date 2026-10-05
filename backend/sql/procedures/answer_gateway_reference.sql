-- Internal canonical quotation resolver. No application-role grant.
-- Publisher metadata describes the checked local PDF; origin is not byte-verified.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.ANSWER_GATEWAY_REFERENCE(
    REF_ID VARCHAR, KNOWN_AS_OF VARCHAR)
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS
$$
DECLARE
    v_matches ARRAY;
    v_clock TIMESTAMP_NTZ DEFAULT TRY_TO_TIMESTAMP_NTZ(KNOWN_AS_OF);
BEGIN
    IF (v_clock IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error','invalid_reference_cutoff');
    END IF;
    SELECT ARRAY_AGG(OBJECT_CONSTRUCT(
        'text','Reference source passage: ' || LEFT(c.text,4000),
        'claim_type','textual','evidence',ARRAY_CONSTRUCT(OBJECT_CONSTRUCT(
            'kind','reference_clause','id',c.chunk_id,'doc_id',d.doc_id,
            'page_index',c.page_index,'publisher',r.publisher,'document_title',r.title,
            'version',r.version,'jurisdiction',COALESCE(d.jurisdiction,'not_received'),
            'effective_date',COALESCE(TO_CHAR(d.effective_date,'YYYY-MM-DD'),'not_received')))))
      INTO :v_matches
      FROM SAARTHI.DOCUMENTS.DOC_CHUNK c
      JOIN SAARTHI.DOCUMENTS.DOCUMENT d ON d.doc_id=c.doc_id
      JOIN SAARTHI.DOCUMENTS.DOC_PAGE dp
        ON dp.doc_id=d.doc_id AND dp.page_index=c.page_index
      JOIN (SELECT column1 file_hash,column2 source_path,column3 publisher,
                   column4 title,column5 version FROM VALUES
        ('bf5f562d0b6fba773e99a8fc23ea53f916c70781aa62174d1567d00132fe01c1',
         'aiims_rishikesh_standard_treatment_guidelines.pdf',
         'Government of Gujarat',
         'Standard Treatment Guidelines: A Manual for Medical Therapeutics',
         'First Edition, 2013'),
        ('859f45ac6425f98a51576f2d1e74d0570d29a971a6fdc74321ec73a9bf71d867',
         'fda_herceptin_trastuzumab_label_2024.pdf',
         'U.S. Food and Drug Administration',
         'HERCEPTIN (trastuzumab) prescribing information',
         '06/2024; Reference ID 5399895'),
        ('a17b70025de98015cbdf41edc911eca384fff1aad07eecf6e80266f72b153c77',
         'icmr_breast_cancer_consensus_2016.pdf',
         'Indian Council of Medical Research',
         'Consensus Document for Management of Breast Cancer',
         '2016'),
        ('87d1be39fc1b6ecc8a97f13b263da083f85ce830f851cfd66e3b53f6a704a3eb',
         'icmr_stw_breast_cancer.pdf',
         'Indian Council of Medical Research',
         'Standard Treatment Workflow for Breast Cancer',
         'Edition not independently confirmed'),
        ('d2dfa8e147e9f047bf11ff7b956a20ed67a034bda36cdf8d22ff4ff113d49d57',
         'icmr_type2_diabetes_guidelines_2018.pdf',
         'Indian Council of Medical Research',
         'Guidelines for Management of Type 2 Diabetes',
         '2018'),
        ('6f270ea7df42a5655bcc97e71a193e95668ff7e8fe8bfd5cdfd0471c8832c226',
         'ncg_breast_cancer_guidelines_2019.pdf',
         'National Cancer Grid',
         'Breast Cancer Management Guidelines',
         '2019'),
        ('9bd399d781f57d7ae0009aa157697f78ca8a0b7507dc895d1eb56962fd1eaf61',
         'pmjay_health_benefit_package_2.2_manual.pdf',
         'National Health Authority',
         'National Health Benefit Package 2.2 User Guidelines',
         'November 2021')
      ) r ON d.file_hash=r.file_hash AND d.source_path=r.source_path
     WHERE c.chunk_id=:REF_ID AND c.doc_scope='reference' AND c.patient_id IS NULL
       AND d.scope='reference' AND d.patient_id IS NULL AND d.status='active'
       AND d.ingested_at<=:v_clock AND LENGTH(TRIM(c.text))>0
       AND CONTAINS(dp.text,c.text)
       AND (d.effective_date IS NULL OR d.effective_date<=TO_DATE(:v_clock));
    IF (COALESCE(ARRAY_SIZE(v_matches),0)!=1) THEN
        RETURN OBJECT_CONSTRUCT('error','unverified_reference');
    END IF;
    RETURN OBJECT_CONSTRUCT('claim',GET(v_matches,0),'limitations',ARRAY_CONSTRUCT(
        'Reference quotation is not a patient finding or treatment recommendation.',
        'Official origin, current edition and local applicability are not independently verified.',
        'Publication period is not an effective date; unknown effective dates are not_received.'));
END;
$$;
