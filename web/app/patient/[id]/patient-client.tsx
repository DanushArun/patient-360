"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Columns, Field, Page, Rule, Stack, buttonStyle } from "@/components/sa";
import type { AgentTurn, Gate, PatientData } from "@/lib/patient";
import data from "@/lib/navigator-data.json";
import {
  EvidencePanel,
  GateCitation,
  GateStrip,
  type ReviewAction,
  type ReviewFeedback,
  type Turn,
} from "./patient-evidence";
import { PatientTimelinePanel } from "./patient-timeline";

type ChecklistKey = keyof typeof data.text;
const EMPTY: Turn[] = [];
const TURN_ERRORS: Record<string, string> = {
  tool_unavailable: "The record could not be read just now. Please try again.",
  malformed_tool_result: "The record returned a response this app could not read. Please try again.",
  classification_unavailable:
    "I couldn't safely route that question. Ask what is documented, missing, or conflicting in the record.",
  malformed_agent_json: "The assistant returned a response this app could not read. Nothing is asserted from it.",
  ai_features_unavailable:
    "Snowflake AI access is disabled for this trial account. " +
    "Readiness checks remain SQL-derived; no answer was generated.",
  agent_unreachable: "The assistant could not be reached. No answer is shown rather than a stale one.",
  nothing_found: "Nothing found for that question.",
};

function escapeText(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function formattedText(text: string): ReactNode[] {
  return text.split("\n").map((line, index) => {
    const safe = escapeText(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
    return <span key={index} dangerouslySetInnerHTML={{ __html: safe }} />;
  }).reduce<ReactNode[]>((out, node, index) => index ? [...out, <br key={`br-${index}`} />, node] : [node], []);
}

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

function langCode(language: string | null): string {
  const codes: Record<string, string> = { english: "en", hindi: "hi", tamil: "ta", bengali: "bn", marathi: "mr" };
  return codes[language?.trim().toLowerCase() ?? ""] ?? "en";
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

function PatientHeader({ patient }: { patient: PatientData }): ReactNode {
  return <><Columns template="7fr 5fr" gap={68}>
    <div className="sa-masthead" style={{ borderBottom: "none", marginBottom: 4 }}>
      <div className="sa-masthead-patient">{patient.patientName}</div>
      <Field label="Patient" value={patient.patientId} /><Field label="Consent" value={patient.consentId ?? "none"} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr 2fr", gap: 17, paddingTop: 4 }}>
      <Link href="/" className="sa-btn" style={buttonStyle} aria-label={`Select another patient; currently ${patient.patientName}`}>
        {patient.patientName}<span aria-hidden="true">⌄</span>
      </Link>
      <Link href={`/navigator/${patient.patientId}`} className="sa-btn" style={{ ...buttonStyle, fontSize: 14 }}>
        Navigator View
      </Link>
      <Field label="Practitioner" value={patient.practitionerName} />
    </div>
  </Columns>
    <div className="sa-visit-context">
      <Field label="Next day-care visit" value={patient.scheduledAt ?? "Not scheduled"} />
      <Field label="Regimen" value={patient.regimen ?? "Not recorded"} />
      <Field label="Cycle" value={patient.cycleNumber?.toString() ?? "Not recorded"} />
    </div>
  </>;
}

function FamilyChecklist({ patient, gates, language, setLanguage }: {
  patient: PatientData; gates: Gate[]; language: string; setLanguage: (value: string) => void;
}): ReactNode {
  const visit = patient.nextVisit ? new Date(`${patient.nextVisit}T00:00:00`) : null;
  const items = checklistItems(gates);
  const lang = (language in data.languages ? language : "en") as keyof typeof data.languages;
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | "">("");
  if (!visit) return <div className="sa-limitation">No upcoming day-care visit is on record for this patient, so there is no visit to prepare the family for.</div>;
  if (!gates.length) return <div className="sa-limitation">Readiness has not been computed for this patient yet.</div>;
  const earliest = visitDate(new Date(visit.getTime() - 7 * 86400000));
  const message = messageText(patient, visit, items, lang);
  async function copyMessage(): Promise<void> {
    try {
      await navigator.clipboard.writeText(message);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }
  return <>
    <label className="sa-field-label">Family&apos;s language <select value={language} onChange={(event) => {
      setCopyStatus("");
      setLanguage(event.target.value);
    }}>
      {Object.entries(data.languages).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </select></label>
    <div className="sa-field-label" style={{ margin: "8px 0 4px" }}>What the family needs to do before {visitDate(visit)}</div>
    {items.length ? items.map(({ key, rules }, index) => <div className="sa-check-item" key={key}>
      <span className="sa-check-n sa-num">{index + 1}</span><div><div className="sa-check-text">{data.text[key as ChecklistKey][lang].replace("{earliest}", earliest)}</div>
        <div className="sa-meta">from {rules.map((rule) => <code key={rule}>{rule} </code>)}</div></div></div>)
      : <div className="sa-meta">{data.text.all_clear[lang]}</div>}
    <div className="sa-field-label" style={{ margin: "16px 0 4px" }}>Message for the family</div>
    <pre className="sa-page-text" style={{ whiteSpace: "pre-wrap" }}>{message}</pre>
    <button type="button" style={{ ...buttonStyle, width: "auto" }} onClick={() => void copyMessage()}>
      {copyStatus === "copied" ? "Copied" : "Copy message"}
    </button>
    <span aria-live="polite" className={copyStatus === "failed" ? "sa-meta" : "sr-only"}>
      {copyStatus === "copied" ? "Message copied." : copyStatus === "failed" ? "Copy unavailable. Select the message text to copy it." : ""}
    </span>
    <div className="sa-meta">SAARTHI does not send messages. Copy this into WhatsApp or read it to the family. Translations are drafted for review: have a native-speaking navigator check them before first use.</div>
  </>;
}

function Conversation({ turns, selected, onSelect, busy, error, onSend }: {
  turns: Turn[]; selected: { turnId: string; ruleId: string } | null;
  onSelect: (turnId: string, ruleId: string) => void; busy: boolean; error: string;
  onSend: (text: string) => void;
}): ReactNode {
  const last = turns.at(-1)?.role === "assistant" ? turns.at(-1)! : null;
  return <div role="log" aria-label="Patient conversation" aria-live="polite" aria-busy={busy}>
    {!turns.length && <div className="sa-meta">Ask about this patient&apos;s record — what you have, what is missing, what contradicts what. Clinical decisions are referred to the treating practitioner.</div>}
    {turns.map((turn) => <Message key={turn.id} turn={turn} selected={selected} onSelect={onSelect} />)}
    {busy && <div className="sa-meta">Consulting the record…</div>}{error && <div className="sa-limitation">{error}</div>}
    {!!last?.suggested.length && <><div className="sa-field-label" style={{ marginTop: 12 }}>Follow on</div>
      {last.suggested.slice(0, 3).map((suggestion) => <button key={suggestion} style={buttonStyle} onClick={() => onSend(suggestion)}>{suggestion}</button>)}</>}
  </div>;
}

function Message({ turn, selected, onSelect }: {
  turn: Turn; selected: { turnId: string; ruleId: string } | null;
  onSelect: (turnId: string, ruleId: string) => void;
}): ReactNode {
  const icon = turn.role === "user" ? "face" : "smart_toy";
  return <div className={turn.role === "assistant" ? "sa-turn-assistant" : undefined}>
    <div className="flex items-start gap-3"><span className="sa-chat-avatar" aria-hidden="true">{icon}</span>
      <div style={{ flex: 1 }}>{turn.role === "user" ? <div>{formattedText(turn.text)}</div> : turn.error ? <div className="sa-limitation">{TURN_ERRORS[turn.error] ?? turn.error}</div> : <>
        <div>{formattedText(turn.text)}</div>{turn.known_as_of && <div className="sa-meta sa-num" style={{ marginTop: 8 }}>Known as of {turn.known_as_of}</div>}
        {!!turn.gates.length && <div className="sa-chat-gates" style={{ marginTop: 12 }}>{turn.gates.map((gate) => {
          const ruleId = gate.rule_id ?? gate.gate;
          return <GateCitation key={ruleId} gate={gate} selected={selected?.turnId === turn.id && selected.ruleId === ruleId} onSelect={() => onSelect(turn.id, ruleId)} />;
        })}</div>}
      </>}</div></div>
    <hr style={{ border: 0, borderTop: "1px solid #D8DCDF", margin: "16px 0" }} />
  </div>;
}

function ChatInput({ question, setQuestion, busy, onSend }: {
  question: string; setQuestion: (value: string) => void; busy: boolean; onSend: () => void;
}): ReactNode {
  return <form onSubmit={(event) => { event.preventDefault(); onSend(); }} className="sa-chat-dock-wrap">
    <div className="sa-chat-dock">
      <input className="sa-chat-input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about this patient's record…" disabled={busy} />
      <button className="sa-chat-send" type="submit" aria-label="Send" disabled={busy}>➤</button>
    </div>
  </form>;
}

function useStoredTurns(storageKey: string): readonly [Turn[], Dispatch<SetStateAction<Turn[]>>] {
  const [turns, setTurns] = useState<Turn[]>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try { setTurns(JSON.parse(sessionStorage.getItem(storageKey) ?? "[]") as Turn[]); }
    catch { setTurns([]); }
    setHydrated(true);
  }, [storageKey]);
  useEffect(() => { if (hydrated) sessionStorage.setItem(storageKey, JSON.stringify(turns)); }, [hydrated, storageKey, turns]);
  return [turns, setTurns] as const;
}

function appendTurn(storageKey: string, setTurns: Dispatch<SetStateAction<Turn[]>>, turn: Turn): void {
  setTurns((current) => [...current, turn]);
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]") as Turn[];
    sessionStorage.setItem(storageKey, JSON.stringify([...saved, turn]));
  } catch {
    sessionStorage.setItem(storageKey, JSON.stringify([turn]));
  }
}

function useChat(storageKey: string, patientId: string, setTurns: Dispatch<SetStateAction<Turn[]>>): {
  question: string; setQuestion: Dispatch<SetStateAction<string>>; busy: boolean;
  error: string; send: (text: string) => Promise<void>;
} {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(text: string): Promise<void> {
    if (!text.trim() || busy) return;
    const user: Turn = { id: crypto.randomUUID(), role: "user", text, thinking: "", tools: [], suggested: [], gates: [], known_as_of: null, error: null };
    appendTurn(storageKey, setTurns, user); setQuestion(""); setBusy(true); setError("");
    try {
      const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, question: text }) });
      const result = await response.json() as AgentTurn & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "agent_unreachable");
      appendTurn(storageKey, setTurns, { ...result, id: crypto.randomUUID(), role: "assistant" });
    } catch (e) {
      const code = e instanceof Error ? e.message : "agent_unreachable";
      const errTurn: Turn = { id: crypto.randomUUID(), role: "assistant", text: "", thinking: "", tools: [], suggested: [], gates: [], known_as_of: null, error: code };
      appendTurn(storageKey, setTurns, errTurn);
    } finally { setBusy(false); }
  }
  return { question, setQuestion, busy, error, send };
}

const REVIEW_ERRORS: Record<string, string> = {
  no_patient_access: "Your role or current consent does not permit this action.",
  access_withdrawn: "Patient access was withdrawn. Return to the patient list.",
  gate_not_found: "This check is no longer current. Refresh readiness before retrying.",
  gate_not_actionable: "This check is no longer actionable. Refresh readiness.",
  action_unavailable: "The review service is unavailable. Please retry.",
};

function useReviewTask(patientId: string): {
  feedback: Record<string, ReviewFeedback>;
  act: (gate: Gate, action: ReviewAction) => Promise<void>;
} {
  const [feedback, setFeedback] = useState<Record<string, ReviewFeedback>>({});
  const inFlight = useRef(new Set<string>());
  const update = (ruleId: string, state: ReviewFeedback): void => {
    setFeedback((current) => ({ ...current, [`${ruleId}:${state.action}`]: state }));
  };
  async function act(gate: Gate, action: ReviewAction): Promise<void> {
    const ruleId = gate.rule_id;
    if (!ruleId || inFlight.current.has(ruleId)) return;
    inFlight.current.add(ruleId);
    update(ruleId, { action, status: "pending" });
    try {
      const response = await fetch("/api/review-task", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, ruleId, action }),
      });
      const body = await response.json() as {
        task_id?: string; idempotent_replay?: boolean; error?: string;
      };
      if (body.error || !response.ok || !body.task_id) {
        const code = body.error ?? "action_unavailable";
        update(ruleId, { action, status: "error", error: REVIEW_ERRORS[code] ?? code });
        return;
      }
      update(ruleId, { action, status: "success", taskId: body.task_id,
        replay: body.idempotent_replay });
    } catch {
      update(ruleId, { action, status: "error", error: REVIEW_ERRORS.action_unavailable });
    } finally {
      inFlight.current.delete(ruleId);
    }
  }
  return { feedback, act };
}

async function fetchCurrentPatient(patientId: string): Promise<PatientData> {
  const response = await fetch(`/api/patient/${encodeURIComponent(patientId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("readiness_refresh_failed");
  return response.json() as Promise<PatientData>;
}

export default function PatientClient({ patient }: { patient: PatientData }): ReactNode {
  const params = useParams<{ id: string }>();
  const [currentPatient, setCurrentPatient] = useState(patient);
  const [refreshState, setRefreshState] = useState<"refreshing" | "current" | "failed">("refreshing");
  const [turns, setTurns] = useStoredTurns(`saarthi-turns:${params.id}`);
  const [selected, setSelected] = useState<{ turnId: string; ruleId: string } | null>(null);
  const [selectedPatientRule, setSelectedPatientRule] = useState<string | null>(null);
  const [mode, setMode] = useState<PatientMode>("Ask the record");
  const [language, setLanguage] = useState(langCode(patient.language));
  const refreshReadiness = useCallback(async (): Promise<void> => {
    setRefreshState("refreshing");
    try {
      setCurrentPatient(await fetchCurrentPatient(patient.patientId));
      setRefreshState("current");
    } catch {
      setRefreshState("failed");
    }
  }, [patient.patientId]);
  useEffect(() => { void refreshReadiness(); }, [refreshReadiness]);
  const chat = useChat(`saarthi-turns:${params.id}`, patient.patientId, setTurns);
  const reviewTask = useReviewTask(patient.patientId);
  const last = turns.at(-1)?.role === "assistant" ? turns.at(-1)! : null;
  const selectedGate = currentPatient.gates.find((gate) => gate.rule_id === selectedPatientRule)
    ?? (selected ? turns.find((turn) => turn.id === selected.turnId)?.gates.find(
      (gate) => (gate.rule_id ?? gate.gate) === selected.ruleId
    ) ?? null : null);

  return <Page>
    <PatientHeader patient={currentPatient} />
    {refreshState !== "current" && <div className="sa-meta" role="status" style={{ margin: "8px 0" }}>
      {refreshState === "refreshing"
        ? `Checking live readiness. Displaying the stored SQL snapshot${currentPatient.knownAsOf ? ` from ${currentPatient.knownAsOf}` : ""}.`
        : `Live readiness refresh failed. The stored SQL snapshot${currentPatient.knownAsOf ? ` from ${currentPatient.knownAsOf}` : ""} remains visible.`}
      {refreshState === "failed" && <button type="button" className="ml-2 underline"
        onClick={() => void refreshReadiness()}>Retry current check</button>}
    </div>}
    {currentPatient.gates.length ? <GateStrip gates={currentPatient.gates} knownAsOf={currentPatient.knownAsOf}
      isSnapshot={refreshState !== "current"}
      selectedRuleId={selectedPatientRule} onSelect={(ruleId) => {
        setSelected(null);
        setSelectedPatientRule((current) => current === ruleId ? null : ruleId);
      }} /> : <div className="sa-limitation" role="status">
      No readiness snapshot is available for the next day-care visit yet. Do not infer a check result from missing data.
    </div>}
    <Rule />
    <Columns template="7fr 5fr" gap={68} className="sa-patient-columns">
      <Stack style={{ paddingBottom: 100 }}>
        <ModeControl mode={mode} onChange={setMode} />
        {mode === "Family checklist"
          ? <FamilyChecklist patient={currentPatient} gates={currentPatient.gates} language={language} setLanguage={setLanguage} />
          : mode === "Record timeline" ? <PatientTimelinePanel patientId={patient.patientId} />
          : <Conversation turns={turns} selected={selected} onSelect={(turnId, ruleId) => {
            setSelectedPatientRule(null);
            setSelected((value) => value?.turnId === turnId && value.ruleId === ruleId
              ? null : { turnId, ruleId });
          }} busy={chat.busy} error={chat.error} onSend={(text) => void chat.send(text)} />}
      </Stack>
      <div id="readiness-evidence" className="sa-patient-evidence-sticky"><EvidencePanel patientId={patient.patientId}
        turn={last} selected={selectedGate}
        feedback={reviewTask.feedback} actionsAvailable={refreshState === "current"}
        onAction={reviewTask.act} onUnpin={() => {
        setSelected(null);
        setSelectedPatientRule(null);
      }} /></div>
    </Columns>
    {mode === "Ask the record" && <ChatInput question={chat.question} setQuestion={chat.setQuestion} busy={chat.busy} onSend={() => void chat.send(chat.question)} />}
  </Page>;
}

type PatientMode = "Ask the record" | "Record timeline" | "Family checklist";

function ModeControl({ mode, onChange }: {
  mode: PatientMode; onChange: (mode: PatientMode) => void;
}): ReactNode {
  return <div className="flex" style={{ border: "1px solid #D8DCDF", borderRadius: 6, width: "fit-content" }}>
    {(["Ask the record", "Record timeline", "Family checklist"] as const).map((item) => <button key={item} onClick={() => onChange(item)}
      className={`sa-mode-btn${mode === item ? " sa-mode-active" : ""}`}
      style={{ ...buttonStyle, width: "auto", border: 0, borderRadius: 0 }}>{item}</button>)}
  </div>;
}
