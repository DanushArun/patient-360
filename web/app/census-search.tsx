"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CensusChip, type CensusStatus } from "@/components/sa";
import type { Chair } from "@/lib/census";

type DayGroup = {
  day: string;
  label: string;
  tally: Record<CensusStatus, number>;
  chairs: Chair[];
};

type PatientOption = { id: string; name: string };

function matchesSearch(chair: Chair, query: string): boolean {
  const q = query.toLowerCase();
  return (
    chair.name.toLowerCase().includes(q) ||
    chair.patientId.toLowerCase().includes(q) ||
    (chair.place?.toLowerCase().includes(q) ?? false) ||
    (chair.regimen?.toLowerCase().includes(q) ?? false) ||
    (chair.headlineRule?.toLowerCase().includes(q) ?? false) ||
    chair.status.includes(q)
  );
}

export function CensusSearch({ censusData, error, alsoUnderCare }: {
  censusData: DayGroup[];
  error: string | null;
  alsoUnderCare: PatientOption[];
}): ReactNode {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? censusData.map((group) => ({
        ...group,
        chairs: group.chairs.filter((c) => matchesSearch(c, search.trim())),
      })).filter((g) => g.chairs.length > 0)
    : censusData;

  const tally = (list: Chair[]) => {
    const t: Record<CensusStatus, number> = { blocked: 0, conflict: 0, waiting: 0, advisory: 0, ready: 0 };
    for (const c of list) t[c.status]++;
    return t;
  };

  const totalShown = filtered.reduce((sum, g) => sum + g.chairs.length, 0);
  const totalAll = censusData.reduce((sum, g) => sum + g.chairs.length, 0);

  return (
    <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_230px]">
      <div>
        {error && (
          <div
            className="mb-6 border-l-2 py-2 pl-3 text-sm"
            style={{ borderColor: "var(--sa-ink-fail)", color: "var(--sa-ink-secondary)" }}
          >
            <strong>Patient list unavailable</strong>
            <p>The record service could not be reached. Patient and visit information cannot be confirmed.</p>
            <a href="/" className="underline">Try again</a>
          </div>
        )}

        {!error && (
          <div className="mb-6 flex items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, ID, place, regimen, or rule..."
              className="sa-search-input"
            />
            {search.trim() && (
              <span className="shrink-0 text-xs tabular-nums" style={{ color: "var(--sa-ink-muted)" }}>
                {totalShown} of {totalAll}
              </span>
            )}
          </div>
        )}

        {!error && totalAll === 0 && (
          <p className="text-sm" style={{ color: "var(--sa-ink-muted)" }}>
            No day-care visits in the next 7 days for patients under your care.
          </p>
        )}

        {!error && search.trim() && totalShown === 0 && totalAll > 0 && (
          <p className="text-sm" style={{ color: "var(--sa-ink-muted)" }}>
            No patients match &ldquo;{search.trim()}&rdquo;.{" "}
            <button type="button" className="underline" onClick={() => setSearch("")}
              style={{ color: "var(--sa-ink-secondary)" }}>Clear filter</button>
          </p>
        )}

        {filtered.map(({ day, label, chairs: dayChairs }) => {
          const t = search.trim() ? tally(dayChairs) : censusData.find((g) => g.day === day)!.tally;
          return (
            <section key={day} className="mb-10">
              <h2 className="mb-4 text-xl font-medium tracking-tight">{label}</h2>

              <div className="mb-3 flex flex-wrap items-center gap-x-7 gap-y-2 border-b pb-4 text-xs" style={{ borderColor: "var(--sa-rule)" }}>
                {(["ready", "advisory", "waiting", "conflict", "blocked"] as const).map((key) => (
                  <div key={key} className="flex items-baseline gap-2">
                    <span className="tabular-nums text-base font-medium">{t[key]}</span>
                    <span className="capitalize" style={{ color: "var(--sa-ink-muted)" }}>{key}</span>
                  </div>
                ))}
              </div>

              {dayChairs.map((chair) => (
                <Link
                  key={chair.encounterId}
                  href={`/patient/${chair.patientId}`}
                  prefetch={false}
                  className="sa-census-card grid grid-cols-1 items-center gap-3 border-t py-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] sm:gap-7"
                  style={{ borderColor: "var(--sa-rule)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{chair.name}</div>
                    <div className="mt-0.5 text-sm" style={{ color: "var(--sa-ink-muted)" }}>
                      {chair.place}
                      {chair.language ? ` · ${chair.language}` : ""}
                    </div>
                    <div className="text-sm" style={{ color: "var(--sa-ink-muted)" }}>
                      {chair.regimen}
                      {chair.cycle ? ` · cycle ${chair.cycle}` : ""}
                    </div>
                  </div>

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

                  <span
                    className="sa-open-btn w-fit shrink-0 rounded-full px-4 py-2 text-sm"
                    aria-hidden="true"
                  >
                    Open
                  </span>
                </Link>
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

      <div>
        <div className="mb-4 text-xs uppercase tracking-wide" style={{ color: "var(--sa-ink-muted)" }}>
          Also under your care
        </div>
        {alsoUnderCare.length ? alsoUnderCare.map((p) => (
          <Link
            key={p.id}
            href={`/patient/${p.id}`}
            prefetch={false}
            className="sa-sidebar-link block rounded-lg px-1 py-2 text-sm"
            style={{ color: "var(--sa-ink)" }}
          >
            {p.name}
          </Link>
        )) : (
          <div className="text-sm" style={{ color: "var(--sa-ink-muted)" }}>
            {error ? "Patient information is unavailable." : "All accessible patients have upcoming visits."}
          </div>
        )}
      </div>
    </div>
  );
}
