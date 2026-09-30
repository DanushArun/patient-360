"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Field, Page, WorkspaceNav, buttonStyle } from "@/components/sa";
import type { Gate, PatientData, ReviewTask } from "@/lib/patient";

type State = "loading" | "ready" | "error";
const displayState = (state: string) => state.replaceAll("_", " ");

function TaskLifecycle({ task }: { task: ReviewTask }): ReactNode {
  return <article className="sa-history-item">
    <div className="sa-history-line"><span className="sa-history-dot" aria-hidden="true" /><span>Filed</span><span className="sa-history-rail" aria-hidden="true" /><span className={task.state === "acknowledged" || task.state === "resolved" ? "" : "sa-history-muted"}>Acknowledged</span><span className="sa-history-rail" aria-hidden="true" /><span className={task.state === "resolved" ? "" : "sa-history-muted"}>Resolved</span></div>
    <strong>{task.action.replaceAll("_", " ")}</strong>
    <p>{task.reason || "No reason was returned with this task."}</p>
    <div className="sa-meta">Owner {task.owner} · created <span className="sa-num">{task.createdAt}</span> · current state {displayState(task.state)}</div>
    <div className="sa-meta">Task <code>{task.taskId}</code></div>
  </article>;
}

export default function HistoryClient({ patient }: { patient: PatientData }): ReactNode {
  const initial = patient.gates.find((gate) => gate.outcome !== "pass")?.rule_id ?? patient.gates[0]?.rule_id ?? "";
  const [rule, setRule] = useState(initial);
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [state, setState] = useState<State>("loading");
  useEffect(() => {
    if (!rule) { setTasks([]); setState("ready"); return; }
    let live = true; setState("loading");
    fetch(`/api/patient/${encodeURIComponent(patient.patientId)}/review-tasks?ruleId=${encodeURIComponent(rule)}`, { cache: "no-store" })
      .then(async (res) => ({ res, body: await res.json() as { tasks?: ReviewTask[] } }))
      .then(({ res, body }) => { if (!res.ok || !body.tasks) throw new Error(); if (live) { setTasks(body.tasks); setState("ready"); } })
      .catch(() => { if (live) setState("error"); });
    return () => { live = false; };
  }, [patient.patientId, rule]);
  const selectedGate: Gate | undefined = patient.gates.find((gate) => gate.rule_id === rule);
  return <Page>
    <WorkspaceNav current="history" />
    <header className="sa-screen-header">
      <div><p className="sa-eyebrow">Coordinator workspace · patient history</p><h1>{patient.patientName}</h1>
        <p>Trace a readiness result through its review tasks. The record and task lifecycle remain separate from clinical decision-making.</p></div>
      <div className="sa-header-fields"><Field label="Patient" value={patient.patientId} /><Field label="Consent" value={patient.consentId ?? "None"} /><Field label="Known as of" value={patient.knownAsOf ?? "Not available"} /></div>
    </header>
    <div className="sa-history-layout">
      <section><label className="sa-field-label">Readiness check<select value={rule} onChange={(event) => setRule(event.target.value)}>
        {patient.gates.map((gate) => <option key={gate.rule_id} value={gate.rule_id}>{gate.rule_id} · {gate.outcome.replace("_", " ")}</option>)}</select></label>
        {selectedGate && <div className="sa-history-rule"><div><strong>{selectedGate.rule_id} v{selectedGate.rule_version}</strong><p>{selectedGate.reason ?? "No reason is available for this check."}</p></div><span className="sa-status-history">{selectedGate.outcome.replace("_", " ")}</span></div>}
        <div className="sa-history-section-head"><h2>Task lifecycle</h2><Link href={`/patient/${patient.patientId}`} style={{ ...buttonStyle, width: "auto", minHeight: 36, fontSize: 14 }}>Open patient record</Link></div>
        {state === "loading" && <div className="sa-loading-lines" role="status"><span /><span /><span /></div>}
        {state === "error" && <div className="sa-limitation">Task history could not be loaded. The readiness result is still shown above; retry from the patient record if needed.</div>}
        {state === "ready" && !tasks.length && <div className="sa-empty-state"><strong>No task has been filed for this check.</strong><span>Any future document request or escalation will appear here with its owner and state.</span></div>}
        {state === "ready" && tasks.map((task) => <TaskLifecycle key={task.taskId} task={task} />)}
      </section>
      <aside className="sa-history-aside"><h2>Audit scope</h2><p>The connected record can show filed task history for this rule. Version-chain and answer-history entries need their documented data services before they can be represented as facts.</p><p className="sa-meta">This avoids fabricating an audit trail from absent data.</p></aside>
    </div>
  </Page>;
}
