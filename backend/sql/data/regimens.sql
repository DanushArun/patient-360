-- =============================================================================
-- STEP 11b - Regimen registry
-- =============================================================================
-- One row per regimen the synthetic cohort receives. protocol_ref is the id
-- of the governing document in evidence/clinical/sources.yaml; every number a
-- rule applies for this regimen is quoted, with page, in
-- evidence/clinical/requirements.yaml and checked by
-- backend/scripts/verify_clinical_proof.py.
--
-- MERGE with UPDATE-on-match: this file is the source of truth, so a redeploy
-- propagates a corrected row rather than freezing the first load.
MERGE INTO SAARTHI.OPERATIONAL.REGIMEN_REGISTRY t
USING (
  SELECT column1 AS regimen_code, column2 AS regimen_name, PARSE_JSON(column3) AS agents,
         column4::INT AS cycle_days, column5::BOOLEAN AS myelosuppressive,
         column6 AS threshold_profile, column7 AS protocol_ref, column8 AS protocol_url
  FROM VALUES
    ('AC',        'Doxorubicin + cyclophosphamide, 3-weekly',          '["doxorubicin","cyclophosphamide"]', 21, TRUE,  'AC',        'BRAJAC',   'https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Breast/BRAJAC_Protocol.pdf'),
    ('TH',        'Paclitaxel weekly + trastuzumab',                   '["paclitaxel","trastuzumab"]',       7,  TRUE,  'TH',        'BRAJTTW',  'https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Breast/BRAJTTW_Protocol.pdf'),
    ('H-MAINT',   'Trastuzumab alone, 3-weekly',                       '["trastuzumab"]',                    21, FALSE, 'H-MAINT',   'BRAJTR',   'https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Breast/BRAJTR_Protocol.pdf'),
    ('FOLFOX',    'Oxaliplatin + fluorouracil + leucovorin, 2-weekly', '["oxaliplatin","fluorouracil","leucovorin"]', 14, TRUE, 'FOLFOX', 'GIAJFFOX', 'https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Gastrointestinal/GIAJFFOX_Protocol.pdf'),
    ('CAPOX',     'Capecitabine + oxaliplatin, 3-weekly',              '["capecitabine","oxaliplatin"]',     21, TRUE,  'CAPOX',     'GIGAVCOX', 'https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Gastrointestinal/GIGAVCOX_Protocol.pdf'),
    ('CIS-RT-HN', 'Cisplatin 100 mg/m2 3-weekly with radiation, head and neck', '["cisplatin"]',             21, TRUE,  'CIS-RT-HN', 'HNLAPRT',  'https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Head%20and%20Neck/HNLAPRT_Protocol.pdf'),
    ('CIS-RT-CX', 'Cisplatin 40 mg/m2 weekly with radiation, cervix',  '["cisplatin"]',                      7,  TRUE,  'CIS-RT-CX', 'GOCXCRT',  'https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Gynecology/GOCXCRT_Protocol.pdf'),
    ('PEM-CARBO', 'Pemetrexed + carboplatin, 3-weekly',                '["pemetrexed","carboplatin"]',       21, TRUE,  'PEM-CARBO', 'LUAVPP',   'https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Lung/LUAVPP_Protocol.pdf'),
    -- Deep case (PAT-DEEP-0001): AC completed, now in the 3-weekly paclitaxel +
    -- trastuzumab phase of BRAJACTT, so thresholds come from that protocol.
    ('AC-TH',     'AC then paclitaxel 175 mg/m2 + trastuzumab, 3-weekly (TH phase)', '["paclitaxel","trastuzumab"]', 21, TRUE, 'AC-TH', 'BRAJACTT', 'https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Breast/BRAJACTT_Protocol.pdf'),
    ('AC-TH-ZOL', 'AC then paclitaxel + trastuzumab, 3-weekly, with zoledronic acid (TH phase)', '["paclitaxel","trastuzumab","zoledronic acid"]', 21, TRUE, 'AC-TH', 'BRAJACTT', 'https://www.bccancer.bc.ca/chemotherapy-protocols-site/Documents/Breast/BRAJACTT_Protocol.pdf')
) s
ON t.regimen_code = s.regimen_code
WHEN MATCHED THEN UPDATE SET
  t.regimen_name = s.regimen_name, t.agents = s.agents, t.cycle_days = s.cycle_days,
  t.myelosuppressive = s.myelosuppressive, t.threshold_profile = s.threshold_profile,
  t.protocol_ref = s.protocol_ref, t.protocol_url = s.protocol_url
WHEN NOT MATCHED THEN INSERT (regimen_code, regimen_name, agents, cycle_days, myelosuppressive,
  threshold_profile, protocol_ref, protocol_url)
VALUES (s.regimen_code, s.regimen_name, s.agents, s.cycle_days, s.myelosuppressive,
  s.threshold_profile, s.protocol_ref, s.protocol_url);
