#!/usr/bin/env node
// Patch only these owner procedures; no data reload, background jobs, models or Search.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {session,statements,cell} from './bounded-session.mjs';
const files=['web_reads.sql','web_workflows.sql','tools/08_create_review_task.sql'];
const plan=files.flatMap(f=>statements(readFileSync(new URL('../sql/procedures/'+f,import.meta.url),'utf8')).map(sql=>({file:f,sql})));
const hash=createHash('sha256').update(JSON.stringify(plan)).digest('hex');
console.log('PATCH_SHA256',hash);console.log(plan.map(p=>p.file+': '+p.sql.slice(0,130)).join('\n'));
if(process.argv.includes('--apply')){
 if(process.argv[process.argv.indexOf('--sha256')+1]!==hash)throw new Error('Inspect exact hash before apply');
 const s=await session('saarthi_web_integration');
 try{
 for(const p of plan){console.log('INSTALL',p.file);await s.q(p.sql);}
 await s.q('USE ROLE SAARTHI_APP');
 for(const view of ['patients','queue_readiness','queue_tasks','census','practitioner']){
 const r=cell(await s.q('CALL SAARTHI.OPERATIONAL.GET_WEB_WORKSPACE(?,7)',[view]));
 if(r.error||!Array.isArray(r.rows))throw new Error(view+': '+JSON.stringify(r));console.log('PASS',view,r.rows.length);}
 const b=cell(await s.q("CALL SAARTHI.OPERATIONAL.BIND_PATIENT('PAT-DC-07')"));if(b.error)throw new Error(JSON.stringify(b));
 for(const view of ['context','snapshot','tasks','owners','schemes','answers','packets']){
 const r=cell(await s.q('CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA(?,?)',[view,view==='tasks'?'COV-AUTH-001':null]));
 if(r.error||!Array.isArray(r.rows))throw new Error(view+': '+JSON.stringify(r));console.log('PASS',view,r.rows.length);}
 let denied=false;try{await s.q('SELECT * FROM SAARTHI.CORE.PATIENT LIMIT 1');}catch{denied=true;}if(!denied)throw new Error('Raw table access should fail');
 console.log('PASS direct table access denied');
 }finally{await s.close();}
}
