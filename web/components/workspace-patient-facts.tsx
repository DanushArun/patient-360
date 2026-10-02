"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  announcePatientAccessWithdrawn,
  purgesPatientState,
} from "@/lib/workspace-state.mjs";
import {
  factStateLabel,
  factValueLabel,
  factsTemporalDescription,
  sourceDocumentHref,
} from "@/lib/workspace-patient-facts.mjs";
import styles from "./workspace-patient-facts.module.css";

type FactDomain = "demographics" | "labs" | "coverage" | "treatment_plan" |
  "encounters" | "identity";
type LabFact = Record<string, unknown> & {
  concept?: string; value_state?: string; event_id?: string;
  source_document_ids?: unknown[]; source_assertion_ids?: unknown[];
  source_event_ids?: unknown[];
};
type WorkspacePayload = {
  domain?: string; facts?: unknown; known_as_of?: string | null;
  requested_known_as_of?: string | null; as_of_semantics?: string;
  error?: string; purge_patient_state?: boolean;
};
type LoadResult = { key: string; state: "loading" | "ready" | "error" | "access";
  data: WorkspacePayload | null };

const DOMAINS: ReadonlyArray<{ id: FactDomain; label: string }> = [
  { id: "labs", label: "Labs" },
  { id: "demographics", label: "Demographics" },
  { id: "coverage", label: "Coverage" },
  { id: "treatment_plan", label: "Treatment plan" },
  { id: "encounters", label: "Encounters" },
  { id: "identity", label: "Identity" },
];

const DOMAIN_FIELDS: Record<FactDomain, ReadonlyArray<{ key: string; label: string }>> = {
  labs: [],
  demographics: [
    { key: "patient_id", label: "Patient ID" }, { key: "name", label: "Name" },
    { key: "dob", label: "Date of birth" }, { key: "gender", label: "Gender" },
    { key: "district", label: "District" }, { key: "state", label: "State" },
    { key: "primary_language", label: "Primary language" },
  ],
  coverage: [
    { key: "payer_name", label: "Payer" }, { key: "annual_limit", label: "Annual limit" },
    { key: "used_amount", label: "Used amount" },
    { key: "is_family_floater", label: "Family floater" },
  ],
  treatment_plan: [
    { key: "version", label: "Version" }, { key: "regimen_display", label: "Regimen" },
    { key: "intent", label: "Recorded intent" }, { key: "decided_at", label: "Decided at" },
  ],
  encounters: [
    { key: "encounter_id", label: "Encounter ID" }, { key: "cycle_number", label: "Cycle" },
    { key: "event_time", label: "Event time" }, { key: "gap_type", label: "Gap type" },
  ],
  identity: [
    { key: "source_system", label: "Source system" }, { key: "link_status", label: "Link status" },
  ],
};

const DOMAIN_TITLES: Record<FactDomain, string> = {
  labs: "Lab records", demographics: "Demographics", coverage: "Coverage records",
  treatment_plan: "Treatment plan records", encounters: "Encounters", identity: "Identity links",
};

export function StructuredFactsWorkspace({ patientId, knownAsOf }: {
  patientId: string; knownAsOf: string | null;
}): ReactNode {
  const [domain, setDomain] = useState<FactDomain>("labs");
  const [openFact, setOpenFact] = useState<string | null>(null);
  const { current, retry } = useFactsData(patientId, domain, knownAsOf);
  const chooseDomain = (next: FactDomain) => {
    setOpenFact(null);
    setDomain(next);
  };
  return <section className={styles.workspace} aria-label="Patient facts">
    <h2>Structured facts</h2>
    <div className={styles.domains} role="group" aria-label="Fact domain">
      {DOMAINS.map((item) => <button key={item.id} type="button"
        aria-pressed={domain === item.id} onClick={() => chooseDomain(item.id)}>
        {item.label}
      </button>)}
    </div>
    {current.state === "loading" && <p className={styles.message} role="status">
      Loading authorized facts…
    </p>}
    {current.state === "error" && <p className={styles.message} role="alert">
      {current.data?.error ?? "Facts could not be loaded."}
      <button type="button" onClick={retry}>Retry</button>
    </p>}
    {current.state === "access" && <p className={styles.message} role="alert">
      Patient access changed. Facts were cleared.
    </p>}
    {current.state === "ready" && current.data && <FactsResult domain={domain}
      data={current.data} patientId={patientId} knownAsOf={knownAsOf}
      openFact={openFact} onToggleFact={setOpenFact} />}
  </section>;
}

function useFactsData(patientId: string, domain: FactDomain, knownAsOf: string | null): {
  current: LoadResult; retry: () => void;
} {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<LoadResult>({ key: "", state: "loading", data: null });
  const key = `${patientId}\u001f${domain}\u001f${knownAsOf ?? ""}\u001f${attempt}`;
  const url = factsUrl(patientId, domain, knownAsOf);
  useEffect(() => {
    const controller = new AbortController();
    setResult({ key, state: "loading", data: null });
    const input = { url, domain, patientId, knownAsOf, signal: controller.signal };
    void readFacts(input).then((response) => {
      if (!controller.signal.aborted) setResult({ key, ...response });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key, state: "error", data: null });
    });
    return () => controller.abort();
  }, [domain, key, knownAsOf, patientId, url]);
  return { current: result.key === key ? result
    : { key, state: "loading", data: null }, retry: () => setAttempt((n) => n + 1) };
}

function factsUrl(patientId: string, domain: FactDomain, knownAsOf: string | null): string {
  const query = new URLSearchParams({ view: "facts", domain });
  if (knownAsOf) query.set("known_as_of", knownAsOf);
  return `/api/patient/${encodeURIComponent(patientId)}/workspace?${query}`;
}

async function readFacts({ url, domain, patientId, knownAsOf, signal }: {
  url: string; domain: FactDomain; patientId: string;
  knownAsOf: string | null; signal: AbortSignal;
}): Promise<Pick<LoadResult, "state" | "data">> {
  const response = await fetch(url, { cache: "no-store", signal });
  const body = await response.json() as WorkspacePayload;
  if (signal.aborted) return { state: "loading", data: null };
  if (purgesPatientState(body) || isAccessError(body.error)) {
    announcePatientAccessWithdrawn(patientId);
    return { state: "access", data: null };
  }
  if (!response.ok || body.error) throw new Error("facts_read_unavailable");
  if (!validEnvelope(body, domain, knownAsOf)) throw new Error("facts_cutoff_mismatch");
  return { state: "ready", data: body };
}

function isAccessError(code?: string): boolean {
  return code === "no_patient_access" || code === "access_withdrawn";
}

function validEnvelope(data: WorkspacePayload, domain: FactDomain,
  knownAsOf: string | null): boolean {
  if (data.domain !== domain || typeof data.known_as_of !== "string") return false;
  if (data.facts === null || data.facts === undefined) return false;
  if (domain !== "labs" || data.as_of_semantics !== "ingested_cutoff" || !knownAsOf) return true;
  return data.known_as_of === knownAsOf
    && (data.requested_known_as_of === null || data.requested_known_as_of === knownAsOf);
}

export function FactsResult({ domain, data, patientId, knownAsOf, openFact,
  onToggleFact }: {
  domain: FactDomain; data: WorkspacePayload; patientId: string; knownAsOf: string | null;
  openFact: string | null; onToggleFact: (id: string | null) => void;
}): ReactNode {
  const temporal = factsTemporalDescription(data);
  const rows = recordRows(data.facts);
  if (domain === "labs") return <section className={styles.results}>
    <h3>{DOMAIN_TITLES[domain]}</h3>
    <p className={styles.temporal}>{temporal}</p>
    <LabRows rows={rows as LabFact[]} patientId={patientId}
      knownAsOf={data.known_as_of ?? knownAsOf} openFact={openFact} onToggleFact={onToggleFact} />
  </section>;
  return <section className={styles.results}>
    <h3>{DOMAIN_TITLES[domain]}</h3>
    <p className={styles.temporal}>{temporal}</p>
    <DomainRecords domain={domain} rows={rows} />
  </section>;
}

function recordRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  return isRecord(value) ? [value] : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function LabRows({ rows, patientId, knownAsOf, openFact, onToggleFact }: {
  rows: LabFact[]; patientId: string; knownAsOf: string | null;
  openFact: string | null; onToggleFact: (id: string | null) => void;
}): ReactNode {
  if (!rows.length) return <p className={styles.empty}>No lab records were returned.</p>;
  return <>
    <div className={styles.tableWrap}>
      <table aria-label="Lab facts">
        <thead><tr><th scope="col">Test</th><th scope="col">Value</th>
          <th scope="col">Unit</th><th scope="col">Status</th><th scope="col">Date</th>
          <th scope="col">Source</th>
          <th scope="col"><span className={styles.srOnly}>Details</span></th>
        </tr></thead>
        <tbody>{rows.map((fact, index) => <LabTableRow key={factId(fact, index)}
          fact={fact} patientId={patientId} knownAsOf={knownAsOf}
          expanded={openFact === factId(fact, index)}
          onToggle={() => onToggleFact(openFact === factId(fact, index)
            ? null : factId(fact, index))} />)}</tbody>
      </table>
    </div>
    <div className={styles.mobileRows}>
      {rows.map((fact, index) => <LabMobileRow key={factId(fact, index)} fact={fact}
        patientId={patientId} knownAsOf={knownAsOf} expanded={openFact === factId(fact, index)}
        onToggle={() => onToggleFact(openFact === factId(fact, index)
          ? null : factId(fact, index))} />)}
    </div>
  </>;
}

function LabTableRow({ fact, patientId, knownAsOf, expanded, onToggle }: {
  fact: LabFact; patientId: string; knownAsOf: string | null;
  expanded: boolean; onToggle: () => void;
}): ReactNode {
  return <>
    <tr>
      <th scope="row">{text(fact.concept, "Concept unavailable")}</th>
      <td>{factValueLabel(fact)}{fact.is_derived === true &&
        <span className={styles.derived}>SQL-derived</span>}</td>
      <td>{text(fact.unit, "—")}</td>
      <td><span className={styles.state} data-state={String(fact.value_state ?? "unknown")}>
        {factStateLabel(fact.value_state)}
      </span></td>
      <td>{text(fact.event_time, "Not recorded")}</td>
      <td><SourceLinks fact={fact} patientId={patientId} knownAsOf={knownAsOf} /></td>
      <td><button type="button" className={styles.detailButton} aria-expanded={expanded}
        aria-label={`${text(fact.concept, "Fact")} details`} onClick={onToggle}>
        {expanded ? "Hide" : "Details"}
      </button></td>
    </tr>
    {expanded && <tr><td colSpan={7}><FactDetails fact={fact} patientId={patientId}
      knownAsOf={knownAsOf} /></td></tr>}
  </>;
}

function LabMobileRow({ fact, patientId, knownAsOf, expanded, onToggle }: {
  fact: LabFact; patientId: string; knownAsOf: string | null;
  expanded: boolean; onToggle: () => void;
}): ReactNode {
  return <article className={styles.mobileFact}>
    <div className={styles.mobileHeading}>
      <strong>{text(fact.concept, "Concept unavailable")}</strong>
      <span className={styles.state} data-state={String(fact.value_state ?? "unknown")}>
        {factStateLabel(fact.value_state)}
      </span></div>
    {fact.is_derived === true && <span className={styles.derived}>SQL-derived</span>}
    <dl className={styles.mobileSummary}>
      <Property label="Value" value={factValueLabel(fact)} />
      <Property label="Unit" value={text(fact.unit, "—")} />
      <Property label="Date" value={text(fact.event_time, "Not recorded")} />
    </dl>
    <button className={styles.mobileToggle} type="button" aria-expanded={expanded}
      aria-label={`${text(fact.concept, "Fact")} details`} onClick={onToggle}>
      {expanded ? "Hide details" : "View details"}
    </button>
    {expanded && <FactDetails fact={fact} patientId={patientId} knownAsOf={knownAsOf} />}
  </article>;
}

function FactDetails({ fact, patientId, knownAsOf }: {
  fact: LabFact; patientId: string; knownAsOf: string | null;
}): ReactNode {
  return <dl className={styles.details}>
    {fact.is_derived === true && <Property label="Derived basis"
      value={text(fact.derivation, "SQL-derived; basis not returned")} />}
    <Property label="Event time" value={text(fact.event_time, "Not recorded")} />
    <Property label="Source recorded" value={text(fact.source_recorded_at, "Not recorded")} />
    <Property label="Ingested" value={text(fact.ingested_at, "Not recorded")} />
    <Property label="Source links observed"
      value={text(fact.source_links_observed_at, "Not recorded")} />
    <Property label="Event ID" value={text(fact.event_id, "Not returned")} />
    <Property label="Source event IDs" value={idList(fact.source_event_ids)} />
    <Property label="Assertion IDs" value={idList(fact.source_assertion_ids)} />
    <div><dt>Source documents</dt><dd>
      <SourceLinks fact={fact} patientId={patientId} knownAsOf={knownAsOf} />
    </dd></div>
  </dl>;
}

function SourceLinks({ fact, patientId, knownAsOf }: {
  fact: LabFact; patientId: string; knownAsOf: string | null;
}): ReactNode {
  const docs = stringIds(fact.source_document_ids);
  if (!docs.length) return <span className={styles.unavailable}>No source document linked</span>;
  return <span className={styles.sourceLinks}>{docs.map((doc) => {
    const href = sourceDocumentHref(patientId, doc, knownAsOf);
    return href ? <a key={doc} href={href}>
      Open source document <span className={styles.srOnly}>{doc}</span>
    </a> : <span key={doc}>{doc} · cutoff unavailable</span>;
  })}</span>;
}

function DomainRecords({ domain, rows }: {
  domain: FactDomain; rows: Record<string, unknown>[];
}): ReactNode {
  if (!rows.length) return <p className={styles.empty}>
    No {DOMAIN_TITLES[domain].toLowerCase()} were returned.
  </p>;
  return <div className={styles.records}>{rows.map((row, index) => <article
    className={styles.record} key={`${domain}-${index}`}>
    <h4>{recordTitle(domain, row)}</h4>
    <dl>{DOMAIN_FIELDS[domain].map(({ key, label }) => <Property key={key} label={label}
      value={fieldValue(row[key])} />)}</dl>
  </article>)}</div>;
}

function recordTitle(domain: FactDomain, row: Record<string, unknown>): string {
  const key = { demographics: "name", coverage: "payer_name", treatment_plan: "regimen_display",
    encounters: "encounter_id", identity: "source_system", labs: "concept" }[domain];
  return text(row[key], domain === "demographics" ? "Patient record" : DOMAIN_TITLES[domain]);
}

function Property({ label, value }: { label: string; value: string }): ReactNode {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function text(value: unknown, fallback: string): string {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function fieldValue(value: unknown): string {
  return value === null || value === undefined ? "Not recorded" : String(value);
}

function stringIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string") : [];
}

function idList(value: unknown): string {
  return stringIds(value).join(", ") || "None returned";
}

function factId(fact: LabFact, index: number): string {
  return text(fact.event_id, `${fact.concept ?? "fact"}-${index}`);
}
