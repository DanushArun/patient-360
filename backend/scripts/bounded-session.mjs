import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(new URL('../../web/package.json',import.meta.url));
import {snowflakeDriverConfig} from '../../web/lib/snowflake-driver-config.mjs';
const sf=require('snowflake-sdk'); sf.configure(snowflakeDriverConfig);
export function statements(source) {
  let state = '', part = '', out = [];
  for (let i = 0; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (state === 'line') { if (c === '\n') { state = ''; part += '\n'; } continue; }
    if (state === 'comment') { if (c === '*' && n === '/') { state = ''; i++; part += ' '; } continue; }
    if (state === '$$') { part += c; if (c === '$' && n === '$') { part += n; i++; state = ''; } continue; }
    if (state === "'" || state === '"') {
      part += c;
      if (c === '\\' && n) { part += n; i++; continue; }
      if (c === state) { if (n === state) { part += n; i++; } else state = ''; }
      continue;
    }
    if (c === '-' && n === '-') { state = 'line'; i++; continue; }
    if (c === '/' && n === '*') { state = 'comment'; i++; continue; }
    if (c === '$' && n === '$') { state = '$$'; part += '$$'; i++; continue; }
    if (c === "'" || c === '"') { state = c; part += c; continue; }
    if (c === ';') { if (part.trim()) out.push(part.trim()); part = ''; } else part += c;
  }
  if (state && state !== 'line') throw new Error(`Unclosed SQL token: ${state}`);
  if (part.trim()) out.push(part.trim());
  return out;
}

export const cell=rows=>{const x=Object.values(rows[0]??{})[0];return typeof x==='string'?JSON.parse(x):x;};
export const field=(row,key)=>row?.[Object.keys(row).find(k=>k.toLowerCase()===key.toLowerCase())];
export async function session(tag) {
 const c=sf.createConnection({account:'OHCXVXM-OS69400',username:'SITAR',role:'ACCOUNTADMIN',authenticator:'SNOWFLAKE_JWT',privateKey:readFileSync('/Users/aaa/.snowflake/keys/sitar_snow_rsa.p8','utf8'),loginTimeout:30,clientSessionKeepAlive:false});
 const q=(sqlText,binds=[])=>new Promise((resolve,reject)=>c.execute({sqlText,binds,complete:(error,stmt,rows)=>{console.log('QUERY',stmt?.getStatementId());error?reject(new Error(error.code+': '+error.message)):resolve(rows??[]);}}));
 try {
 await c.connectAsync();
 const [who]=await q('SELECT CURRENT_ACCOUNT() AS A,CURRENT_USER() AS U');
 if(who.A!=='JR18576'||who.U!=='SITAR')throw new Error('Unexpected identity');
 const [wh]=await q("SHOW WAREHOUSES LIKE 'SAARTHI_AI_WH'");
 const [rm]=await q("SHOW RESOURCE MONITORS LIKE 'SAARTHI_PROTOTYPE_LIMIT'");
 if(field(wh,'resource_monitor')!=='SAARTHI_PROTOTYPE_LIMIT'||field(wh,'size')!=='X-Small'||Number(field(rm,'credit_quota'))!==3||parseFloat(field(rm,'suspend_immediately_at'))!==90)throw new Error('Budget protection mismatch');
 console.log('WAREHOUSE_CREDITS_REPORTED',field(rm,'used_credits'),'of',field(rm,'credit_quota'),'excludes AI/Search; reporting lags');
 const used=field(rm,'used_credits');
 if(used==null||!Number.isFinite(Number(used))||Number(used)>=2.0)throw new Error('Prototype reserve reached or unverified; stop and review spend');
 await q('USE SECONDARY ROLES NONE'); await q('USE WAREHOUSE SAARTHI_AI_WH');
 if(!/^[a-z_]+$/.test(tag))throw new Error('Bad query tag');
 await q("ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS=120,STATEMENT_QUEUED_TIMEOUT_IN_SECONDS=30,QUERY_TAG='"+tag+"'");
 return {q,close:async()=>{try{await q('CALL SAARTHI.OPERATIONAL.RELEASE_PATIENT_BINDING()');}catch{}await new Promise(r=>c.destroy(()=>r()));}};
 }catch(e){await new Promise(r=>c.destroy(()=>r()));throw e;}
}
