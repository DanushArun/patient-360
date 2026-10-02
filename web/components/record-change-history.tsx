import type { ReactNode } from "react";

type RuleSnapshot = {
  known_as_of: string; rule_id: string; rule_version: number; outcome: string; reason: string;
};
type ChangedField = { label: string; before: string; after: string };
export type RecordChange = { before: RuleSnapshot; after: RuleSnapshot;
  fields?: ChangedField[] };

export function readRecordChanges(input: unknown): RecordChange[] | null {
  if (!Array.isArray(input)) return null;
  if (!input.every((row) => row && validSnapshot(row.before) && validSnapshot(row.after)
    && row.before.rule_id === row.after.rule_id && validFields(row.fields))) return null;
  return input as RecordChange[];
}

function validFields(value: unknown): boolean {
  return value === undefined || Array.isArray(value) && value.every((field) => field
    && typeof field.label === "string" && typeof field.before === "string"
    && typeof field.after === "string");
}

function validSnapshot(value: unknown): value is RuleSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.known_as_of === "string" && Number.isFinite(Date.parse(row.known_as_of))
    && typeof row.rule_id === "string" && row.rule_id.length > 0
    && Number.isInteger(row.rule_version) && Number(row.rule_version) > 0
    && ["pass", "fail", "not_evaluated", "conflicting"].includes(String(row.outcome))
    && typeof row.reason === "string";
}

export function RecordChangeHistory({ changes }: { changes: RecordChange[] | null }): ReactNode {
  return <section className="sa-record-change-history" aria-label="Record change history">
    <h2>Record change history</h2>
    {changes === null ? <p className="sa-meta">
      Versioned before-and-after rule results were not returned. Task activity remains separate.
    </p> : !changes.length ? <p className="sa-meta">No rule changes were returned.</p>
      : changes.map((change, index) => <RuleChange key={index} change={change} />)}
  </section>;
}

function RuleChange({ change }: { change: RecordChange }): ReactNode {
  return <section aria-label={`${change.after.rule_id} change`}>
    <h3>{change.after.rule_id}</h3>
    <div className="sa-record-change-columns">
      <Snapshot label="Before" snapshot={change.before} />
      <Snapshot label="After" snapshot={change.after} />
    </div>
    {Boolean(change.fields?.length) && <table aria-label="Changed record fields">
      <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
      <tbody>{change.fields?.map((field, index) => <tr key={index}>
        <th scope="row">{field.label}</th><td>{field.before}</td><td>{field.after}</td>
      </tr>)}</tbody>
    </table>}
    <p className="sa-meta">These are returned rule snapshots. Task closure does not alter them.</p>
  </section>;
}

function Snapshot({ label, snapshot }: { label: string; snapshot: RuleSnapshot }): ReactNode {
  return <div><h4>{label}</h4>
    <dl><dt>Known as of</dt><dd>
      <time dateTime={snapshot.known_as_of}>{snapshot.known_as_of}</time></dd>
      <dt>Rule version</dt><dd>{snapshot.rule_version}</dd>
      <dt>Outcome</dt><dd>{snapshot.outcome.replaceAll("_", " ")}</dd>
      <dt>Reason</dt><dd>{snapshot.reason}</dd></dl>
  </div>;
}
