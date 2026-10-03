// Pure guard/authorisation layer; imports no credentials and opens no connections.
import { createHash } from 'node:crypto';

export const SUBJECT = Object.freeze({patient_id:'PAT-DEEP-0001', doc_id:'DOC-E2E-HER2-SURGICAL-01', page_index:0, specimen_id:'SPEC-SURGICAL-001'});
export const MODELS = ['llama3.3-70b','claude-haiku-4-5','llama3.3-70b','claude-haiku-4-5'];
const RATES = {'llama3.3-70b':[0.36,0.36], 'claude-haiku-4-5':[0.50,2.50]};
export const sha = value => createHash('sha256').update(value).digest('hex');
export const fail = code => { throw new Error(code); };
export const field = (row,key) => row?.[Object.keys(row).find(k=>k.toLowerCase()===key.toLowerCase())];
export function cell(rows) {
  let value=Object.values(rows?.[0]??{})[0];
  if(typeof value==='string') { try { value=JSON.parse(value); } catch { fail('invalid_procedure_json'); } }
  if(!value || typeof value!=='object' || Array.isArray(value) || value.error) fail('scope_procedure_refused');
  return value;
}

export function checkApproval(config, now=Date.now()) {
  // A fresh human check in Snowsight is accepted explicitly, never invented from
  // the warehouse monitor. This is not an account-wide spending guarantee.
  if(config?.approvedBudgetUsd!==1 || config?.exclusiveWarehouse!==true) fail('test_approval_missing');
  const time=Date.parse(config.fundsCheckedAt);
  if(!Number.isFinite(time) || time>now || now-time>3600000 ||
      typeof config.availableFundsUsd!=='number' || !Number.isFinite(config.availableFundsUsd) || config.availableFundsUsd<1 ||
      config.fundsSource!=='Snowsight trial balance') fail('fresh_funds_confirmation_required');
  if(config.acceptEstimatedBilling!==true) fail('billing_uncertainty_not_accepted');
  // Published 2 October prices must be reviewed again after this short test window.
  if(now<Date.parse('2026-10-02T00:00:00Z') || now>=Date.parse('2026-10-10T00:00:00Z')) fail('pricing_review_required');
  return {approvedBudgetUsd:1, fundsVerification:'operator-reported Snowsight balance',
    availableFundsUsd:config.availableFundsUsd,fundsCheckedAt:config.fundsCheckedAt,
    // Reserve $0.70 for at most 90s of XS compute + 60s auto-suspend tail,
    // possible in-flight cancellation (10s), and metadata/cloud-services margin.
    // 1.35 credits/h * 160s * $9.75 / 3600 = $0.585; rest is margin.
    // NOT a metered account-wide cap. Concurrent usage is excluded/refused.
    supportingComputeReserveUsd:0.70, inferenceAllowanceUsd:0.10,
    unallocatedReserveUsd:0.20, billingIsEstimate:true};
}

export function checkMetadata({identity,defaultRole,warehouse,monitor,routing}) {
  if(identity?.A!=='JR18576' || identity?.U!=='SITAR' || identity?.R!=='GCP_ME_CENTRAL2') fail('unexpected_account_identity');
  if(defaultRole!=='SAARTHI_APP') fail('default_role_not_app');
  if(routing!=='ANY_REGION') fail('routing_changed');
  if(field(warehouse,'state')!=='SUSPENDED' || field(warehouse,'size')!=='X-Small' ||
      field(warehouse,'type')!=='STANDARD' || Number(field(warehouse,'max_cluster_count'))!==1 ||
      Number(field(warehouse,'auto_suspend'))!==60 || field(warehouse,'resource_monitor')!=='SAARTHI_PROTOTYPE_LIMIT') fail('warehouse_not_exclusive_bounded_xs');
  const used=Number(field(monitor,'used_credits')), quota=Number(field(monitor,'credit_quota'));
  const suspend=Number.parseFloat(field(monitor,'suspend_immediately_at'));
  if(!monitor || !Number.isFinite(used) || used<0 || used>=1.5 || quota!==2 || !Number.isFinite(suspend) || suspend>90) fail('monitor_reserve_unconfirmed');
}

export function scopedPage(rows,bindingId) {
  const result=cell(rows);
  if(result.binding_id!==bindingId || !Array.isArray(result.rows) || result.rows.length!==1 || !result.known_as_of) fail('unexpected_document_scope');
  const row=result.rows[0], text=field(row,'text');
  if(field(row,'doc_id')!==SUBJECT.doc_id || field(row,'page_index')!==0 || field(row,'scope')!=='patient' ||
      typeof text!=='string' || text.length>12000 || !text.includes(SUBJECT.patient_id) || !text.includes(SUBJECT.specimen_id)) fail('unexpected_source_page');
  return {...SUBJECT,text,text_sha256:sha(text),known_as_of:result.known_as_of,version:field(row,'version')};
}

export function requestQuote(payload) {
  if(!payload || Object.keys(payload).sort().join(',')!=='max_completion_tokens,messages,model,stream,temperature' ||
      !RATES[payload.model] || payload.temperature!==0 || payload.stream!==false || payload.max_completion_tokens!==1800 ||
      !Array.isArray(payload.messages) || payload.messages.length!==1 || payload.messages[0]?.role!=='user' ||
      Object.keys(payload.messages[0]).sort().join(',')!=='content,role') fail('invalid_model_request');
  const prompt=payload.messages[0].content;
  if(typeof prompt!=='string' || !prompt.trim() || Buffer.byteLength(prompt,'utf8')>24000) fail('prompt_limit');
  // Deliberately high local estimate: one token per UTF-8 byte plus 1024 for
  // framing. Returned usage must stay within it; no claim of exact tokenisation.
  const promptTokens=Buffer.byteLength(prompt,'utf8')+1024;
  const [input,output]=RATES[payload.model];
  return {promptTokens,completionTokens:1800,usd:(promptTokens*input+1800*output)*2.20/1e6};
}

export function usageCost(payload,response,quote) {
  const usage=response?.usage;
  if(!usage || !Number.isInteger(usage.prompt_tokens) || usage.prompt_tokens<1 ||
      !Number.isInteger(usage.completion_tokens) || usage.completion_tokens<0 ||
      usage.prompt_tokens>quote.promptTokens || usage.completion_tokens>1800) fail('usage_missing_or_over_bound');
  const [input,output]=RATES[payload.model];
  return {prompt_tokens:usage.prompt_tokens,completion_tokens:usage.completion_tokens,
    // ANY_REGION is $2 per AI credit; preflight reserves use $2.20 conservatively.
    estimatedInferenceUsd:(usage.prompt_tokens*input+usage.completion_tokens*output)*2/1e6};
}

export class Trial {
  constructor({app,admin,infer,clock=()=>Date.now()}) {
    this.app=app; this.admin=admin; this.infer=infer; this.clock=clock;
    this.attempts=0; this.observations=[]; this.stopped=false;
  }
  async open() {
    this.started=this.clock();
    const identity=(await this.app('SELECT CURRENT_ROLE() AS ROLE, CURRENT_USER() AS USER'))[0];
    // The bridge already ran USE SECONDARY ROLES NONE in this exact session.
    if(identity?.ROLE!=='SAARTHI_APP' || identity?.USER!=='SITAR') fail('application_identity_unverified');
    const bound=cell(await this.app('CALL SAARTHI.OPERATIONAL.BIND_PATIENT(?)',[SUBJECT.patient_id]));
    if(typeof bound.binding_id!=='string' || !bound.binding_id) fail('binding_failed');
    this.binding=bound.binding_id;
    this.page=await this.read();
    return this.page;
  }
  read() { return this.app("CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('document',?)",[SUBJECT.doc_id]).then(rows=>scopedPage(rows,this.binding)); }
  plan(payloads) {
    if(this.planHashes || !Array.isArray(payloads) || payloads.length!==4 || payloads.some((p,i)=>p.model!==MODELS[i])) fail('invalid_four_call_plan');
    const quotes=payloads.map(requestQuote);
    if(quotes.reduce((sum,q)=>sum+q.usd,0)>0.10) fail('inference_budget_exceeded');
    if(payloads[0].messages[0].content!==payloads[1].messages[0].content || payloads[2].messages[0].content!==payloads[3].messages[0].content) fail('reader_prompts_not_independent');
    if(payloads.some(p=>!p.messages[0].content.includes(this.page.text))) fail('planned_source_mismatch');
    this.planHashes=payloads.map(p=>sha(JSON.stringify(p))); this.quotes=quotes;
    return {plannedCalls:4,inferenceReserveUsd:quotes.reduce((s,q)=>s+q.usd,0)};
  }
  async complete(payload) {
    if(this.stopped || !this.planHashes || this.attempts>=4) fail('trial_stopped_or_exhausted');
    try {
      if(this.clock()-this.started>65000) fail('trial_dispatch_deadline');
      const i=this.attempts;
      if(sha(JSON.stringify(payload))!==this.planHashes[i]) fail('request_differs_from_plan');
      const current=await this.read(); // real server-side membership + consent check per call
      if(current.text_sha256!==this.page.text_sha256 || current.version!==this.page.version) fail('source_changed');
      const details=await this.admin('DESCRIBE USER SITAR');
      if(field(details.find(r=>field(r,'property')==='DEFAULT_ROLE'),'value')!=='SAARTHI_APP') fail('default_role_changed');
      const started=this.clock();
      this.attempts++; // dispatch failure consumes a call; never retry
      let response;
      try { response=await this.infer(payload); }
      catch(error) {
        this.observations.push({call:this.attempts,model:payload.model,elapsed_ms:this.clock()-started,status:'request_failed_usage_unavailable'});
        throw error;
      }
      this.observations.push({call:this.attempts,model:payload.model,elapsed_ms:this.clock()-started,status:'usage_unverified'});
      Object.assign(this.observations.at(-1),usageCost(payload,response,this.quotes[i]),{status:'response_received'});
      return response;
    } catch(error) { this.stopped=true; throw error; }
  }
  async close() {
    this.stopped=true;
    if(this.binding) await this.app('CALL SAARTHI.OPERATIONAL.RELEASE_PATIENT_BINDING()');
  }
}
