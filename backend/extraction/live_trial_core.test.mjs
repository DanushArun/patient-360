import test from 'node:test';
import assert from 'node:assert/strict';
import {checkApproval,checkMetadata,scopedPage,Trial,requestQuote,SUBJECT} from './live_trial_core.mjs';

const now=Date.parse('2026-10-03T10:00:00Z');
const safeApproval={approvedBudgetUsd:1,exclusiveWarehouse:true,
  fundsCheckedAt:'2026-10-03T09:30:00Z',availableFundsUsd:10,
  fundsSource:'Snowsight trial balance',acceptEstimatedBilling:true};
const source=`Patient: ${SUBJECT.patient_id}\nSpecimen: ${SUBJECT.specimen_id}\nHER2 IHC: 2+`;
const pageResult=(text=source)=>[{VALUE:{binding_id:'binding-1',known_as_of:'2026-10-03T09:30:00',
  rows:[{DOC_ID:SUBJECT.doc_id,PAGE_INDEX:0,SCOPE:'patient',VERSION:1,TEXT:text}]}}];
const request=(model,prompt)=>({model,messages:[{role:'user',content:prompt}],temperature:0,max_completion_tokens:1800,stream:false});
const plan=()=>[request('llama3.3-70b',source),request('claude-haiku-4-5',source),
                  request('llama3.3-70b',source+'\nRead'),request('claude-haiku-4-5',source+'\nRead')];

test('budget check requires fresh verified operator funds and explicit exclusive use',()=>{
  assert.equal(checkApproval(safeApproval,now).approvedBudgetUsd,1);
  for(const broken of [
    {...safeApproval,availableFundsUsd:0.99},
    {...safeApproval,fundsCheckedAt:'2026-10-03T08:00:00Z'},
    {...safeApproval,exclusiveWarehouse:false},
    {...safeApproval,acceptEstimatedBilling:false},
  ]) assert.throws(()=>checkApproval(broken,now));
});

test('metadata gates refuse admin default, active warehouse and lost monitor',()=>{
  const base={identity:{A:'JR18576',U:'SITAR',R:'GCP_ME_CENTRAL2'},defaultRole:'SAARTHI_APP',routing:'ANY_REGION',
    warehouse:{state:'SUSPENDED',size:'X-Small',type:'STANDARD',max_cluster_count:1,auto_suspend:60,resource_monitor:'SAARTHI_PROTOTYPE_LIMIT'},
    monitor:{used_credits:'1.33',credit_quota:'2.00',suspend_immediately_at:'90%'}};
  assert.doesNotThrow(()=>checkMetadata(base));
  assert.throws(()=>checkMetadata({...base,defaultRole:'ACCOUNTADMIN'}));
  assert.throws(()=>checkMetadata({...base,warehouse:{...base.warehouse,state:'STARTED'}}));
  assert.throws(()=>checkMetadata({...base,monitor:{...base.monitor,used_credits:'1.8'}}));
});

test('bound page is checked against exact source identity',()=>{
  assert.equal(scopedPage(pageResult(),'binding-1').text,source);
  assert.throws(()=>scopedPage(pageResult(),'foreign-binding'));
  assert.throws(()=>scopedPage(pageResult('wrong patient'),'binding-1'));
});

test('four-call trial reauthorises every call and never retries after revocation',async()=>{
  let documentReads=0, dispatched=0;
  const app=async(sql)=>{
    if(sql.startsWith('SELECT CURRENT_ROLE')) return [{ROLE:'SAARTHI_APP',USER:'SITAR'}];
    if(sql.includes('BIND_PATIENT')) return [{VALUE:{binding_id:'binding-1'}}];
    if(sql.includes('GET_WEB_PATIENT_DATA')) { documentReads++; return documentReads===3?
      [{VALUE:{error:'access_withdrawn'}}]:pageResult(); }
    if(sql.includes('RELEASE_PATIENT_BINDING')) return [{VALUE:{ok:true}}];
    throw new Error('unexpected_sql');
  };
  const admin=async()=>[{property:'DEFAULT_ROLE',value:'SAARTHI_APP'}];
  const trial=new Trial({app,admin,infer:async()=>{dispatched++;return {usage:{prompt_tokens:50,completion_tokens:10}};}});
  await trial.open(); trial.plan(plan());
  await trial.complete(plan()[0]);
  await assert.rejects(()=>trial.complete(plan()[1]),/scope_procedure_refused/);
  assert.equal(dispatched,1);
  assert.equal(trial.attempts,1);
  await assert.rejects(()=>trial.complete(plan()[1]));
  await trial.close();
});

test('request cost and plan reject changed prompt, extra fields, and oversize',async()=>{
  assert.ok(requestQuote(plan()[0]).usd>0);
  assert.throws(()=>requestQuote({...plan()[0],unexpected:true}));
  assert.throws(()=>requestQuote(request('llama3.3-70b','x'.repeat(24001))));
  const app=async(sql)=>{
    if(sql.startsWith('SELECT CURRENT_ROLE')) return [{ROLE:'SAARTHI_APP',USER:'SITAR'}];
    if(sql.includes('BIND_PATIENT')) return [{VALUE:{binding_id:'binding-1'}}];
    return pageResult();
  };
  const trial=new Trial({app,admin:async()=>[{property:'DEFAULT_ROLE',value:'SAARTHI_APP'}],
    infer:async()=>({usage:{prompt_tokens:50,completion_tokens:10}})});
  await trial.open();trial.plan(plan());
  await assert.rejects(()=>trial.complete(request('llama3.3-70b',source+' altered')),/request_differs_from_plan/);
  assert.equal(trial.attempts,0);
});
