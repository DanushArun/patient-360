"use client";

import { Clock } from "@/components/ui/clock";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { announcePatientAccessWithdrawn, purgesPatientState } from "@/lib/workspace-state.mjs";
import { normalizeWorkspaceRows } from "@/lib/workspace-data.mjs";
import { documentLibraryRows, documentSourceHref, type DocumentLibraryRow }
  from "@/lib/workspace-documents.mjs";
import styles from "@/components/workspace-patient-data.module.css";

type DocumentRow = {
  doc_id: string;
  page_count?: number;
  doc_type?: string;
  version?: string | number;
  source_quality?: string;
  source_facility?: string | null;
  missingness_state?: string;
  evidence_state?: string;
  assertion_count?: number;
  verified_assertions?: number;
  conflicting_assertions?: number;
  verification_observed_at?: string | null;
  source_recorded_at?: string;
  event_time?: string | null;
  ingested_at?: string | null;
};
type WorkspaceData = {
  rows?: DocumentRow[];
  expected_documents?: Record<string, unknown>[];
  known_as_of?: string | null;
  requested_known_as_of?: string | null;
  error?: string;
  purge_patient_state?: boolean;
};
type LoadState = "loading" | "ready" | "error" | "access";
type ViewMode = "table" | "type" | "expected";
type LibraryFilters = { search: string; facility: string; state: string; type: string };

export function useWorkspaceData(url: string, patientId: string, disabled = false): {
  data: WorkspaceData | null; state: LoadState; retry: () => void;
} {
  const [attempt, setAttempt] = useState(0);
  const key = `${patientId}\u001f${url}\u001f${attempt}`;
  const [load, setLoad] = useState<{
    key: string; data: WorkspaceData | null; state: LoadState;
  }>({ key: "", data: null, state: "loading" });
  useEffect(() => {
    if (disabled) return;
    const controller = new AbortController();
    setLoad({ key, data: null, state: "loading" });
    readDocumentLibrary(url, patientId, controller.signal).then((result) => {
      if (controller.signal.aborted || !result) return;
      setLoad("access" in result
        ? { key, data: null, state: "access" }
        : { key, data: result.data, state: "ready" });
    }).catch(() => {
      if (!controller.signal.aborted) setLoad({ key, data: null, state: "error" });
    });
    return () => controller.abort();
  }, [key, patientId, url, disabled]);
  const current = load.key === key ? load : { data: null, state: "loading" as const };
  return { ...current, retry: () => setAttempt((value) => value + 1) };
}

async function readDocumentLibrary(url: string, patientId: string,
  signal: AbortSignal): Promise<{ access: true } | { data: WorkspaceData } | null> {
  const response = await fetch(url, { cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
  const body = await response.json() as WorkspaceData;
  if (signal.aborted) return null;
  if (purgesPatientState(body) || ["no_patient_access", "access_withdrawn", "consent_not_valid"]
    .includes(body.error ?? "")) {
    announcePatientAccessWithdrawn(patientId);
    return { access: true as const };
  }
  if (!response.ok || body.error || !Array.isArray(body.rows)) {
    throw new Error("workspace_data_unavailable");
  }
  const requestedCutoff = new URL(url, window.location.origin)
    .searchParams.get("known_as_of");
  if (requestedCutoff && body.known_as_of !== requestedCutoff) {
    throw new Error("document_cutoff_mismatch");
  }
  if (body.rows) body.rows = normalizeWorkspaceRows(body.rows) as DocumentRow[];
  return { data: body };
}

export function DocumentsWorkspace({ patientId, knownAsOf, onSelectGate }: {
  patientId: string;
  knownAsOf: string | null;
  onSelectGate?: (ruleId: string) => void;
}): ReactNode {
  const query = new URLSearchParams({ view: "documents" });
  if (knownAsOf) query.set("known_as_of", knownAsOf);
  const url = `/api/patient/${encodeURIComponent(patientId)}/workspace?${query}`;
  const result = useWorkspaceData(url, patientId);
  const rows = useMemo(() => documentLibraryRows(
    result.data?.rows ?? [], result.data?.expected_documents ?? [],
  ), [result.data]);
  const library = useDocumentsLibrary({ patientId, knownAsOf: result.data?.known_as_of ?? knownAsOf,
    rows });

  return <section className={styles.workspace} aria-label="Patient documents">
    <LibraryHeading knownAsOf={result.data?.known_as_of ?? knownAsOf}
      sourceHref={library.sourceHref} />
    <DataState state={result.state} onRetry={result.retry} />
    {result.state === "ready" && <LibraryContent rows={rows} library={library}
      onSelectGate={onSelectGate} />}
  </section>;
}

function useDocumentsLibrary({ patientId, knownAsOf, rows }: {
  patientId: string; knownAsOf: string | null; rows: DocumentLibraryRow[];
}): {
  view: ViewMode;
  setView: (view: ViewMode) => void;
  filters: LibraryFilters;
  setFilters: (filters: LibraryFilters) => void;
  visibleRows: DocumentLibraryRow[];
  selectedRow: DocumentLibraryRow | null;
  sourceHref: string | null;
  select: (row: DocumentLibraryRow) => void;
} {
  const [view, setView] = useState<ViewMode>("table");
  const [filters, setFilters] = useState<LibraryFilters>(emptyFilters());
  const [selection, setSelection] = useState<{ patientId: string; docId: string | null }>(
    { patientId, docId: null },
  );
  const selectedId = selection.patientId === patientId ? selection.docId : null;
  const visibleRows = useMemo(() => filterRows(rows, filters, view), [rows, filters, view]);
  const selectedRow = visibleRows.find((row) => row.id === selectedId && row.kind === "received")
    ?? visibleRows.find((row) => row.kind === "received") ?? null;
  const document = selectedRow?.document as DocumentRow | null;
  const sourceHref = document?.page_count
    ? documentSourceHref(patientId, document.doc_id, knownAsOf) : null;
  return { view, setView, filters, setFilters, visibleRows, selectedRow, sourceHref,
    select: (row) => {
      if (row.kind === "received") {
        setSelection({ patientId, docId: String(row.document?.doc_id) });
      }
    } };
}

function LibraryHeading({ knownAsOf, sourceHref }: {
  knownAsOf: string | null; sourceHref: string | null;
}): ReactNode {
  return <header className={styles.header}>
    <div>
      <h2>Patient documents</h2>
      <p className={styles.asOf}>Known as of <Clock value={knownAsOf} /></p>
    </div>
    {sourceHref
      ? <a className={styles.primaryAction} href={sourceHref}>Open source</a>
      : <button className={styles.primaryAction} type="button" disabled>Open source</button>}
  </header>;
}

function LibraryContent({ rows, library, onSelectGate }: {
  rows: DocumentLibraryRow[];
  library: ReturnType<typeof useDocumentsLibrary>;
  onSelectGate?: (ruleId: string) => void;
}): ReactNode {
  const { view, setView, filters, setFilters, visibleRows, selectedRow, select } = library;
  return <>
    <ViewControls view={view} onChange={setView} />
    <Filters rows={rows} filters={filters} onChange={setFilters} />
    {!rows.length
      ? <p className={styles.empty} role="status">No document records were returned.</p>
      : !visibleRows.length
        ? <p className={styles.empty} role="status">No documents match these filters.
          <button type="button" onClick={() => setFilters(emptyFilters())}>Reset filters</button>
        </p>
        : <DocumentTable rows={visibleRows} selectedId={selectedRow?.id ?? null}
          groupByType={view === "type"} onSelect={select} onSelectGate={onSelectGate} />}
    <p className={styles.note}>Not received does not mean a negative result.</p>
  </>;
}

function emptyFilters(): LibraryFilters {
  return { search: "", facility: "", state: "", type: "" };
}

function filterRows(
  rows: DocumentLibraryRow[], filters: LibraryFilters, view: ViewMode,
): DocumentLibraryRow[] {
  return rows.filter((row) => {
    if (view === "expected" && row.kind !== "expected") return false;
    const text = `${row.title} ${row.document?.doc_id ?? ""} ${row.reason ?? ""}`.toLowerCase();
    if (filters.search && !text.includes(filters.search.toLowerCase())) return false;
    if (filters.facility && row.sourceFacility !== filters.facility) return false;
    if (filters.state && row.state !== filters.state) return false;
    const type = row.kind === "expected" ? "Expected record"
      : String(row.document?.doc_type ?? "Document type unavailable");
    return !filters.type || type === filters.type;
  });
}

function ViewControls({ view, onChange }: {
  view: ViewMode; onChange: (view: ViewMode) => void;
}): ReactNode {
  const options: { id: ViewMode; label: string }[] = [
    { id: "table", label: "Table" }, { id: "type", label: "By type" },
    { id: "expected", label: "Expected documents" },
  ];
  return <nav className={styles.views} aria-label="Document views">
    {options.map((option) => <button key={option.id} type="button"
      aria-pressed={view === option.id} onClick={() => onChange(option.id)}>
      {option.label}
    </button>)}
  </nav>;
}

function Filters({ rows, filters, onChange }: {
  rows: DocumentLibraryRow[];
  filters: LibraryFilters;
  onChange: (filters: LibraryFilters) => void;
}): ReactNode {
  const facilities = uniqueValues(rows.map((row) => row.sourceFacility));
  const states = uniqueValues(rows.map((row) => row.state));
  const types = uniqueValues(rows.map((row) => row.kind === "expected" ? "Expected record"
    : String(row.document?.doc_type ?? "Document type unavailable")));
  return <div className={styles.filters}>
    <label className={styles.search}>
      <span>Search documents</span>
      <input type="search" value={filters.search} placeholder="Search by name or ID"
        onChange={(event) => onChange({ ...filters, search: event.target.value })} />
    </label>
    <FilterSelect label="Facility" value={filters.facility} options={facilities}
      onChange={(value) => onChange({ ...filters, facility: value })} />
    <FilterSelect label="Evidence state" value={filters.state} options={states}
      onChange={(value) => onChange({ ...filters, state: value })} />
    <FilterSelect label="Document type" value={filters.type} options={types}
      onChange={(value) => onChange({ ...filters, type: value })} />
  </div>;
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (value: string) => void;
}): ReactNode {
  return <label className={styles.filter}>
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">All {label.toLowerCase()}s</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>;
}

function DocumentTable({ rows, selectedId, groupByType, onSelect, onSelectGate }: {
  rows: DocumentLibraryRow[];
  selectedId: string | null;
  groupByType: boolean;
  onSelect: (row: DocumentLibraryRow) => void;
  onSelectGate?: (ruleId: string) => void;
}): ReactNode {
  const grouped = new Map<string, DocumentLibraryRow[]>();
  for (const row of rows) {
    const type = groupByType
      ? (row.kind === "expected" ? "Expected record"
        : String(row.document?.doc_type ?? "Document type unavailable"))
      : "Documents";
    grouped.set(type, [...(grouped.get(type) ?? []), row]);
  }
  return <div className={styles.tableWrap}>
    {[...grouped].map(([type, group]) => <section key={type} className={styles.group}>
      {groupByType && <h3>{type}</h3>}
      <table>
        <thead><tr>
          <th scope="col">Document</th><th scope="col">Type</th>
          <th scope="col">Source facility</th><th scope="col">Record times</th>
          <th scope="col">Record state</th>
          <th scope="col">Assertions, current at query</th>
          <th scope="col">Action</th>
        </tr></thead>
        <tbody>{group.map((row) => <DocumentTableRow key={row.id} row={row}
          selected={selectedId === row.id} onSelect={onSelect}
          onSelectGate={onSelectGate} />)}</tbody>
      </table>
    </section>)}
  </div>;
}

function DocumentTableRow({ row, selected, onSelect, onSelectGate }: {
  row: DocumentLibraryRow; selected: boolean; onSelect: (row: DocumentLibraryRow) => void;
  onSelectGate?: (ruleId: string) => void;
}): ReactNode {
  const document = row.document as DocumentRow | null;
  const type = row.kind === "expected" ? "Expected record"
    : String(document?.doc_type ?? "Document type unavailable");
  const docId = row.kind === "received" && document?.doc_id ? String(document.doc_id) : null;
  return <tr data-selected={selected} data-kind={row.kind}
    data-copilot-ref={docId ? `document:${docId}` : undefined}
    data-copilot-label={docId ? `Document ${type}` : undefined}>
    <td data-label="Document">
      {row.kind === "received"
        ? <button type="button" className={styles.selectDocument}
          aria-pressed={selected} onClick={() => onSelect(row)}>
          {row.title}<span>{document?.doc_id}</span>
        </button>
        : <strong>{row.title}</strong>}
      {document?.version !== undefined && <small>Version {document.version}</small>}
      {document?.source_quality && <small>Source quality: {document.source_quality}</small>}
      {row.ruleId && <small>Rule {row.ruleId}</small>}
    </td>
    <td data-label="Type">{type}</td>
    <td data-label="Source facility">{row.sourceFacility}</td>
    <td data-label="Record times"><RecordTimes document={document} /></td>
    <td data-label="Record state"><span className={styles.state}
      data-state={row.stateCode}>{row.state}</span>
      {row.reason && <small className={styles.reason}>{row.reason}</small>}
    </td>
    <td data-label="Assertions, current at query">
      {row.verification}
      {row.verificationObservedAt && <small>Observed at {row.verificationObservedAt}</small>}
    </td>
    <td data-label="Action">{row.kind === "expected"
      ? <RequestAction onSelectGate={onSelectGate} ruleId={row.ruleId} />
      : selected && document?.page_count === 0
        ? <span>No source pages returned</span>
        : <span>Use Open source above</span>}
    </td>
  </tr>;
}

function RecordTimes({ document }: { document: DocumentRow | null }): ReactNode {
  if (!document) return <span>—</span>;
  return <dl className={styles.times}>
    <div><dt>Event</dt><dd><TimeValue value={document.event_time} /></dd></div>
    <div><dt>Source recorded</dt><dd><TimeValue value={document.source_recorded_at} /></dd></div>
    <div><dt>Received</dt><dd><TimeValue value={document.ingested_at} /></dd></div>
  </dl>;
}

function TimeValue({ value }: { value?: string | null }): ReactNode {
  return value ? <time dateTime={value}>{value}</time> : "Not recorded";
}

function RequestAction({ ruleId, onSelectGate }: {
  ruleId: string | null; onSelectGate?: (ruleId: string) => void;
}): ReactNode {
  if (!ruleId) return <span>Request unavailable; rule not returned.</span>;
  if (!onSelectGate) return <div className={styles.unavailableAction}>
    <button className={styles.requestAction} type="button" disabled>Request document</button>
    <small>Follow-up actions are unavailable in this view.</small>
  </div>;
  return <button className={styles.requestAction} type="button"
    onClick={() => onSelectGate(ruleId)}>Request document</button>;
}

function DataState({ state, onRetry }: { state: LoadState; onRetry: () => void }): ReactNode {
  if (state === "loading") return <p className={styles.stateMessage} role="status">
    Loading authorized document records…
  </p>;
  if (state === "error") return <p className={styles.error} role="alert">
    Document records could not be loaded. <button type="button" onClick={onRetry}>Retry</button>
  </p>;
  if (state === "access") return <p className={styles.error} role="alert">
    Patient access has changed. Return to the authorized worklist.
  </p>;
  return null;
}
