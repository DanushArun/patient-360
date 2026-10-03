#!/usr/bin/env node
// Private stdio bridge: no listening port, token in output, or arbitrary SQL RPC.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createPrivateKey, createPublicKey, createHash, sign } from 'node:crypto';
import https from 'node:https';
import readline from 'node:readline';
import { snowflakeDriverConfig } from '../../web/lib/snowflake-driver-config.mjs';
import { checkApproval,checkMetadata,field,Trial,fail } from './live_trial_core.mjs';

if(process.argv[2]!=='--approved-live-trial') throw new Error('explicit_live_flag_required');
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
const require=createRequire(new URL('../../web/package.json',import.meta.url));
const sf=require('snowflake-sdk'); sf.configure(snowflakeDriverConfig);
let adminConn,appConn,trial,key,approval,cleanupStarted=false,warehouseSelected=false;
const queryIds=[];
let deadline=setTimeout(()=>{send({error:'connection_deadline'});process.exit(1);},45000);

const query=c=>(sqlText,binds=[])=>new Promise((resolve,reject)=>c.execute({sqlText,binds,complete(error,stmt,rows){
  if(stmt?.getStatementId()) queryIds.push(stmt.getStatementId());
  if(error) reject(new Error('sql_'+String(error.code??'failed'))); else resolve(rows??[]);
}}));
async function connect(role) {
  const connection=sf.createConnection({account:'OHCXVXM-OS69400',username:'SITAR',role,
    authenticator:'SNOWFLAKE_JWT',privateKey:key,loginTimeout:15,timeout:15000,clientSessionKeepAlive:false});
  if(role==='ACCOUNTADMIN') adminConn=connection; else appConn=connection;
  await connection.connectAsync();
  const q=query(connection);
  await q('USE SECONDARY ROLES NONE');
  await q("ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS=5, STATEMENT_QUEUED_TIMEOUT_IN_SECONDS=5, QUERY_TAG='saarthi_langextract_one_page'");
  return q;
}
function jwt() {
  const publicDER=createPublicKey(createPrivateKey(key)).export({type:'spki',format:'der'});
  const fp='SHA256:'+createHash('sha256').update(publicDER).digest('base64');
  const now=Math.floor(Date.now()/1000), subject='JR18576.SITAR';
  const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const data=enc({alg:'RS256',typ:'JWT'})+'.'+enc({iss:subject+'.'+fp,sub:subject,iat:now,exp:now+60});
  return data+'.'+sign('RSA-SHA256',Buffer.from(data),key).toString('base64url');
}
function infer(payload) {
  return new Promise((resolve,reject)=>{
    const body=JSON.stringify(payload);
    const req=https.request('https://ohcxvxm-os69400.snowflakecomputing.com/api/v2/cortex/v1/chat/completions',{
      method:'POST',rejectUnauthorized:true,headers:{'Content-Type':'application/json',
        'Content-Length':Buffer.byteLength(body),'Authorization':'Bearer '+jwt(),
        'X-Snowflake-Authorization-Token-Type':'KEYPAIR_JWT'},
    },res=>{
      let size=0;const chunks=[];
      res.on('data',chunk=>{size+=chunk.length;if(size>65536)res.destroy(new Error('response_limit'));else chunks.push(chunk);});
      res.on('error',()=>reject(new Error('cortex_response_failed')));
      res.on('end',()=>{
        if(res.statusCode!==200) return reject(new Error('cortex_http_'+res.statusCode));
        try {resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(new Error('cortex_invalid_json'));}
      });
    });
    // No redirects, retries, proxies, fallback model or disabled TLS checks.
    const timer=setTimeout(()=>req.destroy(new Error('cortex_timeout')),20000);
    req.on('close',()=>clearTimeout(timer));req.on('error',()=>reject(new Error('cortex_network_failed')));
    req.end(body);
  });
}
async function open(config) {
  if(approval) fail('already_open');
  approval=checkApproval(config);
  key=readFileSync(process.env.SNOWFLAKE_PRIVATE_KEY_PATH||join(homedir(),'.snowflake','keys','sitar_snow_rsa.p8'),'utf8');
  const admin=await connect('ACCOUNTADMIN');
  const [identity]=await admin('SELECT CURRENT_ACCOUNT() AS A, CURRENT_USER() AS U, CURRENT_REGION() AS R');
  const details=await admin('DESCRIBE USER SITAR');
  const [warehouse]=await admin("SHOW WAREHOUSES LIKE 'SAARTHI_AI_WH'");
  const [monitor]=await admin("SHOW RESOURCE MONITORS LIKE 'SAARTHI_PROTOTYPE_LIMIT'");
  const [routing]=await admin("SHOW PARAMETERS LIKE 'CORTEX_ENABLED_CROSS_REGION' IN ACCOUNT");
  checkMetadata({identity,defaultRole:field(details.find(r=>field(r,'property')==='DEFAULT_ROLE'),'value'),warehouse,monitor,routing:field(routing,'value')});
  const app=await connect('SAARTHI_APP');
  // All patient reads below use this separate, restricted connection.
  // The administrator connection is only for metadata and final idle suspension.
  warehouseSelected=true; // cleanup even if USE succeeds but a later step fails
  await app('USE WAREHOUSE SAARTHI_AI_WH');
  clearTimeout(deadline);
  deadline=setTimeout(()=>{
    send({error:'trial_wall_clock_limit',calls:trial?.attempts??0,observations:trial?.observations??[],
      warehouseState:'unverified; 60-second auto-suspend configured',queryIds});
    process.exit(1); // stop dispatch; server statement timeout and auto-suspend remain
  },90000);
  trial=new Trial({admin,app,infer});
  const page=await trial.open();
  return {page,approval,account:'OHCXVXM-OS69400',role:'SAARTHI_APP'};
}
async function close() {
  if(cleanupStarted) return {status:'already_closing'};
  cleanupStarted=true;
  const errors=[];let warehouseState='not_selected';
  try { if(trial) await trial.close(); } catch { errors.push('binding_release_unconfirmed'); }
  if(warehouseSelected && adminConn) {
    try {
      const admin=query(adminConn), [wh]=await admin("SHOW WAREHOUSES LIKE 'SAARTHI_AI_WH'");
      warehouseState=field(wh,'state');
      if(warehouseState!=='SUSPENDED') {
        // The operator must reserve the warehouse for this run. Do not cancel
        // someone else's work if that promise turns out to be false.
        if(Number(field(wh,'running'))!==0 || Number(field(wh,'queued'))!==0) fail('warehouse_busy_do_not_suspend');
        await admin('ALTER WAREHOUSE SAARTHI_AI_WH SUSPEND');
        const [after]=await admin("SHOW WAREHOUSES LIKE 'SAARTHI_AI_WH'");
        warehouseState=field(after,'state');
      }
    } catch { errors.push('warehouse_cleanup_unconfirmed'); }
  }
  await Promise.all([appConn,adminConn].filter(Boolean).map(c=>new Promise(resolve=>c.destroy(()=>resolve()))));
  clearTimeout(deadline);key=undefined;
  return {calls:trial?.attempts??0,observations:trial?.observations??[],queryIds,warehouseState,errors,
    actualTotalBilledUsd:null,costNote:'Inference estimated from returned tokens; supporting compute is reserved, not a measured bill.'};
}

const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
try {
  for await(const line of lines) {
    if(Buffer.byteLength(line)>200000) fail('ipc_limit');
    const message=JSON.parse(line);
    let result;
    if(message.op==='open') result=await open(message.config);
    else if(message.op==='plan' && trial) result=trial.plan(message.payloads);
    else if(message.op==='complete' && trial) result=await trial.complete(message.payload);
    else if(message.op==='close') {send({result:await close()});break;}
    else fail('unsupported_trial_operation');
    send({result});
  }
} catch(error) {
  // No SDK response bodies, prompts, private keys or tokens in diagnostics.
  const code=/^[a-z0-9_]+$/.test(error.message)?error.message:'trial_failed';
  send({error:code,cleanup:await close()});process.exitCode=1;
} finally { await close();lines.close(); }
