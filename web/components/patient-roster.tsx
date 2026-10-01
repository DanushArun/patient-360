"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

export type RosterPatient = { id: string; name: string };
export function PatientRoster({ patients, selectedId, preview = false }: { patients: RosterPatient[]; selectedId?: string; preview?: boolean }) {
  const [query, setQuery] = useState("");
  const matches = patients.filter(p => `${p.name} ${p.id}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="ct-roster">
    <div className="ct-roster-heading"><span>Your patients</span><span>{patients.length}</span></div>
    <label className="ct-search"><Search size={15} aria-hidden="true" /><input aria-label="Find a patient" placeholder="Find a patient" value={query} onChange={e => setQuery(e.target.value)} /></label>
    <nav aria-label="Patient records" className="ct-patient-list">
      {matches.map((p, i) => <Link key={p.id} href={`/${preview ? "design-preview" : "patient"}/${encodeURIComponent(p.id)}`} prefetch={false} aria-current={selectedId === p.id ? "page" : undefined} className={`ct-patient-option${selectedId === p.id ? " selected" : ""}`}>
        <span className={`ct-avatar tone-${i % 6}`} aria-hidden="true">{p.name.split(/\s+/).slice(0,2).map(s => s[0]).join("")}</span>
        <span><strong>{p.name}</strong><small>{p.id}</small></span>
      </Link>)}
      {!matches.length && <p className="ct-roster-empty">{patients.length ? "No matching patients." : "No patient records available."}</p>}
    </nav>
  </section>;
}
