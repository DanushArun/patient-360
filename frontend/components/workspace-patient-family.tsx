"use client";

import { useState, type ReactNode } from "react";
import type { Gate, PatientData } from "@/lib/patient";
import data from "@/lib/navigator-data.json";
import { familyLanguages, familyRecord } from "@/lib/family-record.mjs";
import type { FamilyRecordItem } from "@/lib/family-record.mjs";
import { FamilyBringList } from "./workspace-family-bring-list";
import styles from "./workspace-patient-family.module.css";

type LanguageCode = "en" | "hi" | "ta" | "bn" | "mr";

function languageCode(language: string): LanguageCode {
  return Object.hasOwn(familyLanguages, language) ? language as LanguageCode : "en";
}

function visitDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(value + "T00:00:00Z");
  if (date.toISOString().slice(0, 10) !== value) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(date);
}

function familyHeader(patient: PatientData, language: LanguageCode, date: string): string {
  return data.text.header[language].replace("{date}", date).replace("{name}", patient.patientName);
}

function familyMessage(header: string, result: ReturnType<typeof familyRecord>,
  gates: Gate[]): string {
  const checks = result.items.map((item, index) => formatGate(item, gates[index]?.gate));
  return [header, "", result.message, ...(checks.length ? ["", ...checks] : [])].join("\n");
}

function formatGate(item: FamilyRecordItem, gateName?: string): string {
  const name = gateName ?? "Returned check";
  const rule = item.ruleId ? " · " + item.ruleId : "";
  const reason = item.reason ?? "Source reason unavailable.";
  return name + rule + " · " + prettyStatus(item.status)
    + " · Source reason (original language): " + reason;
}

function prettyStatus(status: string): string {
  if (status === "not_evaluated") return "Not evaluated";
  return status ? status[0].toUpperCase() + status.slice(1) : "Outcome unavailable";
}

export function FamilyChecklist({ patient, gates, language, setLanguage, preview = false }: {
  patient: PatientData; gates: Gate[]; language: string; setLanguage: (value: string) => void;
  preview?: boolean;
}): ReactNode {
  const date = patient.nextVisit ? visitDate(patient.nextVisit) : null;
  if (!date || !patient.nextVisit) return <div className={styles.limitation} role="status">
    Upcoming visit date unavailable. Returned checks remain available to the care team.
  </div>;
  const lang = languageCode(language);
  const result = familyRecord(gates);
  const header = familyHeader(patient, lang, date);
  const message = familyMessage(header, result, gates);
  return <div className={styles.family}>
    <h2 className={styles.title}>Family preparation</h2>
    <div className={styles.properties}>
      <p className={styles.visitDate}>Recorded visit: <time dateTime={patient.nextVisit}
        title={patient.nextVisit}>{date}</time></p>
      <LanguageSelect language={language} setLanguage={setLanguage} />
    </div>
    <p className={styles.languageNote}>
      Only the visit heading is translated. Check names and reasons retain their source
      language; reviewed translations are not available.
    </p>
    <div className={styles.columns}>
      <div><FamilyBringList patientId={patient.patientId} knownAsOf={patient.knownAsOf}
        preview={preview} />
        <FamilyGateList items={result.items} gates={gates} result={result} /></div>
      <FamilyMessage key={patient.patientId + ":" + message} message={message} />
    </div>
  </div>;
}

function LanguageSelect({ language, setLanguage }: {
  language: string; setLanguage: (value: string) => void;
}): ReactNode {
  return <label className={styles.languageLabel} htmlFor="family-language">
    Family&apos;s language
    <select id="family-language" value={language}
      onChange={(event) => setLanguage(event.target.value)}>
      {Object.entries(familyLanguages).map(([code, name]) =>
        <option key={code} value={code}>{name}</option>)}
    </select>
  </label>;
}

function FamilyGateList({ items, gates, result }: {
  items: FamilyRecordItem[]; gates: Gate[]; result: ReturnType<typeof familyRecord>;
}): ReactNode {
  if (!result.available) return <div className={styles.limitation} role="status">
    {result.message}
  </div>;
  return <section className={styles.checklist} aria-label="Readiness from returned checks">
    <h2>Returned readiness checks</h2>
    <ul>{items.map((item, index) => <FamilyGateRow key={item.ruleId ?? index}
      item={item} gate={gates[index]} />)}</ul>
    <p className={styles.summary}>{result.message}</p>
  </section>;
}

function FamilyGateRow({ item, gate }: { item: FamilyRecordItem; gate?: Gate }): ReactNode {
  return <li className={styles.checkItem}>
    <div className={styles.checkHeading}>
      {gate?.gate ?? "Returned check"} · {prettyStatus(item.status)}
    </div>
    <div className={styles.checkMeta}>
      {item.ruleId ?? "Rule ID unavailable"}
      {gate?.rule_version ? " v" + gate.rule_version : ""}
      {item.reason && <span> · Source reason (original language)</span>}
    </div>
    <p>{item.reason ?? "Source reason unavailable."}</p>
  </li>;
}

function FamilyMessage({ message }: { message: string }): ReactNode {
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | "">("");
  async function copyMessage(): Promise<void> {
    try {
      await navigator.clipboard.writeText(message);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }
  return <section className={styles.message} aria-labelledby="family-message-title">
    <h2 id="family-message-title">Message for the family</h2>
    <pre className={styles.messageText}>{message}</pre>
    <button type="button" className={styles.copyButton} onClick={() => void copyMessage()}>
      {copyStatus === "copied" ? "Copied" : "Copy message"}
    </button>
    <span aria-live="polite" className={copyStatus === "failed" ? styles.feedback : styles.srOnly}>
      {copyStatus === "copied" ? "Copied to clipboard. No message was sent."
        : copyStatus === "failed" ? "Copy unavailable. Select the message text to copy it." : ""}
    </span>
  </section>;
}
