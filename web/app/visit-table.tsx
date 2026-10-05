"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { CensusChip } from "@/components/sa";
import type { Chair } from "@/lib/census";
import { formatVisitSlot } from "@/lib/worklist-display.mjs";
import styles from "./visit-table.module.css";

type SortKey = "name" | "scheduled" | "regimen" | "status" | "headline";
type SortDirection = "ascending" | "descending";

export function VisitTable({ chairs }: { chairs: Chair[] }): ReactNode {
  const [sortKey, setSortKey] = useState<SortKey>("scheduled");
  const [direction, setDirection] = useState<SortDirection>("ascending");
  const sortedChairs = useMemo(() => [...chairs].sort((left, right) =>
    compareChairs(left, right, sortKey, direction)), [chairs, direction, sortKey]);

  return <>
    <p className={styles.scheduleNote}>
      Schedule times are shown as recorded; timezone not stored.
    </p>
    <div className={styles.scrollRegion} role="region" aria-label="Visit list" tabIndex={0}>
    <table className={styles.table}>
      <caption className={styles.caption}>Visit list. Schedule timezone is not stored.</caption>
      <VisitTableHead sortKey={sortKey} direction={direction} onSort={changeSort} />
      <VisitTableRows chairs={sortedChairs} />
    </table>
    </div>
  </>;

  function changeSort(nextKey: SortKey): void {
    if (nextKey !== sortKey) {
      setSortKey(nextKey);
      setDirection("ascending");
      return;
    }
    setDirection((current) => current === "ascending" ? "descending" : "ascending");
  }
}

function VisitTableRows({ chairs }: { chairs: Chair[] }): ReactNode {
  return <tbody>{chairs.map((chair) => <tr key={chair.encounterId}
    data-copilot-ref={`patient:${chair.patientId}`} data-copilot-label={chair.name}>
    <td><Link className={styles.patientLink}
      href={`/patient/${chair.patientId}`} prefetch={false}>
      {chair.name}</Link><small>{chair.patientId}</small></td>
    <td className={styles.slot}><time dateTime={chair.scheduled}
      title={chair.scheduled}>{formatVisitSlot(chair.scheduled)}</time></td>
    <td>{chair.regimen ?? "Not recorded"}{cycleLabel(chair.cycle)}</td>
    <td><CensusChip status={chair.status} /></td>
    <td>{chair.headline ?? "No issue summary returned"}
      {chair.otherIssues > 0 && <small>+{chair.otherIssues} other record issues</small>}</td>
  </tr>)}</tbody>;
}

function VisitTableHead({ sortKey, direction, onSort }: {
  sortKey: SortKey;
  direction: SortDirection;
  onSort: (sortKey: SortKey) => void;
}): ReactNode {
  return <thead><tr>
    <SortHeader label="Patient" sortKey="name" activeKey={sortKey}
      direction={direction} onSort={onSort} />
    <SortHeader label="Date and time" sortKey="scheduled" activeKey={sortKey}
      direction={direction} onSort={onSort} />
    <SortHeader label="Regimen and cycle" sortKey="regimen" activeKey={sortKey}
      direction={direction} onSort={onSort} />
    <SortHeader label="Record check" sortKey="status" activeKey={sortKey}
      direction={direction} onSort={onSort} />
    <SortHeader label="Main issue" sortKey="headline" activeKey={sortKey}
      direction={direction} onSort={onSort} />
  </tr></thead>;
}

function SortHeader({ label, sortKey, activeKey, direction, onSort }: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (sortKey: SortKey) => void;
}): ReactNode {
  const active = sortKey === activeKey;
  return <th scope="col" aria-sort={active ? direction : undefined}>
    <button className={styles.sortButton} type="button" onClick={() => onSort(sortKey)}>
      {label}<span aria-hidden="true">{active ? direction === "ascending" ? " ↑" : " ↓" : ""}</span>
    </button>
  </th>;
}

function compareChairs(left: Chair, right: Chair, key: SortKey, direction: SortDirection): number {
  const values = {
    name: [left.name, right.name],
    scheduled: [left.scheduled, right.scheduled],
    regimen: [left.regimen ?? "", right.regimen ?? ""],
    status: [left.status, right.status],
    headline: [left.headline ?? "", right.headline ?? ""],
  } as const;
  const [first, second] = values[key];
  const result = first.localeCompare(second, "en", { numeric: true, sensitivity: "base" });
  return direction === "ascending" ? result : -result;
}

function visitTime(scheduled: string): string {
  const time = /T(\d{2}:\d{2})/.exec(scheduled)?.[1];
  return time ?? "Time unavailable";
}

function cycleLabel(cycle: number | null): string {
  return cycle !== null ? ` · Cycle ${cycle}` : "";
}
