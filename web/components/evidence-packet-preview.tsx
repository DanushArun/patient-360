"use client";

import { Clock } from "@/components/ui/clock";

import type { ReactNode } from "react";
import type { PatientData } from "@/lib/patient";
import { useFactsData } from "./workspace-patient-facts";
import { useWorkspaceData } from "./workspace-patient-data";
import { documentLibraryRows, documentSourceHref } from "@/lib/workspace-documents.mjs";
import { factStateDisplay, factValueLabel } from "@/lib/workspace-patient-facts.mjs";

export function EvidencePacketPreview({ patient, knownAsOf, recipient }: {
  patient: PatientData; knownAsOf: string | null; recipient: string;
}): ReactNode {
  if (!knownAsOf || knownAsOf !== patient.knownAsOf) return <p role="status" className="sa-meta">
    Packet preview unavailable: the answer and displayed record have different snapshot cutoffs.
  </p>;
  return <section aria-label="Evidence packet preview" className="sa-packet-preview">
    <h3>Evidence packet preview</h3>
    <p className="sa-meta">Draft · Not created · Addressed to {recipient}</p>
    <p className="sa-meta">{patient.patientName} · {patient.patientId} · Known as of <Clock value={knownAsOf} /></p>
    <PacketFacts patientId={patient.patientId} knownAsOf={knownAsOf} />
    <h4>Missing or conflicting records</h4>
    <ul>{patient.gates.filter((gate) => gate.outcome !== "pass").map((gate, index) =>
      <li key={gate.rule_id ?? index}>{gate.reason ?? gate.gate}</li>)}</ul>
    <h4>Versioned rule results</h4>
    <dl>{patient.gates.map((gate, index) => <div key={gate.rule_id ?? index}>
      <dt>{gate.rule_id ?? gate.gate} v{gate.rule_version ?? "Unavailable"}</dt>
      <dd>{gate.outcome.replaceAll("_", " ")}</dd>
    </div>)}</dl>
    <PacketSources patientId={patient.patientId} knownAsOf={knownAsOf} />
    <p className="sa-meta">The server records the final packet contents when created.
      This preview does not confirm a saved packet or a clinical decision.</p>
  </section>;
}

function PacketFacts({ patientId, knownAsOf }: {
  patientId: string; knownAsOf: string;
}): ReactNode {
  const { current, retry } = useFactsData(patientId, "labs", knownAsOf);
  const facts = Array.isArray(current.data?.facts) ? current.data.facts : [];
  return <section aria-label="Packet recorded facts">
    <h4>Recorded facts</h4>
    {current.state === "loading" && <p role="status">Loading recorded facts…</p>}
    {current.state === "error" && <p role="alert">Recorded facts could not be read.
      <button type="button" className="sa-quiet-button" onClick={retry}>Retry facts</button></p>}
    {current.state === "ready" && <ul>{facts.map((fact, index) =>
      <li key={String(fact.event_id ?? index)}>{String(fact.concept ?? "Concept unavailable")}
        {" · "}{factValueLabel(fact)} {String(fact.unit ?? "")}
        {" · "}{factStateDisplay(fact)}</li>)}</ul>}
    {current.state === "ready" && !facts.length && <p>No recorded facts were returned.</p>}
  </section>;
}

function PacketSources({ patientId, knownAsOf }: {
  patientId: string; knownAsOf: string;
}): ReactNode {
  const query = new URLSearchParams({ view: "documents", known_as_of: knownAsOf });
  const result = useWorkspaceData(`/api/patient/${encodeURIComponent(patientId)}`
    + `/workspace?${query}`, patientId);
  const sources = documentLibraryRows(result.data?.rows ?? [], []);
  return <section aria-label="Packet source index">
    <h4>Source index</h4>
    {result.state === "loading" && <p role="status">Loading source index…</p>}
    {result.state === "error" && <p role="alert">Sources could not be read.
      <button type="button" className="sa-quiet-button" onClick={result.retry}>
        Retry sources</button>
    </p>}
    <ul>{sources.map((source) => <li key={source.id}>
      {source.document?.page_count ? <a href={documentSourceHref(patientId,
        String(source.document.doc_id), knownAsOf)?.replace("return=documents", "return=ask")}>
        {source.title}</a> : source.title} · {source.state} · {source.sourceFacility}
    </li>)}</ul>
    {result.state === "ready" && !sources.length && <p>No source records were returned.</p>}
  </section>;
}
