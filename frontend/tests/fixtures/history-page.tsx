import HistoryClient from "@/app/history/[id]/history-client";
import type { PatientData } from "@/lib/patient";
import type { ReactNode } from "react";

export default async function ControlledWorkspace({ params }: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const patient: PatientData = {
    patientId: id, patientName: "Fatima Begum", consentId: "CONSENT-SYNTHETIC-1",
    practitionerName: "Dr Example", language: "Tamil", nextVisit: "2026-09-24",
    scheduledAt: "2026-09-24T09:30:00", cycleNumber: 3, regimen: "Synthetic regimen",
    knownAsOf: "2026-09-23T14:14:48", gates: [{
      gate: "Platelet count", rule_id: "CLIN-PLT-001", rule_version: 1,
      outcome: "fail", severity: "blocker", reason: "Platelet result needs review.",
    evidence_ids: ["ASSERT-SYNTHETIC-1"], known_as_of: "2026-09-23T14:14:48",
    }, {
      gate: "documentation", rule_id: "DOC-PATH-001", rule_version: 1,
      outcome: "not_evaluated", severity: "blocker",
      reason: "1 pathology report(s) preliminary/pending - awaiting final",
      evidence_ids: ["DOC-PRELIMINARY-1"], known_as_of: "2026-09-23T14:14:48",
    }, { gate: "Authorization", rule_id: "COV-AUTH-001", rule_version: 1,
      outcome: "conflicting", severity: "blocker", reason: "Authorization dates disagree.",
      known_as_of: "2026-09-23T14:14:48" }],
  };
  return <><p role="status">Synthetic controlled test service</p>
    <HistoryClient patient={patient} />
  </>;
}
