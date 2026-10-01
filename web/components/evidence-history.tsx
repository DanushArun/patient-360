"use client";
import { useEffect, useState } from "react";
type Audit = { RUN_ID:string; QUESTION_CLASS:string; ANSWER_STATUS:string; CREATED_AT:string; KNOWN_AS_OF:string; EVIDENCE_IDS:string[] };
type Packet = { PACKET_ID:string; PRACTITIONER_NAME:string; DELIVERED_AT:string|null; GATE_SNAPSHOT: {known_as_of?:string;gates?:{rule_id:string;outcome:string;reason:string}[]} };
export function EvidenceHistory({patientId}:{patientId:string}) {
  const [records,setRecords]=useState<{answers:Audit[];packets:Packet[]}|null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{let active=true;setRecords(null);setFailed(false);
    fetch(`/api/patient/${encodeURIComponent(patientId)}/evidence`,{cache:"no-store"})
      .then(async r=>{if(!r.ok)throw new Error();return r.json();})
      .then(body=>{if(active)setRecords(body);}).catch(()=>{if(active)setFailed(true);});
    return()=>{active=false;};},[patientId]);
  return <section aria-label="Answer and referral history">
    <h2>Answer history</h2>
    {failed ? <p role="alert">Answer history could not be loaded. Reload to retry.</p> : !records ? <p role="status">Loading saved evidence history…</p> : <>
      {!records.answers.length && <p>No answers recorded yet.</p>}
      {records.answers.map(a=><details key={a.RUN_ID}><summary>{a.CREATED_AT} · Class {a.QUESTION_CLASS} · {a.ANSWER_STATUS}</summary>
        <p className="sa-meta">Known as of {a.KNOWN_AS_OF ?? "Not recorded"} · {a.RUN_ID}</p>
        <p>{a.EVIDENCE_IDS?.length ? a.EVIDENCE_IDS.join(", ") : "No source pointers recorded."}</p>
      </details>)}
      <p className="sa-meta">History retains access and source pointers, not a stored copy of the answer text.</p>
      <h2>Practitioner evidence packets</h2>
      {!records.packets.length && <p>No packets prepared yet.</p>}
      {records.packets.map(p=><details key={p.PACKET_ID}><summary>For {p.PRACTITIONER_NAME} · {p.DELIVERED_AT ? "Delivery recorded" : "Prepared · not delivered"}</summary>
        <p className="sa-meta">{p.PACKET_ID} · known as of {p.GATE_SNAPSHOT?.known_as_of}</p>
        {p.GATE_SNAPSHOT?.gates?.map(g=><p key={g.rule_id}><strong>{g.rule_id} · {g.outcome}</strong><br/>{g.reason}</p>)}
      </details>)}
    </>}
  </section>;
}

export function PreparePacket({patientId,question}:{patientId:string;question:string}) {
  const [id]=useState(()=>crypto.randomUUID());
  const [state,setState]=useState("idle"); const [message,setMessage]=useState("");
  async function prepare(){
    setState("saving");
    try{
      const r=await fetch(`/api/patient/${encodeURIComponent(patientId)}/evidence`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question,packetId:id})});
      const body=await r.json();if(!r.ok||body.error)throw new Error();
      setState("saved");setMessage(`Evidence packet prepared for ${body.practitioner_name}. Not sent. Open Review history to inspect it.`);
    }catch{setState("error");setMessage("Packet could not be prepared. Check access and retry.");}
  }
  return <div className="sa-meta"><button type="button" className="sa-quiet-button" disabled={state==="saving"||state==="saved"} onClick={()=>void prepare()}>
    {state==="saving"?"Preparing…":state==="saved"?"Packet prepared":"Prepare evidence for treating practitioner"}</button><p role="status">{message}</p></div>;
}
