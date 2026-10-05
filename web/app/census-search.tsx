"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CensusChip } from "@/components/sa";
import { Button, PopUpButton, SearchField, SegmentedControl, Toolbar } from "@/components/ui/controls";
import { useWorklistState } from "@/components/use-worklist-state";
import type { Chair } from "@/lib/census";
import { filterDayCareVisits, getAvailableVisitDates } from "@/lib/daycare-board.mjs";
import { groupWorklistByState } from "@/lib/workspace-state.mjs";
import { formatVisitDate } from "@/lib/worklist-display.mjs";
import { VisitTable } from "./visit-table";
import styles from "./census-search.module.css";

type DayGroup = { day: string; chairs: Chair[] };

export function CensusSearch({ censusData, error }: {
  censusData: DayGroup[];
  error: string | null;
}): ReactNode {
  const dates = getAvailableVisitDates(censusData);
  const { search, setSearch, view, setView, selectedDate, setSelectedDate, dateRange,
    setDateRange } = useWorklistState(dates);
  const showNextSevenDays = dateRange === "next7";
  const visibleRows = filterDayCareVisits(
    censusData,
    showNextSevenDays ? "all" : selectedDate,
    search,
  );
  const stateGroups = groupWorklistByState(visibleRows);

  if (error) return <PatientListError />;
  return <section aria-label="Day-care visits">
    <WorklistToolbar model={{ dates, selectedDate, setSelectedDate, showNextSevenDays,
      setShowNextSevenDays: (show) => setDateRange(show ? "next7" : "date"), search,
      setSearch, view, setView, resultCount: visibleRows.length }} />
    {visibleRows.length === 0 && <EmptyResults query={search} onClear={() => setSearch("")} />}
    <WorklistResults view={view} visibleRows={visibleRows} stateGroups={stateGroups} />
    <p className="sa-meta">Open a patient to inspect each record check, its source, and its
      as-of time. The list is limited to your active care team and current consent.</p>
  </section>;
}

function PatientListError(): ReactNode {
  return <div role="alert" className="sa-empty-state">
    <strong>Patient list unavailable</strong>
    <p>The record service could not be reached. Patient and visit information cannot be confirmed.
    </p>
    <a href="/" className="underline">Try again</a>
  </div>;
}

type ToolbarModel = {
  dates: string[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  showNextSevenDays: boolean;
  setShowNextSevenDays: (show: boolean) => void;
  search: string;
  setSearch: (value: string) => void;
  view: "state" | "visits";
  setView: (value: "state" | "visits") => void;
  resultCount: number;
};

const NEXT_SEVEN_DAYS = "next7";

function WorklistToolbar({ model }: { model: ToolbarModel }): ReactNode {
  const router = useRouter();
  return <>
    <Toolbar label="Day-care visit controls" trailing={<>
      <SearchField label="Search day-care visits" placeholder="Search patients or checks"
        value={model.search} onChange={model.setSearch} />
      <Button variant="plain" onClick={() => router.refresh()}>Refresh</Button>
    </>}>
      <PopUpButton id="visit-date" label="Visit date" disabled={!model.dates.length}
        value={model.showNextSevenDays ? NEXT_SEVEN_DAYS : model.selectedDate}
        options={[{ value: NEXT_SEVEN_DAYS, label: "Next 7 days" },
          ...model.dates.map((date) => ({ value: date, label: formatDay(date) }))]}
        onChange={(value) => value === NEXT_SEVEN_DAYS
          ? model.setShowNextSevenDays(true) : model.setSelectedDate(value)} />
      <SegmentedControl label="Day care view" value={model.view} onChange={model.setView}
        options={[{ value: "state", label: "By record state" },
          { value: "visits", label: "Visits" }]} />
    </Toolbar>
    <p className={styles.resultCount} role="status" aria-live="polite">
      {model.resultCount} {model.resultCount === 1 ? "visit" : "visits"} shown
    </p>
  </>;
}

function EmptyResults({ query, onClear }: { query: string; onClear: () => void }): ReactNode {
  const message = query.trim()
    ? `No visits match “${query.trim()}”.`
    : "No day-care visits were returned for this date range.";
  return <p className={styles.emptyState} role="status">{message}{" "}
    {query.trim() && <button type="button" className="underline" onClick={onClear}>
      Clear search
    </button>}
  </p>;
}

function WorklistResults({ view, visibleRows, stateGroups }: {
  view: "state" | "visits";
  visibleRows: Chair[];
  stateGroups: ReturnType<typeof groupWorklistByState<Chair>>;
}): ReactNode {
  if (view === "visits") return <VisitTable chairs={visibleRows} />;
  return <div className="sa-worklist-board">
    {stateGroups.filter((group) => group.rows.length > 0).map((group) => (
      <section key={group.key} aria-label={`${group.label}, ${group.rows.length} visits`}>
        <h2>{group.label}<span>{group.rows.length}</span></h2>
        {group.rows.map((chair) => <WorklistCard key={chair.encounterId} chair={chair} />)}
      </section>
    ))}
  </div>;
}

function formatDay(day: string): string {
  return formatVisitDate(`${day}T00:00:00`);
}

function visitTime(scheduled: string): string {
  return /T(\d{2}:\d{2})/.exec(scheduled)?.[1] ?? "Time unavailable";
}

function cycleLabel(cycle: number | null): string {
  return cycle !== null ? ` · Cycle ${cycle}` : "";
}

function WorklistCard({ chair }: { chair: Chair }): ReactNode {
  return <Link href={`/patient/${chair.patientId}`} prefetch={false} className="sa-worklist-card">
    <strong>{chair.name}</strong>
    <small>{chair.patientId} · {formatDay(chair.scheduled.slice(0, 10))}
      {` · ${visitTime(chair.scheduled)}`}
      {cycleLabel(chair.cycle)}</small>
    <CensusChip status={chair.status} />
    <span>{chair.headline ?? "No issue summary returned"}</span>
    {chair.headlineRule && <code>{chair.headlineRule}</code>}
    {chair.otherIssues > 0 && <small>+{chair.otherIssues} more record issues</small>}
  </Link>;
}
