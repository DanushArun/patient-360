"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Check, ChevronDown, Circle, EyeOff, Mic, MessageSquare, Minus, Pause, Play, Square, Undo2, X,
} from "lucide-react";
import type { LiveRun, RunStep } from "@/lib/copilot-run.mjs";
import { stepMovesView } from "@/lib/copilot-intent.mjs";
import { elapsedLabel } from "./copilot-parts";
import { useOptionalCopilot } from "./copilot-provider";
import styles from "./copilot-live.module.css";

// The live copilot's surfaces: the floating dock (voice and status), the toolbar switch, and
// the activity receipt in the chat. One conversation, one composer: the dock never holds a
// thread of its own (docs/design/copilot-concepts-2026-10-06/README.md).

// ---------------------------------------------------------------- voice

type SpeechCtor = new () => SpeechRecognitionLike;
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  processLocally?: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onstart: (() => void) | null; onend: (() => void) | null;
  onspeechstart: (() => void) | null; onspeechend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>
    & { isFinal: boolean }> }) => void) | null;
};

function speechCtor(): (SpeechCtor & { available?: (options: object) => Promise<string> }) | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as Record<string, SpeechCtor | undefined>;
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const SPEECH_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in the browser, or type in the chat.",
  "service-not-allowed": "Voice input is not available in this browser. Type in the chat.",
  "no-speech": "Nothing was heard. Try again, or type in the chat.",
  "audio-capture": "No microphone was found. Type in the chat.",
  network: "The browser's speech service could not be reached. Type in the chat.",
  "language-not-supported": "Voice input does not support this language here. Type in the chat.",
};

// Pauses inside a sentence are often 1 s or more; 2 s of quiet means the person has finished.
const END_OF_SPEECH_MS = 2000;
const FIRST_WORD_MS = 8000;
const MAX_LISTEN_MS = 30000;

// Words this dashboard expects. Used to choose between the recogniser's alternatives
// ("treatment" over "three") and, where supported, to bias recognition itself.
const VOCABULARY = ["treatment", "patient", "record", "records", "medication", "medicine",
  "regimen", "chemotherapy", "chemo", "cycle", "visit", "blocked", "missing", "pending",
  "waiting", "ready", "documents", "report", "lab", "labs", "platelets", "platelet count",
  "neutrophils", "ANC", "haemoglobin", "creatinine", "bilirubin", "echo", "LVEF",
  "ejection fraction", "HER2", "pathology", "biopsy", "trastuzumab", "paclitaxel",
  "pre-authorisation", "pre-auth", "coverage", "insurance", "PM-JAY", "consent", "timeline",
  "conflicts", "evidence", "day care", "review queue", "summary", "open", "show"];

function vocabulary(): string[] {
  // Patient names on screen are part of the vocabulary too.
  const names = [...document.querySelectorAll("[data-copilot-ref^='patient:']")]
    .map((element) => element.getAttribute("data-copilot-label") ?? "").filter(Boolean);
  return [...new Set([...VOCABULARY, ...names])];
}

function bestAlternative(result: ArrayLike<{ transcript: string }>): string {
  const words = vocabulary().map((word) => word.toLowerCase());
  let best = result[0]?.transcript ?? "";
  let bestScore = -1;
  for (let index = 0; index < result.length; index += 1) {
    const text = result[index].transcript;
    const lower = ` ${text.toLowerCase()} `;
    // Recogniser order breaks ties: alternative 0 wins unless another names more known words.
    const score = words.reduce((sum, word) => sum + (lower.includes(` ${word} `) ? 1 : 0), 0);
    if (score > bestScore) { best = text; bestScore = score; }
  }
  return best.trim();
}

export function useSpeech(onFinal: (text: string) => void) {
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [onDevice, setOnDevice] = useState(false);
  useEffect(() => { setSupported(Boolean(speechCtor())); }, []);
  useEffect(() => () => recognition.current?.abort(), []);

  const start = useCallback(async () => {
    const Ctor = speechCtor();
    if (!Ctor) return;
    recognition.current?.abort();
    const rec = new Ctor();
    // Indian English hears Indian accents and patient names far better than the en-US default.
    rec.lang = "en-IN";
    rec.interimResults = true;
    // Keep listening through pauses; a silence timer below decides when the person has finished.
    rec.continuous = true;
    rec.maxAlternatives = 5;
    // Contextual biasing where the browser supports it (Chrome's SpeechRecognitionPhrase).
    try {
      const Phrase = (window as unknown as { SpeechRecognitionPhrase?: new (p: string, b: number) => unknown })
        .SpeechRecognitionPhrase;
      if (Phrase && "phrases" in rec) {
        (rec as unknown as { phrases: unknown[] }).phrases = vocabulary().map((phrase) =>
          new Phrase(phrase, 5));
      }
    } catch { /* biasing is optional */ }
    // Prefer on-device recognition where the browser offers it, so speech stays on this machine.
    let local = false;
    try {
      if ("processLocally" in rec && typeof Ctor.available === "function"
        && await Ctor.available({ langs: [rec.lang], processLocally: true }) === "available") {
        rec.processLocally = true;
        local = true;
      }
    } catch { /* fall back to the browser's default service */ }
    let heard = "";
    let pending = "";
    let silence: ReturnType<typeof setTimeout> | undefined;
    // Stop after this much quiet once speech has started; allow longer before the first word.
    const finishAfter = (ms: number) => {
      clearTimeout(silence);
      silence = setTimeout(() => rec.stop(), ms);
    };
    const cap = setTimeout(() => rec.stop(), MAX_LISTEN_MS);
    rec.onstart = () => {
      finishAfter(FIRST_WORD_MS);
      setListening(true); setSpeaking(false); setInterim(""); setError(null); setOnDevice(local);
    };
    rec.onspeechstart = () => setSpeaking(true);
    rec.onspeechend = () => setSpeaking(false);
    rec.onresult = (event) => {
      pending = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) heard += ` ${bestAlternative(result)}`;
        else pending += result[0].transcript;
      }
      setInterim(`${heard}${pending}`.trim());
      finishAfter(END_OF_SPEECH_MS);
    };
    rec.onerror = (event) => {
      if (event.error !== "aborted") setError(SPEECH_ERRORS[event.error]
        ?? "Voice input stopped unexpectedly. Try again, or type in the chat.");
    };
    rec.onend = () => {
      clearTimeout(silence);
      clearTimeout(cap);
      setListening(false);
      setSpeaking(false);
      if (recognition.current === rec) recognition.current = null;
      // A stop can land before the last phrase is finalised; keep what was heard.
      const text = `${heard} ${pending}`.replace(/\s+/g, " ").trim();
      if (text) finalRef.current(text);
    };
    recognition.current = rec;
    try { rec.start(); } catch { setError("Voice input could not start. Try again."); }
  }, []);
  const stop = useCallback(() => recognition.current?.stop(), []);
  const abort = useCallback(() => {
    recognition.current?.abort();
    setListening(false);
    setSpeaking(false);
  }, []);
  const clearError = useCallback(() => setError(null), []);
  return { supported, listening, speaking, interim, error, onDevice, start, stop, abort, clearError };
}

// ---------------------------------------------------------------- dock

const FINISHED_VISIBLE_MS = 7000;

function useRecentlyFinished(run: LiveRun | null): boolean {
  const [, setTick] = useState(0);
  const finishedAt = run?.finishedAt ?? null;
  useEffect(() => {
    if (!finishedAt) return;
    const remaining = finishedAt + FINISHED_VISIBLE_MS - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setTick((value) => value + 1), remaining);
    return () => window.clearTimeout(timer);
  }, [finishedAt]);
  return Boolean(finishedAt && Date.now() - finishedAt < FINISHED_VISIBLE_MS);
}

type DockView = { state: string; title: string; detail: string; tone?: "accent" | "quiet" };

export function LiveDock(): ReactNode {
  const copilot = useOptionalCopilot();
  const pathname = usePathname();
  const live = copilot?.live;
  const speech = useSpeech((text) => { live?.start(text, "voice"); });
  const recent = useRecentlyFinished(live?.run ?? null);
  const hidden = live?.hidden ?? false;
  const run = live?.run ?? null;

  // Hiding or turning off stops the microphone. A choice that needs a person brings it back.
  useEffect(() => { if (hidden || !live?.enabled) speech.abort(); },
    [hidden, live?.enabled, speech.abort]);
  useEffect(() => {
    if (run?.status === "awaiting" && hidden) live?.setHidden(false);
  }, [run?.status, hidden, live]);
  useEffect(() => {
    if (!speech.listening) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") speech.abort(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [speech.listening, speech.abort]);

  if (!copilot || !live?.enabled || pathname.startsWith("/design-preview")) return null;

  const openChat = () => {
    copilot.setOpen(true);
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>(
      "[data-copilot-composer] textarea")?.focus());
  };
  const busy = run && ["running", "awaiting", "paused"].includes(run.status);

  if (hidden) return <div className={styles.layer} data-copilot-ignore>
    <button type="button" className={styles.pill} onClick={() => live.setHidden(false)}
      aria-label={busy ? "Copilot working. Show the copilot" : "Copilot hidden. Show the copilot"}>
      {busy && <span className={styles.workingDot} aria-hidden />}
      <EyeOff size={14} aria-hidden />
      <span>{busy ? "Copilot working" : "Copilot hidden"}</span>
      <strong>Show</strong>
    </button>
  </div>;

  const view = dockView({ live, run, recent, speech });
  const active = run?.steps.findIndex((step) => step.state === "active") ?? -1;
  const editRequest = () => {
    if (!run) return;
    const text = run.request;
    live.cancel();
    copilot.setOpen(true);
    if (copilot.patient) live.draft(text);
    else copilot.setCohortQuestion(text);
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>(
      "[data-copilot-composer] textarea")?.focus());
  };

  return <div className={styles.layer} data-copilot-ignore>
    <section className={styles.dock} data-state={view.state} aria-label="Saarthi live copilot">
      <MicButton speech={speech} disabled={run?.status === "awaiting"} onFallback={openChat} />
      <div className={styles.status} role="status" aria-live="polite">
        <strong key={view.title} className={styles.title}>
          {speech.listening && <Waveform speaking={speech.speaking} />}
          {view.state === "running" && <span className={styles.spinner} aria-hidden />}
          {view.state === "done" && <Check size={14} aria-hidden className={styles.doneIcon} />}
          <span>{view.title}</span>
          {view.state === "running" && active >= 0 && run && <span className={styles.count}>
            {active + 1} of {run.steps.length}</span>}
        </strong>
        <span className={styles.detail}>{view.detail}</span>
      </div>
      <div className={styles.actions}>
        {run?.status === "awaiting" && run.awaiting?.candidates.map((candidate, index) =>
          <button key={candidate.id} type="button"
            className={index === 0 ? styles.prominent : styles.bordered}
            onClick={() => live.choose(candidate.id)}>
            {run.awaiting!.candidates.length === 1 ? "Open record" : candidate.name}
          </button>)}
        {run?.status === "running" && <button type="button" className={styles.bordered}
          onClick={live.pause}><Pause size={14} aria-hidden />Pause</button>}
        {run?.status === "paused" && <button type="button" className={styles.bordered}
          onClick={live.resume}><Play size={14} aria-hidden />Resume</button>}
        {run?.status === "running" && run.source === "voice" && <button type="button"
          className={styles.plain} onClick={editRequest}>Edit</button>}
        {busy && <button type="button" className={styles.iconButton} onClick={live.cancel}
          aria-label="Stop" title="Stop"><Square size={12} fill="currentColor" aria-hidden />
        </button>}
        {!busy && !copilot.open && <button type="button" className={styles.iconButton}
          onClick={openChat} aria-label="Open the chat" title="Open the chat (⌘K)">
          <MessageSquare size={16} aria-hidden /></button>}
        <button type="button" className={styles.iconButton} onClick={() => live.setHidden(true)}
          aria-label="Hide the copilot" title="Hide"><EyeOff size={16} aria-hidden /></button>
      </div>
    </section>
  </div>;
}

function dockView({ live, run, recent, speech }: {
  live: NonNullable<ReturnType<typeof useOptionalCopilot>>["live"];
  run: LiveRun | null; recent: boolean; speech: ReturnType<typeof useSpeech>;
}): DockView {
  if (speech.listening) return { state: "listening", title: "Listening…",
    detail: speech.interim ? `“${speech.interim}”`
      : "Say what you need, for example “Open Fatima Begum's documents”." };
  if (run?.status === "awaiting") {
    const [first] = run.awaiting?.candidates ?? [];
    return run.awaiting?.candidates.length === 1
      ? { state: "awaiting", title: `Open ${first.name}'s record?`,
        detail: `${first.id} · Choose here or on the highlighted card` }
      : { state: "awaiting", title: "Which patient?",
        detail: "More than one patient matches. Choose one to continue." };
  }
  if (run?.status === "running") {
    const step = run.steps.find((item) => item.state === "active");
    return { state: "running", title: `${step?.label ?? "Working"}…`,
      detail: run.source === "voice" ? `“${run.request}”`
        : "Keep working. Results go to the chat." };
  }
  if (run?.status === "paused") return { state: "paused", title: "Paused",
    detail: run.note ?? "Resume when you're ready." };
  if (speech.error) return { state: "error", title: "Voice input stopped", detail: speech.error };
  if (live.reply) return { state: "reply", title: "Need a little more", detail: live.reply };
  if (run && recent) {
    if (run.status === "done") {
      const last = [...run.steps].reverse().find((step) => step.state === "done");
      return { state: "done", title: "Done", detail: last?.receipt ?? "All steps completed." };
    }
    if (run.status === "failed") return { state: "error", title: "Couldn't finish",
      detail: run.note ?? "A step could not be completed. The chat shows what happened." };
    if (run.status === "cancelled") return { state: "idle", title: "Stopped",
      detail: run.note ?? "Nothing further was opened or asked." };
  }
  return { state: "idle", title: "Ask Saarthi", detail: speech.supported
    ? "Speak or type. Saarthi opens records, finds items and brings them to the chat."
    : "Type in the chat. Saarthi opens records, finds items and brings them to the chat." };
}

function MicButton({ speech, disabled, onFallback }: {
  speech: ReturnType<typeof useSpeech>; disabled: boolean; onFallback: () => void;
}): ReactNode {
  if (!speech.supported) return <button type="button" className={styles.mic}
    onClick={onFallback} aria-label="Type a request in the chat" title="Type a request">
    <MessageSquare size={18} aria-hidden /></button>;
  return <button type="button" className={styles.mic} data-listening={speech.listening || undefined}
    disabled={disabled} aria-pressed={speech.listening}
    aria-label={speech.listening ? "Stop listening" : "Speak a request"}
    title={speech.listening
      ? `Stop listening (Esc)${speech.onDevice ? " · on-device recognition" : ""}`
      : "Speak a request"}
    onClick={() => {
      speech.clearError();
      if (speech.listening) speech.stop();
      else void speech.start();
    }}>
    {speech.listening ? <Square size={14} fill="currentColor" aria-hidden /> : <Mic size={18} aria-hidden />}
  </button>;
}

function Waveform({ speaking }: { speaking: boolean }): ReactNode {
  return <span className={styles.wave} data-speaking={speaking || undefined} aria-hidden>
    <i /><i /><i /><i /><i />
  </span>;
}

// ---------------------------------------------------------------- toolbar switch

export function LiveSwitch(): ReactNode {
  const copilot = useOptionalCopilot();
  const pathname = usePathname();
  if (!copilot || pathname.startsWith("/design-preview")) return null;
  const on = copilot.live.enabled;
  return <button type="button" role="switch" aria-checked={on} className={styles.switch}
    title={on ? "Turn off the live copilot. The dashboard and chat keep working."
      : "Turn on the live copilot: it opens records, finds items and brings them to the chat."}
    onClick={() => copilot.live.setEnabled(!on)}>
    <span className={styles.track} aria-hidden><span className={styles.thumb} /></span>
    <span className={styles.switchLabel}>Copilot</span>
  </button>;
}

// ---------------------------------------------------------------- receipt in the chat

const STEP_ICON: Record<RunStep["state"], ReactNode> = {
  done: <Check size={12} aria-hidden />,
  active: <span className={styles.pulse} aria-hidden />,
  pending: <Circle size={10} aria-hidden />,
  skipped: <Minus size={12} aria-hidden />,
  failed: <X size={12} aria-hidden />,
};
const STEP_WORD: Record<RunStep["state"], string> = {
  done: "Done", active: "In progress", pending: "Not started", skipped: "Skipped", failed: "Failed",
};

/** Whether the receipt is on screen for this run: only runs that moved the view or brought
 * something into the chat get one; a plain question needs no receipt. */
export function receiptVisible(run: LiveRun | null): boolean {
  return Boolean(run?.steps.some((item) => stepMovesView(item.step)));
}

/** True while the run's "Ask the record" step is the one in progress, so the answer's own
 * progress belongs under that step rather than in a second card. */
export function receiptHostsAsk(run: LiveRun | null): boolean {
  return receiptVisible(run)
    && run!.steps.some((item) => item.state === "active" && item.step.type === "ask");
}

/** The request, written the way the conversation shows the question it led to. */
function requestText(request: string): string {
  const text = request.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** What the live copilot did on screen, step by step. Sits directly under the message that
 * started it (`anchored`); until that message exists, it shows the request as the person's
 * own message, in the same place and wording, so nothing jumps when the question lands. */
export function LiveReceipt({ anchored = false, askProgress }: {
  anchored?: boolean; askProgress?: ReactNode;
}): ReactNode {
  const copilot = useOptionalCopilot();
  const run = copilot?.live.run ?? null;
  const [open, setOpen] = useState(true);
  const runId = run?.id;
  useEffect(() => { setOpen(true); }, [runId]);
  const finished = run && ["done", "failed", "cancelled"].includes(run.status);
  useEffect(() => { if (finished && run?.status === "done") setOpen(false); },
    [finished, run?.status]);
  if (!copilot || !run || !receiptVisible(run)) return null;
  const live = copilot.live;
  const completed = run.steps.filter((step) => step.state === "done").length;
  const took = run.finishedAt ? elapsedLabel(run.finishedAt - run.startedAt) : "";
  const heading = run.status === "done"
    ? `Worked on the screen${took ? ` for ${took}` : ""} · ${completed} ${completed === 1 ? "step" : "steps"}`
    : run.status === "failed" ? "Stopped at a step"
    : run.status === "cancelled" ? "Stopped"
    : run.status === "awaiting" ? "Waiting for you to choose the patient"
    : run.status === "paused" ? "Paused" : "Working on the screen";
  return <>
    {!anchored && <div className="sa-turn-user" data-copilot-ignore>
      <span className={styles.visuallyHidden}>You: </span>{requestText(run.request)}</div>}
    <section className={styles.receipt} data-copilot-ignore data-status={run.status}
      aria-label="Copilot activity">
      <button type="button" className={styles.receiptHeading} aria-expanded={open}
        onClick={() => setOpen(!open)}>
        <span data-status={run.status}>{run.status === "done" ? <Check size={14} aria-hidden />
          : run.status === "failed" || run.status === "cancelled" ? <X size={14} aria-hidden />
          : <span className={styles.pulse} aria-hidden />}</span>
        <strong>{heading}</strong>
        <ChevronDown size={14} aria-hidden data-open={open || undefined} />
      </button>
      {open && <ol className={styles.steps}>
        {run.steps.map((step) => <li key={step.id} data-state={step.state}>
          <span className={styles.stepIcon} title={STEP_WORD[step.state]}>{STEP_ICON[step.state]}</span>
          <span className={styles.visuallyHidden}>{STEP_WORD[step.state]}: </span>
          <span className={styles.stepText}>{step.receipt ?? step.label}
            {step.state === "active" && step.step.type === "ask" && askProgress}</span>
        </li>)}
      </ol>}
      {run.note && run.status !== "done" && !run.steps.some((step) => step.receipt === run.note)
        && <p className={styles.receiptNote}>{run.note}</p>}
      <div className={styles.receiptActions}>
        {run.status === "running" && <button type="button" className={styles.bordered}
          onClick={live.pause}><Pause size={14} aria-hidden />Pause</button>}
        {run.status === "paused" && <button type="button" className={styles.bordered}
          onClick={live.resume}><Play size={14} aria-hidden />Resume</button>}
        {(run.status === "running" || run.status === "paused" || run.status === "awaiting")
          && <button type="button" className={styles.plain} onClick={live.cancel}>Stop</button>}
        {finished && run.origin && <button type="button" className={styles.plain}
          onClick={live.returnToOrigin}><Undo2 size={14} aria-hidden />Return to previous view</button>}
      </div>
    </section>
  </>;
}
