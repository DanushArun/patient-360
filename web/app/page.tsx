import { fetchCensus, fetchBindablePatients, fetchPractitionerName, buildCensus, oldestKnownAsOf, censusClockLabel } from '@/lib/census';
import type { ReadinessRow, Chair } from '@/lib/census';
import { WorkspaceBar, WorkspaceNav } from '@/components/sa';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { CensusSearch } from './census-search';
import { PatientSearch } from '@/components/patient-search';
import { withUiReadDeadline } from '@/lib/ui-read-deadline.mjs';
import { apiError } from '@/lib/api-contracts.mjs';
import { after } from 'next/server';
import { warmPatients } from '@/lib/warm';

export const dynamic = 'force-dynamic';

type PatientOption = { id: string; name: string };
type DayCareData = {
  rows: ReadinessRow[];
  patients: PatientOption[];
  practitioner: string;
  error: string | null;
};

async function readDayCare(): Promise<DayCareData> {
  try {
    const [rows, patients, practitioner] = await withUiReadDeadline(Promise.all([
      fetchCensus(7),
      fetchBindablePatients().then((values) => values.map((patient) => ({
        id: patient.PATIENT_ID, name: patient.NAME,
      }))),
      fetchPractitionerName(),
    ]));
    patients.sort((left, right) => left.name.localeCompare(right.name));
    return { rows, patients, practitioner, error: null };
  } catch (error) {
    // Fixed code set only: driver text can carry SQL fragments or account identifiers.
    return { rows: [], patients: [], practitioner: 'Practitioner',
      error: apiError(error, 'record_service_unavailable').error };
  }
}

function groupVisits(chairs: Chair[]): { day: string; chairs: Chair[] }[] {
  const groups = new Map<string, Chair[]>();
  for (const chair of chairs) {
    const day = chair.scheduled.slice(0, 10);
    const rows = groups.get(day) ?? [];
    rows.push(chair);
    groups.set(day, rows);
  }
  return [...groups].map(([day, rows]) => ({ day, chairs: rows }));
}

export default async function DayCarePage(): Promise<ReactNode> {
  const data = await readDayCare();
  const chairs = buildCensus(data.rows);
  // Open each patient ahead of the click: visits first, then the rest of the roster.
  if (!data.error) after(() => warmPatients([...new Set([...chairs.map((chair) => chair.patientId),
    ...data.patients.map((patient) => patient.id)])]));
  const asOf = oldestKnownAsOf(data.rows);
  const loadedAt = new Date().toLocaleTimeString('en-IN', { hour12: false });
  return <main className="mx-auto max-w-7xl px-8 py-10">
    <WorkspaceNav current="census" patients={data.patients} patientsAvailable={!data.error}
      practitioner={data.practitioner} />
    <WorkspaceBar section="Day care"
      knownAsOf={censusClockLabel(data.error, asOf, loadedAt, data.rows.length)} />
    <DayCareHeader data={data} visits={chairs.length} />
    <CensusSearch censusData={groupVisits(chairs)} error={data.error} />
    {data.error && <RecordedPreviewEntry />}
  </main>;
}

function DayCareHeader({ data, visits }: { data: DayCareData; visits: number }): ReactNode {
  return <header className="sa-screen-header">
    <div>
      <h1>Day care</h1>
      <p id="day-care-status">{data.error ? 'Visit and patient counts unavailable.'
        : `${visits} upcoming visits · ${data.patients.length} accessible patients`}</p>
    </div>
    <PatientSearch patients={data.patients} available={!data.error} />
  </header>;
}

function RecordedPreviewEntry(): ReactNode {
  return <section className="sa-preview-entry" aria-label="Recorded design preview">
    <div><h2>Review the dashboard design</h2>
      <p>A recorded synthetic patient workspace is available while live records are unavailable.
        Its dates and checks come from the repository fixture.</p></div>
    <Link className="sa-quiet-button" href="/design-preview/PAT-DC-04">
      Open recorded design preview
    </Link>
  </section>;
}
