#!/usr/bin/env node
// Explicitly approved one existing synthetic PDF only. No batch ingestion or automatic retry.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {session,cell,statements,field} from './bounded-session.mjs';
const localFile=process.argv[2];
const source=new URL('../../data/generated/pdf/EVT-HER2-SURGICAL',import.meta.url);
if(!localFile || !localFile.startsWith('/private/tmp/'))throw new Error('Expected inspected temporary PDF copy');
const hash=b=>createHash('sha256').update(b).digest('hex');
const sha=hash(readFileSync(source));if(hash(readFileSync(localFile))!==sha)throw new Error('PDF is not the existing project report');
const doc='DOC-E2E-HER2-SURGICAL-01',patient='PAT-DEEP-0001',path='PAT-DEEP-0001/'+localFile.split('/').at(-1);
const services=['PATIENT_DOC_SEARCH','REFERENCE_DOC_SEARCH'];
const s=await session('saarthi_one_document_test');let searchTouched=false;
try{
 const existing=await s.q('SELECT doc_id FROM SAARTHI.DOCUMENTS.DOCUMENT WHERE doc_id=? OR (patient_id=? AND file_hash=?)',[doc,patient,sha]);
 if(existing.length)throw new Error('Document already ingested; inspect checkpoint, do not repeat paid calls');
 const events=await s.q("SELECT event_id,patient_id,event_time::VARCHAR AS EVENT_TIME,source_recorded_at::VARCHAR AS SOURCE_RECORDED_AT,specimen_id FROM SAARTHI.CORE.CLINICAL_EVENT WHERE event_id='EVT-HER2-SURGICAL' AND patient_id='PAT-DEEP-0001'");
 if(events.length!==1)throw new Error('Existing source identity not found');const event=events[0];
 const [links]=await s.q("SELECT COUNT(*) AS N FROM SAARTHI.CORE.ID_MAP WHERE patient_id='PAT-DEEP-0001' AND link_status IN ('abha_linked','manually_verified')");if(!links.N)throw new Error('No verified source identity');
 await s.q("PUT 'file://"+localFile+"' @SAARTHI.STAGES.PATIENT_DOCS/PAT-DEEP-0001/ AUTO_COMPRESS=FALSE OVERWRITE=FALSE");
 const parsed=cell(await s.q("SELECT AI_PARSE_DOCUMENT(TO_FILE('@SAARTHI.STAGES.PATIENT_DOCS',?),{'mode':'LAYOUT','page_split':TRUE})",[path]));
 if(parsed?.metadata?.pageCount!==1 || parsed.pages?.length!==1 || !parsed.pages[0].content || parsed.pages[0].content.length>12000)throw new Error('Unexpected parse size or shape');
 const text=parsed.pages[0].content;
 if(!text.includes(patient)||!text.includes('SPEC-SURGICAL-001'))throw new Error('Parsed identity does not match existing report');
 await s.q('BEGIN TRANSACTION');
 try{
 await s.q("INSERT INTO SAARTHI.DOCUMENTS.DOCUMENT(doc_id,patient_id,scope,doc_type,accession_id,file_hash,source_quality,signed_at,effective_at,ingested_at,source_facility_id,ingestion_method,status) SELECT ?,?,'patient','pathology',?,?,'clean_pdf',TO_TIMESTAMP_NTZ(?),TO_TIMESTAMP_NTZ(?),CURRENT_TIMESTAMP(),'FAC-02','downloaded_pdf','active'",[doc,patient,event.SPECIMEN_ID,sha,event.SOURCE_RECORDED_AT,event.EVENT_TIME]);
 await s.q('INSERT INTO SAARTHI.DOCUMENTS.DOC_PAGE(doc_id,page_index,text,char_count) VALUES(?,0,?,?)',[doc,text,text.length]);
 await s.q('COMMIT');
 }catch(e){await s.q('ROLLBACK');throw e;}
 console.log('PARSED_ONE_PAGE',doc,'characters',text.length);
 await s.q('USE ROLE SAARTHI_APP');
 const bound=cell(await s.q('CALL SAARTHI.OPERATIONAL.BIND_PATIENT(?)',[patient]));if(bound.error)throw new Error(bound.error);
 const extraction=cell(await s.q('CALL SAARTHI.OPERATIONAL.EXTRACT_ONE_DOCUMENT(?)',[doc]));console.log('EXTRACTION',JSON.stringify(extraction));if(extraction.error)throw new Error(extraction.error);
 await s.q('USE ROLE ACCOUNTADMIN');
 const assertions=await s.q("SELECT assertion_id,predicate,value,verification_status,pass1_value,pass2_value,char_start,char_end FROM SAARTHI.EVIDENCE.ASSERTION WHERE doc_id=?",[doc]);
 console.log('VERIFICATION',JSON.stringify(assertions));
 if(!assertions.some(a=>a.PREDICATE==='HER2_IHC'&&a.VERIFICATION_STATUS==='verified'&&a.VALUE==='2+'))throw new Error('HER2 finding did not verify; do not force a value');
 await s.q("INSERT INTO SAARTHI.DOCUMENTS.DOC_CHUNK(chunk_id,doc_id,page_index,chunk_index,text,doc_scope,patient_id,doc_type,doc_version) SELECT dp.doc_id||'-'||dp.page_index,dp.doc_id,dp.page_index,0,dp.text,d.scope,d.patient_id,d.doc_type,d.version FROM SAARTHI.DOCUMENTS.DOC_PAGE dp JOIN SAARTHI.DOCUMENTS.DOCUMENT d ON d.doc_id=dp.doc_id WHERE d.doc_id=? AND NOT EXISTS (SELECT 1 FROM SAARTHI.DOCUMENTS.DOC_CHUNK c WHERE c.doc_id=d.doc_id)",[doc]);
 if((await s.q('SHOW CORTEX SEARCH SERVICES IN DATABASE SAARTHI')).length)throw new Error('Unexpected existing Search service; inspect before altering');
 searchTouched=true;
 for(const file of ['01_patient_doc_search.sql','02_reference_doc_search.sql']){
  for(const sql of statements(readFileSync(new URL('../sql/search/'+file,import.meta.url),'utf8')))await s.q(sql);
 }
 await s.q('USE ROLE SAARTHI_APP');
 const hits=cell(await s.q("CALL SAARTHI.OPERATIONAL.SEARCH_PATIENT_DOCUMENTS('HER2 IHC surgical specimen',NULL)"));
 if(hits.error||!hits.results?.some(r=>r.doc_id===doc))throw new Error('Approved report not returned by patient Search');
 console.log('PASS patient Search returns selected source page');
 const page=cell(await s.q("CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('document',?)",[doc]));if(page.error||page.rows?.[0]?.TEXT!==text)throw new Error('Cited page mismatch');
 console.log('PASS exact source page read through app role');
 const reference=cell(await s.q("CALL SAARTHI.OPERATIONAL.SEARCH_REFERENCE_DOCUMENTS('HER2',NULL,NULL)"));
 if(reference.results?.length)throw new Error('Expected empty reference corpus');
 console.log('PASS empty reference corpus returns no patient results; reference-document retrieval NOT verified');
 const gates=cell(await s.q('CALL SAARTHI.OPERATIONAL.GET_READINESS(NULL,NULL)'));
 if(gates.error)throw new Error(gates.error);console.log('SQL_READINESS',gates.gates.length,'rules; no clinical event overwritten');
 await s.q('CALL SAARTHI.OPERATIONAL.RELEASE_PATIENT_BINDING()');
 await s.q("CALL SAARTHI.OPERATIONAL.BIND_PATIENT('PAT-DC-07')");
 const wrong=cell(await s.q("CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('document',?)",[doc]));if(wrong.error||wrong.rows.length!==0)throw new Error('Cross-patient document visible');
 console.log('PASS foreign document blocked even when practitioner has both patients');
}catch(e){console.error('ONE_DOCUMENT_STOPPED',e.message);process.exitCode=1;}
finally{
 if(searchTouched){
  await s.q('USE ROLE ACCOUNTADMIN');
  for(const name of services){try{await s.q('ALTER CORTEX SEARCH SERVICE IF EXISTS SAARTHI.DOCUMENTS.'+name+' SUSPEND');}catch(e){console.error('SUSPEND_FAILED',name,e.message);process.exitCode=1;}}
  const states=await s.q('SHOW CORTEX SEARCH SERVICES IN DATABASE SAARTHI');
  console.log('FINAL_SEARCH_STATE',JSON.stringify(states.map(r=>({name:field(r,'name'),indexing_state:field(r,'indexing_state'),serving_state:field(r,'serving_state')}))));
 }
 await s.close();
}
