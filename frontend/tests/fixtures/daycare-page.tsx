import type { ReactNode } from "react";
import { CensusSearch } from "@/app/census-search";
import { Page, WorkspaceBar, WorkspaceNav } from "@/components/sa";
import type { Chair } from "@/lib/census";
import { PatientSearch } from "@/components/patient-search";

export default async function ControlledDayCare({ searchParams }: {
  searchParams?: Promise<{ roster?: string }>;
}): Promise<ReactNode> {
  const available = (await searchParams)?.roster !== "unavailable";
  const rows: Chair[] = [
    visit("04", "Fatima Begum", "blocked", { time: "09:00", headline: "Platelet check needs review" }),
    visit("02", "Gopal Das", "conflict", { time: "10:30", headline: "Authorization sources disagree" }),
    visit("05", "Anjali Nair", "waiting", { time: "11:00", headline: "Final pathology not received" }),
    visit("06", "Ravi Kulkarni", "waiting", { time: "11:30", headline: "Baseline labs not received" }),
    visit("07", "Leela Menon", "advisory", { time: "12:00", headline: "Recorded advisory" }),
    visit("08", "Suresh Pillai", "conflict", { time: "14:00", headline: "Coverage records disagree" }),
    visit("09", "Meera Joshi", "ready", { time: "15:00", headline: "No recorded open blockers" }),
    visit("10", "Imran Khan", "blocked", { time: "16:00", headline: "Authorization expired" }),
  ];
  const following = { ...rows[0], encounterId: "ENC-NEXT", scheduled: "2026-10-04T09:00:00" };
  return <Page><WorkspaceNav current="census" practitioner="Dr Example" />
    <WorkspaceBar section="Day care" knownAsOf="Synthetic controlled test service" />
    <header className="sa-screen-header"><h1>Day care</h1></header>
    <PatientSearch available={available} patients={available
      ? rows.slice(0, 3).map((row) => ({ id: row.patientId, name: row.name })) : []} />
    <CensusSearch error={null} censusData={[
      { day: "2026-10-03", chairs: rows }, { day: "2026-10-04", chairs: [following] },
    ]} />
  </Page>;
}

function visit(id: string, name: string, status: Chair["status"], schedule: { time: string; headline: string }): Chair {
  return { encounterId: `ENC-${id}`, patientId: `PAT-DC-${id}`, name, status, headline: schedule.headline,
    place: "Synthetic facility", language: "Tamil", diagnosis: "Carcinoma breast · C50.9", regimen: "Synthetic regimen", cycle: 3,
    scheduled: `2026-10-03T${schedule.time}:00`, headlineRule: "SYN-RULE-1", otherIssues: 0 };
}
