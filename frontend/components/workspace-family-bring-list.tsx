"use client";

import type { ReactNode } from "react";
import { useWorkspaceData } from "./workspace-patient-data";
import { documentLibraryRows } from "@/lib/workspace-documents.mjs";
import styles from "./workspace-patient-family.module.css";

export function FamilyBringList({ patientId, knownAsOf, preview }: {
  patientId: string; knownAsOf: string | null; preview: boolean;
}): ReactNode {
  const query = new URLSearchParams({ view: "documents" });
  if (knownAsOf) query.set("known_as_of", knownAsOf);
  const result = useWorkspaceData(`/api/patient/${encodeURIComponent(patientId)}`
    + `/workspace?${query}`, patientId, preview);
  const expected = documentLibraryRows(result.data?.rows ?? [],
    result.data?.expected_documents ?? []).filter((row) => row.kind === "expected"
      && ["not_received", "pending", "conflicting", "unreadable"].includes(row.stateCode));
  return <section className={styles.checklist} aria-label="Bring before the visit">
    <h2>Bring before the visit</h2>
    {preview ? <p className={styles.languageNote}>
      Expected document details are not included in this recorded preview.
    </p> : result.state === "loading" ? <p role="status">Loading expected records…</p>
      : result.state === "error" ? <p role="alert">Expected records could not be read.
        <button className="sa-quiet-button" type="button" onClick={result.retry}>Retry</button>
      </p> : <ul>{expected.map((row) => <li className={styles.checkItem} key={row.id}>
        <strong>{row.title}</strong><p>{row.state} · {row.reason ?? row.verification}</p>
      </li>)}</ul>}
    {!preview && result.state === "ready" && !expected.length && <p>
      No expected document requests were returned. Confirm preparation with the care team.
    </p>}
  </section>;
}
