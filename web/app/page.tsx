import { fetchCensus, fetchBindablePatients, fetchPractitionerName, buildCensus } from "@/lib/census";
import type { ReadinessRow, Chair } from "@/lib/census";
import { CensusChip, Chevron, WorkspaceNav, type CensusStatus } from "@/components/sa";
import Link from "next/link";
import { CensusSearch } from "./census-search";

export const dynamic = "force-dynamic"; // always fresh readiness state, never stale

type PatientOption = { id: string; name: string };

function PatientPicker({ patients }: { patients: PatientOption[] }) {
  return (
    <details className="relative">
      <summary
        className="sa-picker-trigger flex cursor-pointer list-none items-center justify-center gap-1 rounded px-4 py-2 text-sm [&::-webkit-details-marker]:hidden"
        style={{ border: "1px solid var(--sa-rule)", color: "var(--sa-ink)" }}
      >
        Select patient <Chevron />
      </summary>
      <div
        className="absolute right-0 z-20 mt-2 max-h-80 min-w-64 overflow-y-auto rounded bg-white py-1"
        style={{ border: "1px solid var(--sa-rule)", boxShadow: "0 4px 16px rgb(26 29 33 / 8%)" }}
      >
        {patients.length ? patients.map((patient) => (
          <Link
            key={patient.id}
            href={`/patient/${patient.id}`}
            prefetch={false}
            className="sa-picker-item block px-4 py-2"
          >
            <span className="block">{patient.name}</span>
            <span className="sa-meta">{patient.id}</span>
          </Link>
        )) : <span className="block px-4 py-3 text-sm sa-meta">No accessible patients are listed.</span>}
      </div>
    </details>
  );
}

function dayLabel(iso: string) {
  const day = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deltaDays = Math.round((day.getTime() - today.getTime()) / 86400000);
  const prefix = deltaDays === 0 ? "Today" : deltaDays === 1 ? "Tomorrow" : null;
  const pretty = day.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return prefix ? `${prefix} · ${pretty}` : pretty;
}

export default async function DayCarePage() {
  let rows: ReadinessRow[];
  let error: string | null = null;
  let allBindable: PatientOption[] = [];
  let practitionerName = "Practitioner";
  const loadedAt = new Date().toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  try {
    [rows, allBindable, practitionerName] = await Promise.all([
      fetchCensus(7),
      fetchBindablePatients().then((bp) => bp.map((p) => ({ id: p.PATIENT_ID, name: p.NAME }))),
      fetchPractitionerName(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    rows = [];
  }
  const chairs = buildCensus(rows);

  const byDay = new Map<string, Chair[]>();
  for (const chair of chairs) {
    const day = chair.scheduled.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(chair);
  }
  const tally = (list: Chair[]) => {
    const t: Record<CensusStatus, number> = { blocked: 0, conflict: 0, waiting: 0, advisory: 0, ready: 0 };
    for (const c of list) t[c.status]++;
    return t;
  };

  const shownIds = new Set(chairs.map((c) => c.patientId));
  const alsoUnderCare = allBindable.filter((p) => !shownIds.has(p.id));
  const patientOptions = error ? [] : allBindable.sort((left, right) => left.name.localeCompare(right.name));
  const totalVisits = chairs.length;
  const totalPatients = allBindable.length;

  const censusData = [...byDay.entries()].map(([day, dayChairs]) => ({
    day,
    label: dayLabel(day),
    tally: tally(dayChairs),
    chairs: dayChairs,
  }));

  return (
    <main className="mx-auto max-w-7xl px-8 py-10" style={{ color: "var(--sa-ink)" }}>
      <WorkspaceNav current="census" />
      <div className="mb-5 flex items-start justify-between gap-6">
        <div>
          <div className="text-[26px] font-medium tracking-[-0.035em]">SAARTHI</div>
          <div className="mt-1 text-xs uppercase tracking-wide" style={{ color: "var(--sa-ink-muted)" }}>
            Care readiness
            <div className="text-sm normal-case" style={{ color: "var(--sa-ink-secondary)" }}>
              no patient selected
            </div>
          </div>
        </div>
        <div className="flex items-start gap-6">
          <PatientPicker patients={patientOptions} />
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--sa-ink-muted)" }}>
            Practitioner
            <div className="text-sm normal-case" style={{ color: "var(--sa-ink-secondary)" }}>
              {practitionerName}
            </div>
          </div>
        </div>
      </div>

      {!error && (
        <div className="mb-1 flex items-center justify-between text-xs" style={{ color: "var(--sa-ink-muted)" }}>
          <span className="tabular-nums">{totalVisits} visit{totalVisits !== 1 ? "s" : ""} in next 7 days · {totalPatients} patient{totalPatients !== 1 ? "s" : ""} accessible</span>
          <span className="tabular-nums">
            Loaded {loadedAt} ·{" "}
            <a href="/" className="underline" style={{ color: "var(--sa-ink-secondary)" }}>Refresh</a>
          </span>
        </div>
      )}

      <div className="mb-8 border-t" style={{ borderColor: "var(--sa-rule)" }} />

      <CensusSearch censusData={censusData} error={error} alsoUnderCare={alsoUnderCare} />
    </main>
  );
}
