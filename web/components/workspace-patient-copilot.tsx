"use client";

import { Clock } from "@/components/ui/clock";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { ArrowUp } from "lucide-react";
import { ClinicalReferral } from "./clinical-referral";
import type { AgentTurn, PatientData } from "@/lib/patient";
import {
  announcePatientAccessWithdrawn,
  isLatestPatientResponse,
  PATIENT_ACCESS_EVENT,
  purgesPatientState,
} from "@/lib/workspace-state.mjs";
import {
  clearPatientTurns,
  invalidateChatRequest,
  updateChatContext,
} from "@/lib/chat-lifecycle.mjs";
import { readStoredTurns, writeStoredTurns } from "@/lib/chat-storage.mjs";
import type { ContextReference } from "@/lib/api-contracts.mjs";
import { PatientAnswerArtifact } from "@/app/patient/[id]/patient-answer-artifact";
import { GateCitation, type Turn } from "@/app/patient/[id]/patient-evidence";
import { RecordAnswerCard } from "@/components/copilot/record-answer-card";
import { AnswerTrace } from "@/components/copilot/copilot-parts";

// Errors a retry can never fix: the Retry button is withheld for these.
const NON_RETRYABLE_ERRORS = new Set(["reference_scope_unavailable"]);

const TURN_ERRORS: Record<string, string> = {
  reference_scope_unavailable:
    "Reference corpus search is not available. Switch Search in to Patient record.",
  workspace_data_unavailable: "Workspace data could not be read just now. Please try again.",
  record_service_unavailable: "The record service could not be reached. Please try again.",
  service_unavailable: "The service could not be reached. Please try again.",
  invalid_argument: "That question could not be processed. Rephrase it and try again.",
  question_too_long: "That question is too long. Shorten it and try again.",
  no_patient_access: "Patient access is no longer available. Return to the authorized worklist.",
  access_withdrawn: "Patient access is no longer available. Return to the authorized worklist.",
  tool_unavailable: "The record could not be read just now. Please try again.",
  malformed_tool_result:
    "The record returned a response this app could not read. Please try again.",
  classification_unavailable: "I couldn't safely route that question. "
    + "Ask what is documented, missing, or conflicting in the record.",
  malformed_agent_json:
    "The assistant returned a response this app could not read. Nothing is asserted from it.",
  ai_features_unavailable:
    "Snowflake AI access is disabled for this trial account. No answer was generated.",
  agent_unreachable:
    "The assistant could not be reached. No answer is shown rather than a stale one.",
  nothing_found: "Nothing found for that question.",
  cancelled: "Stopped. No answer was shown for this question.",
};

function escapeText(text: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => entities[char]!);
}

function formattedText(text: string): ReactNode[] {
  return text.split("\n").map((line, index) => {
    const safe = escapeText(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
    return <span key={index} dangerouslySetInnerHTML={{ __html: safe }} />;
  }).reduce<ReactNode[]>((out, node, index) => index
    ? [...out, <br key={`br-${index}`} />, node] : [node], []);
}

export function useStoredTurns(
  storageKey: string,
): readonly [Turn[], Dispatch<SetStateAction<Turn[]>>] {
  const [stored, setStored] = useState<{ key: string; turns: Turn[] }>(
    { key: storageKey, turns: [] },
  );
  const turns = stored.key === storageKey ? stored.turns : [];
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const parsed = readTurnsSafely(storageKey);
    setStored({ key: storageKey, turns: parsed });
    setHydrated(true);
  }, [storageKey]);
  useEffect(() => {
    if (hydrated && stored.key === storageKey) {
      writeTurnsSafely(storageKey, turns);
    }
  }, [hydrated, storageKey, stored.key, turns]);
  const updateTurns = useCallback<Dispatch<SetStateAction<Turn[]>>>((action) => {
    setStored((current) => {
      const currentTurns = current.key === storageKey ? current.turns : [];
      return {
        key: storageKey,
        turns: typeof action === "function" ? action(currentTurns) : action,
      };
    });
  }, [storageKey]);
  return [turns, updateTurns] as const;
}

function appendTurn(
  setTurns: Dispatch<SetStateAction<Turn[]>>,
  turn: Turn,
): void {
  setTurns((current) => [...current, turn]);
}

function readTurnsSafely(storageKey: string): Turn[] {
  try {
    const result = readStoredTurns(sessionStorage, storageKey);
    if (result.error) console.error("Could not read stored patient conversation.", result.error);
    return result.turns as Turn[];
  } catch (error) {
    console.error("Could not access stored patient conversation.", error);
    return [];
  }
}

function writeTurnsSafely(storageKey: string, turns: Turn[]): void {
  try {
    const result = writeStoredTurns(sessionStorage, storageKey, turns);
    if (result.error) console.error("Could not save patient conversation.", result.error);
  } catch (error) {
    console.error("Could not access patient conversation storage.", error);
  }
}

type AskResult = AgentTurn & { error?: string; purge_patient_state?: boolean };

async function askRecord(
  patientId: string,
  question: string,
  sourceScope: SourceScope,
  signal: AbortSignal,
  context: ContextReference[] = [],
  onPhase: (phase: AskPhase) => void = () => {},
) {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/x-ndjson, application/json" },
    body: JSON.stringify({ patientId, question, sourceScope,
      ...(context.length ? { context } : {}) }),
    // The native model, scoped retrieval and validation share one request.
    // Leave time for the server's 120-second SQL bound plus session setup;
    // the operator's Stop button still aborts immediately.
    signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]),
  });
  if (!response.headers.get("content-type")?.includes("application/x-ndjson") || !response.body) {
    return { response, result: await response.json() as AskResult };
  }
  // Streamed: phase lines as the server performs each gateway step, then one result line.
  const result = await readAskStream(response.body, onPhase);
  const failed = "status" in result && typeof result.status === "number";
  return { response: { ok: !failed } as Pick<Response, "ok">, result };
}

async function readAskStream(body: ReadableStream<Uint8Array>,
  onPhase: (phase: AskPhase) => void): Promise<AskResult & { status?: number }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += value ? decoder.decode(value, { stream: !done }) : "";
    const lines = buffer.split("\n");
    buffer = done ? "" : lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) {
      const event = JSON.parse(line) as { phase?: AskPhase; result?: AskResult;
        error?: string; status?: number; purge_patient_state?: boolean };
      if (event.phase) onPhase(event.phase);
      else if (event.result) return event.result;
      else if (event.error) return event as AskResult & { status?: number };
    }
    if (done) throw new Error("malformed_tool_result");
  }
}

export type SourceScope = "patient" | "reference";
export type AskPhase = "access" | "routing" | "refusing" | "reading" | "references"
  | "validating" | "saving";

export function usePatientChat(
  storageKey: string,
  patientId: string,
  setTurns: Dispatch<SetStateAction<Turn[]>>,
) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [phases, setPhases] = useState<AskPhase[]>([]);
  const runtime = useChatSafety({ patientId, storageKey, setTurns, setQuestion, setBusy });
  runtime.onPhase = (phase) => {
    runtime.trace.current.phases.push(phase);
    setPhases((current) => [...current, phase]);
  };
  const send = (text: string, scope: SourceScope = "patient", retry = false,
    context: ContextReference[] = []) => {
    if (!busy) setPhases([]);
    return sendPatientQuestion({ text, scope, retry, busy, runtime, context });
  };
  const retry = (scope: SourceScope) => {
    const text = runtime.lastQuestions.current[scope] || storedQuestion(storageKey);
    if (text) void send(text, scope, true);
  };
  const stop = () => {
    const running = Boolean(runtime.activeRequest.current);
    invalidateChatRequest({ activeRequest: runtime.activeRequest, sequence: runtime.sequence });
    setBusy(false);
    // A stopped question still gets an outcome in the thread, never a dangling bubble.
    if (running) appendTurn(setTurns, errorTurn(new Error("cancelled")));
  };
  return { question, setQuestion, busy, send, retry, stop, phases };
}

type ChatRuntime = {
  patientId: string;
  storageKey: string;
  setTurns: Dispatch<SetStateAction<Turn[]>>;
  setQuestion: (value: string) => void;
  setBusy: (value: boolean) => void;
  sequence: React.MutableRefObject<number>;
  activePatient: React.MutableRefObject<string>;
  activeRequest: React.MutableRefObject<AbortController | null>;
  lastQuestions: React.MutableRefObject<Record<SourceScope, string>>;
  /** The phases this request actually reported, and when it started: the answer keeps them
   * so a clinician can see what produced it after the fact, not only while it runs. */
  trace: React.MutableRefObject<{ phases: AskPhase[]; startedAt: number }>;
  onPhase?: (phase: AskPhase) => void;
};
type ChatSubmission = {
  text: string; scope: SourceScope; retry: boolean; busy: boolean; runtime: ChatRuntime;
  context?: ContextReference[];
};

function useChatSafety({ patientId, storageKey, setTurns, setQuestion, setBusy }: Pick<
  ChatRuntime, 'patientId' | 'storageKey' | 'setTurns' | 'setQuestion' | 'setBusy'
>): ChatRuntime {
  const sequence = useRef(0);
  const activePatient = useRef(patientId);
  const activeStorageKey = useRef(storageKey);
  const activeRequest = useRef<AbortController | null>(null);
  const lastQuestions = useRef<Record<SourceScope, string>>({ patient: "", reference: "" });
  const trace = useRef<{ phases: AskPhase[]; startedAt: number }>({ phases: [], startedAt: 0 });
  const runtime: ChatRuntime = {
    patientId, storageKey, setTurns, setQuestion, setBusy, sequence, activePatient,
    activeRequest, lastQuestions, trace,
  };
  useEffect(() => {
    const withdraw = (event: Event) => onPatientWithdrawal(event, runtime);
    window.addEventListener(PATIENT_ACCESS_EVENT, withdraw);
    return () => window.removeEventListener(PATIENT_ACCESS_EVENT, withdraw);
  }, [patientId, storageKey, setTurns, setQuestion, setBusy]);
  useLayoutEffect(() => {
    const changed = updateChatContext({
      patientId,
      storageKey,
      activePatient,
      activeStorageKey,
      activeRequest,
      sequence,
      lastQuestions,
    });
    if (!changed) return;
    setQuestion("");
    setBusy(false);
  }, [patientId, storageKey, setBusy, setQuestion]);
  useLayoutEffect(() => () => invalidateChatRequest({ activeRequest, sequence }), []);
  return runtime;
}

function onPatientWithdrawal(event: Event, runtime: ChatRuntime): void {
  const detail = (event as CustomEvent<{ patientId?: string }>).detail;
  if (detail?.patientId !== runtime.patientId) return;
  invalidateChatRequest({
    activeRequest: runtime.activeRequest,
    sequence: runtime.sequence,
  });
  runtime.lastQuestions.current = { patient: "", reference: "" };
  runtime.setQuestion("");
  runtime.setBusy(false);
  runtime.setTurns([]);
  clearTurnsSafely(runtime.patientId);
}

async function sendPatientQuestion({
  text,
  scope,
  retry,
  busy,
  runtime,
  context = [],
}: ChatSubmission): Promise<void> {
  if (!text.trim() || busy || runtime.activeRequest.current) return;
  const version = ++runtime.sequence.current;
  runtime.trace.current = { phases: [], startedAt: Date.now() };
  if (!retry) appendQuestion(text, scope, runtime);
  runtime.setQuestion("");
  runtime.setBusy(true);
  const controller = new AbortController();
  runtime.activeRequest.current = controller;
  await completePatientQuestion({ text, scope, version, controller, runtime, context });
}

function appendQuestion(text: string, scope: SourceScope, runtime: ChatRuntime): void {
  runtime.lastQuestions.current[scope] = text;
  appendTurn(runtime.setTurns, userTurn(text));
}

async function completePatientQuestion(request: {
  text: string; scope: SourceScope; version: number; controller: AbortController;
  runtime: ChatRuntime; context: ContextReference[];
}): Promise<void> {
  const { text, scope, version, controller, runtime, context } = request;
  try {
    const { response, result } = await askRecord(runtime.patientId, text, scope,
      controller.signal, context, (phase) => {
        if (version === runtime.sequence.current) runtime.onPhase?.(phase);
      });
    if (purgesPatientState(result)) {
      clearTurnsSafely(runtime.patientId);
      announcePatientAccessWithdrawn(runtime.patientId);
      return;
    }
    if (!isLatestPatientResponse(runtime.patientId, runtime.activePatient.current,
      version, runtime.sequence.current)) return;
    if (!response.ok) throw new Error(result.error ?? "agent_unreachable");
    appendTurn(runtime.setTurns, {
      ...result, id: crypto.randomUUID(), role: "assistant",
      trace: { phases: [...runtime.trace.current.phases],
        ms: Date.now() - runtime.trace.current.startedAt },
    });
  } catch (error) {
    if (isLatestPatientResponse(runtime.patientId, runtime.activePatient.current,
      version, runtime.sequence.current)) {
      appendTurn(runtime.setTurns, errorTurn(error));
    }
  } finally {
    if (runtime.activeRequest.current === controller) runtime.activeRequest.current = null;
    if (version === runtime.sequence.current) runtime.setBusy(false);
  }
}

function clearTurnsSafely(patientId: string): void {
  try {
    clearPatientTurns(sessionStorage, patientId);
  } catch (error) {
    console.error("Could not clear stored patient conversation.", error);
  }
}

function userTurn(text: string): Turn {
  return {
    id: crypto.randomUUID(), role: "user", text, thinking: "", tools: [],
    suggested: [], gates: [], known_as_of: null, error: null,
  };
}

function errorTurn(error: unknown): Turn {
  const code = error instanceof Error ? error.message : "agent_unreachable";
  return {
    id: crypto.randomUUID(), role: "assistant", text: "", thinking: "", tools: [],
    suggested: [], gates: [], known_as_of: null, error: code,
  };
}

function storedQuestion(storageKey: string): string {
  const turns = readTurnsSafely(storageKey);
  return [...turns].reverse().find((turn) => turn.role === "user")?.text ?? "";
}

export function PatientConversation({
  patientId, turns, selected, onSelect, busy, onSend, onRetry, sourceScope, patient,
  showEmptyHint = true, onOpenSection, activity,
}: {
  showEmptyHint?: boolean;
  /** Live copilot activity. `index` is the turn of the question it led to: the activity sits
   * directly under that question. Until the question exists it renders at the end. */
  activity?: { index: number; render: (anchored: boolean) => ReactNode };
  onOpenSection?: (section: string) => void;
  patientId: string;
  patient?: PatientData;
  turns: Turn[];
  sourceScope?: SourceScope;
  selected: { turnId: string; ruleId: string } | null;
  onSelect: (turnId: string, ruleId: string) => void;
  busy: boolean;
  onSend: (text: string) => void;
  onRetry: () => void;
}): ReactNode {
  const last = turns.at(-1)?.role === "assistant" ? turns.at(-1)! : null;
  const anchoredAt = activity && turns[activity.index]?.role === "user" ? activity.index : -1;
  return <div role="log" aria-label="Patient conversation" aria-live="polite" aria-busy={busy}
    className="sa-chat-log">
    {!turns.length && showEmptyHint && <div className="sa-meta">
      Ask what is recorded, missing, or conflicting. Clinical decisions are referred to the treating
      practitioner.
    </div>}
    {turns.map((turn, index) => <Fragment key={turn.id}>
      {turn.role === "user"
        ? <article className="sa-turn-user"><strong>You</strong>
          <div>{formattedText(turn.text)}</div></article>
        : <AssistantMessage turn={turn} patientId={patientId} patient={patient}
          sourceScope={sourceScope} selected={selected} onSelect={onSelect}
          onOpenSection={onOpenSection}
          question={turns[index - 1]?.role === "user" ? turns[index - 1].text : null} />}
      {index === anchoredAt && activity!.render(true)}
    </Fragment>)}
    {activity && anchoredAt < 0 && activity.render(false)}
    {!busy && last?.error && !NON_RETRYABLE_ERRORS.has(last.error) && <button type="button"
      className="sa-chat-retry" onClick={onRetry}>Retry last question</button>}
    {!busy && !!last?.suggested.length && <div className="sa-follow-ons"
      aria-label="Follow-on questions">
      {last.suggested.slice(0, 3).map((suggestion) => <button key={suggestion} type="button"
        onClick={() => onSend(suggestion)}>{suggestion}</button>)}
    </div>}
  </div>;
}

/** One assistant turn, in one block: the answer, its evidence and any referral together. */
function AssistantMessage({ turn, patientId, patient, sourceScope, selected, onSelect,
  onOpenSection, question }: {
  turn: Turn;
  patientId: string;
  patient?: PatientData;
  sourceScope?: SourceScope;
  selected: { turnId: string; ruleId: string } | null;
  onSelect: (turnId: string, ruleId: string) => void;
  onOpenSection?: (section: string) => void;
  question: string | null;
}): ReactNode {
  return <article className="sa-turn-assistant">
    <strong>Record assistant</strong>
    {!turn.error && <AnswerTrace trace={turn.trace} />}
    {turn.error
      ? <div className="sa-limitation">
        {TURN_ERRORS[turn.error] ?? "No answer is available for this request. Retry or rephrase."}
      </div>
      : turn.record ? <RecordAnswerCard record={turn.record} onOpenSection={onOpenSection}
        onShowEvidence={(ruleId) => onSelect(turn.id, ruleId)} />
      : <>
        {turn.artifact
          ? <PatientAnswerArtifact turn={turn} patientId={patientId} sourceScope={sourceScope} />
          : <p>No validated answer is available for this request.</p>}
        {/* The answer card carries its own clock; say it once. */}
        {turn.known_as_of && !turn.artifact
          && <div className="sa-meta">Known as of <Clock value={turn.known_as_of} /></div>}
        {!!turn.gates.length && <div className="sa-chat-gates">{turn.gates.map((gate) => {
          const ruleId = gate.rule_id ?? gate.gate;
          return <GateCitation key={ruleId} gate={gate}
            selected={selected?.turnId === turn.id && selected.ruleId === ruleId}
            onSelect={() => onSelect(turn.id, ruleId)} />;
        })}</div>}
        {turn.artifact?.classification === "CLASS_A" && question
          && <ClinicalReferral patientId={patientId} patient={patient} turn={turn}
            question={question} />}
      </>}
    {turn.history_saved === false && <p className="sa-meta" role="status">
      Answer history could not be saved.
    </p>}
  </article>;
}

export function PatientChatInput({ question, setQuestion, busy, onSend }: {
  question: string;
  setQuestion: (value: string) => void;
  busy: boolean;
  onSend: () => void;
}): ReactNode {
  return <form
    onSubmit={(event) => { event.preventDefault(); onSend(); }}
    className="sa-chat-dock-wrap">
    <div className="sa-chat-dock">
      <textarea aria-label="Question about the selected patient" rows={3} className="sa-chat-input"
        value={question} onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          if (!busy && question.trim()) onSend();
        }}
        placeholder="Ask about this record…" disabled={busy} />
      <button className="sa-chat-send" type="submit" aria-label="Send"
        disabled={busy || !question.trim()}>
        <ArrowUp size={18} />
      </button>
    </div>
  </form>;
}
