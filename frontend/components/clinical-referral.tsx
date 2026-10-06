import type { ReactNode } from "react";
import type { AgentTurn, PatientData } from "@/lib/patient";
import { PreparePacket } from "./evidence-history";
import { EvidencePacketPreview } from "./evidence-packet-preview";

export function ClinicalReferral({ patientId, patient, turn, question }: {
  patientId: string; patient?: PatientData; turn: AgentTurn; question: string;
}): ReactNode {
  const recipient = turn.artifact?.refusal?.practitioner.name ?? "";
  return <>
    {patient && recipient && <EvidencePacketPreview patient={patient} recipient={recipient}
      knownAsOf={turn.artifact?.known_as_of ?? null} />}
    <PreparePacket patientId={patientId} question={question} practitionerName={recipient} />
  </>;
}
