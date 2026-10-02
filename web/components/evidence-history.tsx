"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { announcePatientAccessWithdrawn, purgesPatientState } from "@/lib/workspace-state.mjs";

type Audit = {
  RUN_ID: string; QUESTION_CLASS: string; ANSWER_STATUS: string;
  CREATED_AT: string; KNOWN_AS_OF: string; EVIDENCE_IDS: string[];
};
type Packet = {
  PACKET_ID: string; PRACTITIONER_NAME: string; DELIVERED_AT: string | null;
  GATE_SNAPSHOT: { known_as_of?: string;
    gates?: { rule_id: string; outcome: string; reason: string }[] };
};
type HistoryRecords = { answers: Audit[]; packets: Packet[] };
type HistoryLoad = { key: string; records: HistoryRecords | null; failed: boolean };

export function EvidenceHistory({ patientId }: { patientId: string }): ReactNode {
  const { records, failed, retry } = useHistoryRecords(patientId);
  return <section aria-label="Answer and referral history">
    <h2>Answer history</h2>
    {failed ? <div role="alert"><p>Answer history could not be loaded.</p>
      <button type="button" className="sa-quiet-button" onClick={retry}>
        Retry answer history
      </button>
    </div> : !records ? <p role="status">Loading saved evidence history…</p>
      : <SavedHistory records={records} />}
  </section>;
}

function useHistoryRecords(patientId: string): {
  records: HistoryRecords | null; failed: boolean; retry: () => void;
} {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([patientId, attempt]);
  const [load, setLoad] = useState<HistoryLoad>({ key: "", records: null, failed: false });
  useEffect(() => {
    const controller = new AbortController();
    setLoad({ key, records: null, failed: false });
    void readHistory(patientId, controller.signal).then((records) => {
      if (!controller.signal.aborted) setLoad({ key, records, failed: false });
    }).catch(() => {
      if (!controller.signal.aborted) setLoad({ key, records: null, failed: true });
    });
    return () => controller.abort();
  }, [patientId, key]);
  return { ...(load.key === key ? load : { records: null, failed: false }),
    retry: () => setAttempt((value) => value + 1) };
}

async function readHistory(patientId: string, signal: AbortSignal): Promise<HistoryRecords | null> {
  const response = await fetch(`/api/patient/${encodeURIComponent(patientId)}/evidence`, {
    cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  });
  const body = await response.json() as Partial<HistoryRecords>;
  if (signal.aborted) return null;
  if (purgesPatientState(body)) {
    announcePatientAccessWithdrawn(patientId);
    return null;
  }
  if (!response.ok || !Array.isArray(body.answers) || !Array.isArray(body.packets)) {
    throw new Error("evidence_history_unavailable");
  }
  return { answers: body.answers, packets: body.packets };
}

function SavedHistory({ records }: { records: HistoryRecords }): ReactNode {
  return <>
    {!records.answers.length && <p>No answers recorded yet.</p>}
    {records.answers.map((answer) => <AnswerHistoryRow key={answer.RUN_ID} answer={answer} />)}
    <p className="sa-meta">History retains access and source pointers,
      not a stored copy of the answer text.</p>
    <h2>Practitioner evidence packets</h2>
    {!records.packets.length && <p>No packets prepared yet.</p>}
    {records.packets.map((packet) => <PacketHistoryRow key={packet.PACKET_ID} packet={packet} />)}
  </>;
}

function AnswerHistoryRow({ answer }: { answer: Audit }): ReactNode {
  return <details><summary>
    <time dateTime={answer.CREATED_AT}>{answer.CREATED_AT || "Time unavailable"}</time>
    {` · Class ${answer.QUESTION_CLASS || "unavailable"}`}
    {` · ${answer.ANSWER_STATUS || "status unavailable"}`}
  </summary>
    <p className="sa-meta">Known as of {answer.KNOWN_AS_OF || "Not recorded"} · {answer.RUN_ID}</p>
    <p>{answer.EVIDENCE_IDS?.length ? answer.EVIDENCE_IDS.map((id) => <code key={id}>
      {id}{" "}
    </code>) : "No source pointers recorded."}</p>
  </details>;
}

function PacketHistoryRow({ packet }: { packet: Packet }): ReactNode {
  return <details><summary>
    For {packet.PRACTITIONER_NAME || "treating practitioner unavailable"} ·{" "}
    {packet.DELIVERED_AT ? "Delivery recorded" : "Prepared · not delivered"}
  </summary>
    <p className="sa-meta"><code>{packet.PACKET_ID}</code> · known as of{" "}
      {packet.GATE_SNAPSHOT?.known_as_of || "Not recorded"}</p>
    {packet.DELIVERED_AT && <p className="sa-meta">Delivered{" "}
      <time dateTime={packet.DELIVERED_AT}>{packet.DELIVERED_AT}</time></p>}
    {packet.GATE_SNAPSHOT?.gates?.map((gate) => <p key={gate.rule_id}>
      <strong>{gate.rule_id} · {gate.outcome}</strong><br />{gate.reason}
    </p>)}
  </details>;
}

type PreparePacketProps = { patientId: string; question: string; practitionerName: string };
type PacketState = "idle" | "saving" | "prepared" | "recipient_mismatch" | "error";
type PacketReceipt = { practitioner_name?: unknown; read_back_confirmed?: boolean; error?: string };

export function PreparePacket(props: PreparePacketProps): ReactNode {
  return <PreparePacketRequest
    key={JSON.stringify([props.patientId, props.question])} {...props} />;
}

function PreparePacketRequest({ patientId, question, practitionerName }: PreparePacketProps)
  : ReactNode {
  const [id] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<PacketState>("idle");
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  async function prepare(): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setState("saving");
    try{
      const actualName = await recordPacket(patientId, question, id);
      const matches = namedPractitioner(actualName) === namedPractitioner(practitionerName);
      setState(matches ? "prepared" : "recipient_mismatch");
      setMessage(packetMessage(actualName, practitionerName, matches));
    }catch(error){
      setState("error");
      setMessage(packetErrorMessage(error));
    } finally {
      inFlight.current = false;
    }
  }
  return <PacketControl name={practitionerName} state={state} message={message}
    onPrepare={() => void prepare()} />;
}

async function recordPacket(patientId: string, question: string, packetId: string)
  : Promise<string> {
  const response = await fetch(`/api/patient/${encodeURIComponent(patientId)}/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, packetId }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json() as PacketReceipt;
  if (purgesPatientState(body)) {
    announcePatientAccessWithdrawn(patientId);
    throw new Error("packet_access_withdrawn");
  }
  if (!response.ok || body.error) throw new Error("packet_write_unavailable");
  if (body.read_back_confirmed !== true) throw new Error("packet_receipt_unconfirmed");
  if (typeof body.practitioner_name !== "string" || !body.practitioner_name.trim()) {
    throw new Error("packet_recipient_unconfirmed");
  }
  return body.practitioner_name.trim();
}

function packetMessage(actual: string, expected: string, matches: boolean): string {
  return matches ? `Prepared for ${actual}. Open Review history to inspect it.`
    : `Prepared for ${actual}, but this referral names ${expected}. `
      + "Check Review history to confirm the recipient.";
}

function packetErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "packet_access_withdrawn") {
    return "Patient access is no longer available.";
  }
  if (error instanceof Error && ["packet_receipt_unconfirmed", "packet_recipient_unconfirmed"]
    .includes(error.message)) {
    return "Packet status or recipient could not be confirmed. Retry uses the same request; "
      + "check Review history first.";
  }
  return "Packet receipt unavailable. Retry uses the same request; check Review history first.";
}

function PacketControl({ name, state, message, onPrepare }: {
  name: string; state: PacketState; message: string; onPrepare: () => void;
}): ReactNode {
  const recipient = name.trim();
  const unavailable = !recipient;
  const locked = state === "saving" || state === "prepared" || state === "recipient_mismatch";
  return <div className="sa-meta" aria-busy={state === "saving"}>
    <p>For treating practitioner: {recipient || "Name unavailable"}</p>
    {unavailable && <p role="alert">
      A named treating practitioner is required before preparing a packet.
    </p>}
    {state === "recipient_mismatch" && <p role="alert">{message}</p>}
    <button type="button" className="sa-quiet-button"
      aria-label={`Prepare evidence packet for ${recipient || "unavailable practitioner"}`}
      disabled={locked || unavailable} onClick={onPrepare}>
      {state === "saving" ? "Preparing…" : state === "prepared" ? "Packet prepared"
        : state === "recipient_mismatch" ? "Recipient needs review"
          : `Prepare evidence for ${recipient || "treating practitioner"}`}
    </button>
    {state !== "recipient_mismatch" && <p role="status" aria-live="polite">{message}</p>}
  </div>;
}

function namedPractitioner(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
