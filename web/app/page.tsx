import { fetchCensus, fetchBindablePatients, buildCensus } from "@/lib/census";
import type { ReadinessRow } from "@/lib/census";
import { CensusChip, Chevron, type CensusStatus } from "@/components/sa";
import Link from "next/link";

export const dynamic = "force-dynamic"; // always fresh readiness state, never stale

type PatientOption = { id: string; name: string };

function PatientPicker({ patients }: { patients: PatientOption[] }) {
  return (
    <details className="relative">
      <summary
        className="flex cursor-pointer list-none items-center justify-center gap-1 rounded px-4 py-2 text-sm [&::-webkit-details-marker]:hidden"
        style={{ border: "1px solid var(--sa-rule)", color: "var(--sa-ink)" }}
      >
        Select patient <Chevron />
      </summary>
      <div
        className="absolute right-0 z-20 mt-2 max-h-80 min-w-64 overflow-y-auto rounded bg-white py-1 shadow-sm"
        style={{ border: "1px solid var(--sa-rule)" }}
      >
        {patients.length ? patients.map((patient) => (
          <Link
            key={patient.id}
            href={`/patient/${patient.id}`}
            prefetch={false}
            className="block px-4 py-2 hover:bg-gray-50"
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
  try {
    [rows, allBindable] = await Promise.all([
      fetchCensus(7),
      fetchBindablePatients().then((bp) => bp.map((p) => ({ id: p.PATIENT_ID, name: p.NAME }))),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    rows = [];
  }
  const chairs = buildCensus(rows);

  const byDay = new Map<string, typeof chairs>();
  for (const chair of chairs) {
    const day = chair.scheduled.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(chair);
  }
  const tally = (list: typeof chairs) => {
    const t: Record<CensusStatus, number> = { blocked: 0, conflict: 0, waiting: 0, advisory: 0, ready: 0 };
    for (const c of list) t[c.status]++;
    return t;
  };

  const shownIds = new Set(chairs.map((c) => c.patientId));
  const alsoUnderCare = allBindable.filter((p) => !shownIds.has(p.id));
  const patientOptions = error ? [] : allBindable.sort((left, right) => left.name.localeCompare(right.name));

  return (
    <main className="mx-auto max-w-7xl px-8 py-10" style={{ color: "var(--sa-ink)" }}>
      {/* Masthead - same shape as frontend/streamlit_app.py's header: name/status
          left, patient selector + practitioner right. */}
      <div className="mb-4 flex items-start justify-between gap-6">
        <div>
          <div className="text-[26px] font-medium tracking-[-0.035em]">SAARTHI</div>
          <div className="mt-1 flex gap-6 text-xs uppercase tracking-wide" style={{ color: "var(--sa-ink-muted)" }}>
            <span>
              Care readiness
              <br />
              <span className="text-sm normal-case" style={{ color: "var(--sa-ink-secondary)" }}>
                no patient selected
              </span>
            </span>
          </div>
        </div>
        <div className="flex items-start gap-6">
          <PatientPicker patients={patientOptions} />
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--sa-ink-muted)" }}>
            Practitioner
            <div className="text-sm normal-case" style={{ color: "var(--sa-ink-secondary)" }}>
              Dr. Test Oncologist
            </div>
          </div>
        </div>
      </div>
      <div className="mb-9 border-t" style={{ borderColor: "var(--sa-rule)" }} />

      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_230px]">
        <div>
          {error && (
            <div
              className="mb-6 border-l-2 py-2 pl-3 text-sm"
              style={{ borderColor: "var(--sa-ink-fail)", color: "var(--sa-ink-secondary)" }}
            >
              Could not reach Snowflake: {error}
            </div>
          )}

          {!error && chairs.length === 0 && (
            <p className="text-sm" style={{ color: "var(--sa-ink-muted)" }}>
              No day-care visits in the next 7 days for patients under your care, as of{" "}
              {new Date().toLocaleString("en-IN")}.
            </p>
          )}

          {[...byDay.entries()].map(([day, dayChairs]) => {
            const t = tally(dayChairs);
            return (
              <section key={day} className="mb-11">
                <h2 className="mb-4 text-xl font-medium tracking-tight">{dayLabel(day)}</h2>

                <div className="mb-2 flex flex-wrap items-center gap-x-7 gap-y-2 border-b pb-4 text-xs" style={{ borderColor: "var(--sa-rule)" }}>
                  {(["ready", "advisory", "waiting", "conflict", "blocked"] as const).map((key) => (
                    <div key={key} className="flex items-baseline gap-2">
                      <span className="tabular-nums text-base font-medium">{t[key]}</span>
                      <span className="capitalize" style={{ color: "var(--sa-ink-muted)" }}>{key}</span>
                    </div>
                  ))}
                </div>

                {dayChairs.map((chair) => (
                  <div
                    key={chair.encounterId}
                    className="grid grid-cols-1 items-center gap-3 border-t py-5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] sm:gap-7"
                    style={{ borderColor: "var(--sa-rule)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{chair.name}</div>
                      <div className="text-sm" style={{ color: "var(--sa-ink-muted)" }}>
                        {chair.place}
                        {chair.language ? ` · ${chair.language}` : ""}
                      </div>
                      <div className="text-sm" style={{ color: "var(--sa-ink-muted)" }}>
                        {chair.regimen}
                        {chair.cycle ? ` · cycle ${chair.cycle}` : ""}
                      </div>
                    </div>

                    {/* Chip + reason: its own column, exactly as in Streamlit -
                        not stacked with the Open button. */}
                    <div className="min-w-0">
                      <div className="mb-1.5">
                        <CensusChip status={chair.status} />
                      </div>
                      <div className="text-sm" style={{ color: "var(--sa-ink-secondary)" }}>
                        {chair.headlineRule && (
                          <code
                            className="mr-1 rounded px-1 py-0.5 text-xs"
                            style={{ background: "var(--sa-surface-sunken)", color: "var(--sa-ink-muted)" }}
                          >
                            {chair.headlineRule}
                          </code>
                        )}
                        {chair.headline}
                        {chair.otherIssues > 0 && (
                          <span className="ml-1 text-xs" style={{ color: "var(--sa-ink-muted)" }}>
                            +{chair.otherIssues} more
                          </span>
                        )}
                      </div>
                    </div>

                    <Link
                      href={`/patient/${chair.patientId}`}
                      prefetch={false}
                      className="w-fit shrink-0 rounded-full px-4 py-2 text-sm transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ border: "1px solid var(--sa-rule)", color: "var(--sa-ink)" }}
                    >
                      Open
                    </Link>
                  </div>
                ))}
              </section>
            );
          })}

          <div className="mt-6 border-t pt-4 text-xs" style={{ borderColor: "var(--sa-rule)", color: "var(--sa-ink-muted)" }}>
            Every status comes from the SQL readiness snapshot; no model decides it. Open a patient
            to inspect each rule, its evidence, and its as-of time. A patient is listed only with
            active care-team membership and valid consent.
          </div>
        </div>

        {/* Right margin: "Also under your care" - present in the Streamlit
            build even when empty for the current cohort, so the panel never
            silently disappears once populated. */}
        <div>
          <div className="mb-4 text-xs uppercase tracking-wide" style={{ color: "var(--sa-ink-muted)" }}>
            Also under your care
          </div>
          {alsoUnderCare.map((p) => (
            <Link
              key={p.id}
              href={`/patient/${p.id}`}
              prefetch={false}
              className="block rounded-lg px-1 py-2 text-sm hover:underline"
              style={{ color: "var(--sa-ink)" }}
            >
              {p.name}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
