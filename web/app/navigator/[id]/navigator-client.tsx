"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Page, Field, Rule, buttonStyle } from "@/components/sa";
import type { Gate, PatientData } from "@/lib/patient";
import data from "@/lib/navigator-data.json";

type ChecklistKey = keyof typeof data.text;
type Scheme = { schemeId: string; schemeName: string; schemeType: string; annualLimit: number; status: string };

function checklistItems(gates: Gate[]): { key: string; rules: string[] }[] {
  const sources = new Map<string, string[]>();
  const add = (key: string, rule: string) => sources.set(key, [...(sources.get(key) ?? []), rule]);
  for (const gate of gates) {
    const rule = gate.rule_id ?? "";
    if (gate.outcome === "pass") continue;
    if (["CLIN-ANC-001", "CLIN-PLT-001"].includes(rule)) add(gate.outcome === "not_evaluated" || gate.reason?.includes("days old") ? "cbc_fresh" : "wait_for_call", rule);
    else if (["CLIN-CRCL-001", "CLIN-BILI-001"].includes(rule)) add(gate.outcome === "not_evaluated" ? "kft_lft" : "wait_for_call", rule);
    else if (rule === "SURV-LVEF-001") add("echo", rule);
    else if (rule === "SURV-LVEF-002" && gate.outcome === "fail") add("wait_for_call", rule);
    else if (rule === "COV-AUTH-001") add(({ not_evaluated: "preauth_pending", conflicting: "preauth_letter" } as Record<string, string>)[gate.outcome] ?? "preauth_renew", rule);
    else if (rule === "COV-LIMIT-001" && gate.outcome === "fail") add("coverage_limit", rule);
    else if (["DOC-HER2-001", "DOC-DISC-001"].includes(rule)) add("hospital_result_pending", rule);
    else if (rule === "DOC-PATH-001") add(gate.outcome === "fail" ? "path_reports" : "hospital_result_pending", rule);
    else if (rule === "SURG-CLEAR-001") add("surgery_papers", rule);
    else if (["ID-LINK-001", "ID-QUAR-001"].includes(rule)) add("identity", rule);
    else if (rule === "ENDO-HBA1C-001" && gate.outcome === "fail") add("diabetes", rule);
  }
  return data.order.filter((key) => sources.has(key)).map((key) => ({ key, rules: sources.get(key)! }));
}

function visitDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function messageText(patient: PatientData, visit: Date, items: { key: string; rules: string[] }[], lang: keyof typeof data.languages): string {
  const earliest = visitDate(new Date(visit.getTime() - 7 * 86400000));
  const heading = data.text.header[lang].replace("{date}", visitDate(visit)).replace("{name}", patient.patientName);
  const lines = items.map(({ key }, index) => `${index + 1}. ${data.text[key as ChecklistKey][lang].replace("{earliest}", earliest)}`);
  return [heading, "", ...(lines.length ? lines : [data.text.all_clear[lang]]), "", data.text.always_bring[lang]].join("\n");
}

function langCode(language: string | null): string {
  const codes: Record<string, string> = { english: "en", hindi: "hi", tamil: "ta", bengali: "bn", marathi: "mr" };
  return codes[language?.trim().toLowerCase() ?? ""] ?? "en";
}

export default function NavigatorClient({ patient }: { patient: PatientData }): ReactNode {
  const [language, setLanguage] = useState(langCode(patient.language));
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | "">("");
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set());
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [schemesLoading, setSchemesLoading] = useState(true);
  const [schemesError, setSchemesError] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    fetch(`/api/patient/${encodeURIComponent(patient.patientId)}/schemes`)
      .then((r) => { if (!r.ok) throw new Error("schemes_unavailable"); return r.json() as Promise<Scheme[]>; })
      .then(setSchemes)
      .catch(() => setSchemesError(true))
      .finally(() => setSchemesLoading(false));
  }, [patient.patientId]);

  const visit = patient.nextVisit ? new Date(`${patient.nextVisit}T00:00:00`) : null;
  const items = checklistItems(patient.gates);
  const lang = (language in data.languages ? language : "en") as keyof typeof data.languages;
  const earliest = visit ? visitDate(new Date(visit.getTime() - 7 * 86400000)) : "";
  const message = visit ? messageText(patient, visit, items, lang) : "";

  async function copyMessage(): Promise<void> {
    try { await navigator.clipboard.writeText(message); setCopyStatus("copied"); }
    catch { setCopyStatus("failed"); }
  }

  return <Page>
    <div className="sa-masthead" style={{ borderBottom: "none", marginBottom: 4 }}>
      <div className="sa-masthead-patient">{patient.patientName}</div>
      <Field label="Patient" value={patient.patientId} />
      <Field label="Visit" value={visit ? visitDate(visit) : "No upcoming visit"} />
      <Field label="Practitioner" value={patient.practitionerName} />
    </div>
    <div className="mb-2 flex items-center gap-4">
      <div className="text-xs uppercase tracking-wide" style={{ color: "var(--sa-ink-muted)" }}>Navigator View</div>
      <Link href="/" style={{ ...buttonStyle, width: "auto", fontSize: 13, minHeight: 32, padding: "2px 12px" }}>
        Census
      </Link>
    </div>
    <Rule />

    {!visit && <div className="sa-limitation">No upcoming day-care visit is on record for this patient, so there is no visit to prepare the family for.</div>}

    {visit && <>
      <label className="sa-field-label">Family&apos;s language <select value={language} onChange={(e) => { setCopyStatus(""); setLanguage(e.target.value); }}>
        {Object.entries(data.languages).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
      </select></label>

      <div className="sa-field-label" style={{ margin: "12px 0 4px" }}>What the family needs to do before {visitDate(visit)}</div>
      {items.length ? items.map(({ key, rules }, index) => <div className="sa-check-item" key={key}>
        <span className="sa-check-n sa-num">{index + 1}</span>
        <div>
          <div className="sa-check-text">{data.text[key as ChecklistKey][lang].replace("{earliest}", earliest)}</div>
          <div className="sa-meta">from {rules.map((rule) => <code key={rule}>{rule} </code>)}</div>
          <div className="sa-navigator-review">
            <span className={reviewed.has(key) ? "sa-review-state sa-review-state-done" : "sa-review-state"}>{reviewed.has(key) ? "✓ Reviewed by navigator" : "– Draft for navigator review"}</span>
            {!reviewed.has(key) && <button type="button" className="sa-quiet-button" onClick={() => setReviewed((previous) => new Set(previous).add(key))}>Mark reviewed</button>}
          </div>
        </div>
      </div>) : <div className="sa-meta">{data.text.all_clear[lang]}</div>}

      <div className="sa-field-label" style={{ margin: "20px 0 4px" }}>Message for the family</div>
      <pre className="sa-page-text" style={{ whiteSpace: "pre-wrap" }}>{message}</pre>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <button type="button" style={{ ...buttonStyle, width: "auto" }} onClick={() => void copyMessage()}>
          {copyStatus === "copied" ? "Copied" : "Copy message"}
        </button>
        <span aria-live="polite" className={copyStatus === "failed" ? "sa-meta" : "sr-only"}>
          {copyStatus === "copied" ? "Message copied." : copyStatus === "failed" ? "Copy unavailable. Select the message text to copy it." : ""}
        </span>
      </div>
      <div className="sa-meta" style={{ marginTop: 8 }}>
        SAARTHI does not send messages. Copy this into WhatsApp or read it to the family.
        Translations are drafted for review: have a native-speaking navigator check them before first use. Review marks are local until the navigator workflow is connected to the task service.
      </div>
    </>}

    <Rule />
    <div className="sa-field-label" style={{ margin: "12px 0 4px" }}>Scheme records</div>
    <p className="sa-meta">Recorded eligibility checks are not confirmation of enrolment, available cover or authorisation. The help desk must verify these.</p>
    {schemesLoading ? <div className="sa-meta">Loading scheme records…</div> : schemesError ? <div className="sa-limitation" role="alert">Scheme records could not be loaded. No eligibility conclusion is available. Reload to retry.</div> : schemes.length === 0 ? <div className="sa-meta">No scheme records returned for this patient.</div> : (
      <div style={{ display: "grid", gap: 12 }}>
        {schemes.map((s) => (
          <div key={s.schemeId} className="sa-evidence sa-ev-patient">
            <div className="sa-ev-kind">{s.schemeType} scheme</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.schemeName}</div>
            <div className="sa-meta">
              Annual limit: <span className="sa-num">&#8377;{Number(s.annualLimit).toLocaleString("en-IN")}</span> · Status: {s.status}
            </div>
          </div>
        ))}
      </div>
    )}

    <div className="sa-limitation" style={{ marginTop: 20 }}>
      Your treating team decides all clinical matters. This checklist helps the family prepare
      documents and logistics. It does not recommend, approve, or refuse any treatment.
    </div>
  </Page>;
}
