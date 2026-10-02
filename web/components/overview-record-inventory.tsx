"use client";

import type { ReactNode } from "react";
import { useWorkspaceData } from "./workspace-patient-data";
import { documentLibraryRows, documentSourceHref,
  type DocumentLibraryRow } from "@/lib/workspace-documents.mjs";
import { formatRecordDate } from "@/lib/workspace-record-date.mjs";
import styles from "./overview-record-inventory.module.css";

type InventoryProps = {
  patientId: string; knownAsOf: string | null; preview: boolean; visit: ReactNode;
};

export function OverviewRecordInventory(props: InventoryProps): ReactNode {
  const query = new URLSearchParams({ view: "documents" });
  if (props.knownAsOf) query.set("known_as_of", props.knownAsOf);
  const result = useWorkspaceData(`/api/patient/${encodeURIComponent(props.patientId)}`
    + `/workspace?${query}`, props.patientId, props.preview);
  const rows = documentLibraryRows(result.data?.rows ?? [], result.data?.expected_documents ?? []);
  const recent = rows.filter((row) => row.kind === "received")
    .sort((a, b) => String(b.document?.source_recorded_at ?? "")
      .localeCompare(String(a.document?.source_recorded_at ?? ""))).slice(0, 3);
  return <>
    <div className={styles.columns}>{props.visit}
      <section className={styles.section} aria-label="Recent record">
        <h2>Recent record</h2>
        <InventoryTable rows={recent} patientId={props.patientId} knownAsOf={props.knownAsOf}
          recent />
        <InventoryState preview={props.preview} state={result.state} retry={result.retry}
          empty={!recent.length} />
      </section>
    </div>
    <section className={styles.section} aria-label="Overview documents">
      <h2>Documents</h2>
      <InventoryTable rows={rows} patientId={props.patientId} knownAsOf={props.knownAsOf} />
      <InventoryState preview={props.preview} state={result.state} retry={result.retry}
        empty={!rows.length} />
    </section>
  </>;
}

function InventoryState({ preview, state, retry, empty }: {
  preview: boolean; state: string; retry: () => void; empty: boolean;
}): ReactNode {
  if (preview) return <p className={styles.note} role="status">
    Document details are not included in this recorded preview.
  </p>;
  if (state === "loading") return <p className={styles.note} role="status">
    Loading source inventory…</p>;
  if (state === "error") return <p className={styles.note} role="alert">
    Source inventory could not be read.
    <button type="button" onClick={retry}>Retry inventory</button>
  </p>;
  return empty ? <p className={styles.note}>No source records were returned.</p> : null;
}

export function InventoryTable({ rows, patientId, knownAsOf, recent = false }: {
  rows: DocumentLibraryRow[]; patientId: string; knownAsOf: string | null; recent?: boolean;
}): ReactNode {
  return <div className={styles.tableWrap}>
    <table aria-label={recent ? "Recent records" : "Documents"}>
    <thead><tr>{(recent ? ["Date", "Record", "Source"]
      : ["Document", "Status", "Details", "Source", "Source recorded"])
      .map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead>
    <tbody>{rows.map((row) => <InventoryRow key={row.id} row={row} patientId={patientId}
      knownAsOf={knownAsOf} recent={recent} />)}</tbody>
  </table></div>;
}

function InventoryRow({ row, patientId, knownAsOf, recent }: {
  row: DocumentLibraryRow; patientId: string; knownAsOf: string | null; recent: boolean;
}): ReactNode {
  const recorded = row.document?.source_recorded_at;
  const date = typeof recorded === "string" ? formatRecordDate(recorded) : "Not recorded";
  const href = row.kind === "received" && row.document?.page_count
    ? documentSourceHref(patientId, String(row.document.doc_id), knownAsOf)
      ?.replace("return=documents", "return=overview") : null;
  const title = href ? <a href={href}>{row.title}</a> : row.title;
  if (recent) return <tr><td data-label="Date">{date}</td>
    <td data-label="Record">{title}</td><td data-label="Source">{row.sourceFacility}</td></tr>;
  return <tr><td data-label="Document">{title}</td>
    <td data-label="Status"><span className={styles.state} data-state={row.stateCode}>
      {row.state}</span></td>
    <td data-label="Details">{row.reason ?? row.verification}</td>
    <td data-label="Source">{row.sourceFacility}</td><td data-label="Source recorded">{date}</td>
  </tr>;
}
