"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Info, Maximize2, Minimize2, Plus, Sparkles, X } from "lucide-react";
import { CensusChip, type CensusStatus } from "@/components/sa";
import { formatRecordDate } from "@/lib/workspace-record-date.mjs";
import { useCopilot, type CopilotChip } from "./copilot-provider";
import { COHORT_STARTERS } from "@/lib/copilot-cohort.mjs";
import { CopilotComposer, CopilotStarters } from "./copilot-parts";
import styles from "./copilot.module.css";

// Global copilot frame: launcher, docked panel and the "+ Ask" picker. Patient pages render
// their own conversation into the panel's slot; other pages get cohort mode.

export function CopilotFrame(): ReactNode {
  const copilot = useCopilot();
  const pathname = usePathname();
  // The recorded design preview has no live backend; offering a copilot there would mislead.
  if (pathname.startsWith("/design-preview")) return null;
  return <>
    {!copilot.open && <button type="button" className={styles.launcher}
      onClick={() => copilot.setOpen(true)} aria-label="Open Saarthi copilot">
      <Sparkles size={16} aria-hidden /><span className={styles.launcherLabel}>Ask Saarthi</span>
      <kbd>⌘K</kbd>
    </button>}
    {copilot.open && <CopilotPanel />}
    <CopilotPicker />
  </>;
}

function CopilotPanel(): ReactNode {
  const copilot = useCopilot();
  return <>
  {/* Below 900 px the copilot is a sheet over the page; the scrim dismisses it. */}
  <div className={styles.scrim} aria-hidden onClick={() => copilot.setOpen(false)} />
  <aside data-copilot-panel data-copilot-ignore className={styles.panel}
    data-expanded={copilot.expanded || undefined} aria-label="Saarthi copilot">
    <header className={styles.header}>
      <div className={styles.scope}>
        <strong>{copilot.patient ? copilot.patient.patientName : "My day-care patients"}</strong>
        <span>{copilot.patient
          ? `Known as of ${formatRecordDate(copilot.patient.knownAsOf)}`
          : "Record state across your care team"}</span>
      </div>
      <button type="button" className={styles.iconButton} aria-pressed={copilot.inspector}
        aria-label="Conversation context" title="Conversation context"
        onClick={() => copilot.setInspector(!copilot.inspector)}><Info size={16} aria-hidden />
      </button>
      <button type="button" className={styles.iconButton} data-copilot-widen
        aria-label={copilot.expanded ? "Narrow copilot" : "Widen copilot"}
        title={copilot.expanded ? "Narrow" : "Widen"}
        onClick={() => copilot.setExpanded(!copilot.expanded)}>
        {copilot.expanded ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}
      </button>
      <button type="button" className={styles.iconButton} aria-label="Close"
        title="Close (Esc)" onClick={() => copilot.setOpen(false)}><X size={16} aria-hidden />
      </button>
    </header>
    <div className={styles.body}>
      <div ref={copilot.setSlot} className={styles.slot} />
      {!copilot.patient && <CohortConversation />}
    </div>
  </aside>
  </>;
}

// ---------------------------------------------------------------- cohort mode

type CohortRow = { patientId: string; name: string; status: CensusStatus;
  headline: string | null; headlineRule: string | null; otherIssues: number };
type CohortTurn =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; title: string | null; rows: CohortRow[];
    counts?: Record<CensusStatus, number>; basis: string | null; known_as_of: string | null;
    text?: string; error?: string | null };


function CohortConversation(): ReactNode {
  const copilot = useCopilot();
  const [turns, setTurns] = useState<CohortTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const stream = useRef<HTMLDivElement>(null);
  useEffect(() => { stream.current?.scrollTo({ top: stream.current.scrollHeight }); }, [turns, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setTurns((current) => [...current, { id: crypto.randomUUID(), role: "user", text }]);
    setQuestion("");
    setBusy(true);
    try {
      const response = await fetch("/api/copilot/cohort", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text }),
        signal: AbortSignal.timeout(60000) });
      const result = await response.json();
      setTurns((current) => [...current, { id: crypto.randomUUID(), role: "assistant",
        title: null, rows: [], basis: null, known_as_of: null, ...result,
        error: response.ok ? result.error ?? null : result.error ?? "record_service_unavailable" }]);
    } catch {
      setTurns((current) => [...current, { id: crypto.randomUUID(), role: "assistant",
        title: null, rows: [], basis: null, known_as_of: null, error: "record_service_unavailable" }]);
    } finally {
      setBusy(false);
    }
  };

  return <>
    {copilot.inspector && <div className={styles.inspector}>
      <section><h3>In scope</h3><ul><li>Your active care team, current consent only</li>
        <li>Answers come from versioned SQL record checks; nothing is predicted</li></ul></section>
      <section><h3>Questions this session</h3><ul>
        {turns.filter((turn) => turn.role === "user").map((turn) =>
          <li key={turn.id}>{turn.role === "user" ? turn.text : null}</li>)}
        {!turns.length && <li>None yet</li>}</ul></section>
    </div>}
    <div ref={stream} className={styles.stream} role="log" aria-label="Day-care conversation"
      aria-live="polite" aria-busy={busy}>
      {!turns.length && <div className={styles.empty}>
        <h2>Ask about your day-care list</h2>
        <p>Who can be treated, who is blocked and why. Every answer comes from the record
          checks on screen. Open a patient to ask about their record.</p>
        <CopilotStarters starters={COHORT_STARTERS} onPick={(text) => void send(text)} />
      </div>}
      {turns.map((turn) => turn.role === "user"
        ? <div key={turn.id} className="sa-turn-user">{turn.text}</div>
        : <CohortAnswer key={turn.id} turn={turn} />)}
      {busy && <p className={styles.meta} role="status">Reading the day-care record checks…</p>}
    </div>
    <CopilotComposer label="Question about the day-care list"
      placeholder="Ask about today's day-care list…" value={question} setValue={setQuestion}
      busy={busy} onSend={() => void send(question)} chips={[]} onDetach={() => {}}
      picking={copilot.picking} onPick={() => copilot.setPicking(!copilot.picking)} />
    <p className={styles.disclaimer}>Record and coverage facts only. Clinical decisions belong to
      the treating practitioner.</p>
  </>;
}

const COHORT_ERRORS: Record<string, string> = {
  record_service_unavailable: "The record service didn't respond. Try again in a moment.",
  classification_unavailable: "That question couldn't be routed safely. Ask who is blocked, "
    + "waiting on evidence, in conflict or ready.",
};

function CohortAnswer({ turn }: { turn: Extract<CohortTurn, { role: "assistant" }> }): ReactNode {
  if (turn.error) return <p className="sa-limitation">
    {COHORT_ERRORS[turn.error] ?? "No answer is available. Try again or rephrase."}</p>;
  if (turn.text && !turn.title) return <div className={styles.cohortAnswer}>
    <p>{turn.text}</p>
    {turn.known_as_of && <p className={styles.meta}>Known as of {formatRecordDate(turn.known_as_of)}</p>}
  </div>;
  if (!turn.title) return <div className={styles.cohortAnswer}>
    <p>I can answer who is blocked, waiting on evidence, in conflict, advisory or ready, and by
      topic: platelets, ANC, LVEF, pre-authorisation, HER2, pathology, HbA1c, DEXA, renal or liver
      function.</p>
  </div>;
  return <div className={styles.cohortAnswer}>
    <p><strong>{turn.title}</strong>: {turn.rows.length} {turn.rows.length === 1 ? "visit" : "visits"}
      {turn.counts && ` · day-care total: ${turn.counts.blocked} blocked, ${turn.counts.conflict} in `
        + `conflict, ${turn.counts.waiting} waiting, ${turn.counts.advisory + turn.counts.ready} ready`}.</p>
    <ul className={styles.cohortList}>{turn.rows.slice(0, 12).map((row) =>
      <li key={row.patientId} className={styles.cohortCard}>
        <header><strong>{row.name}</strong><CensusChip status={row.status} /></header>
        <p>{row.headline ?? "No issue summary returned"}{row.otherIssues > 0
          && ` · +${row.otherIssues} more`}</p>
        {row.headlineRule && <code>{row.headlineRule}</code>}
        <Link href={`/patient/${row.patientId}`} prefetch={false}>Open patient</Link>
      </li>)}</ul>
    {turn.rows.length > 12 && <p className={styles.meta}>Showing 12 of {turn.rows.length}. Use the
      day-care list for the rest.</p>}
    {turn.basis && <p className={styles.meta}>{turn.basis}</p>}
    {turn.known_as_of && <p className={styles.meta}>Known as of {formatRecordDate(turn.known_as_of)}</p>}
  </div>;
}

// ---------------------------------------------------------------- "+ Ask" picker

type PickTarget = Omit<CopilotChip, "kind"> & { kind: CopilotChip["kind"] | "patient" };

function readChip(element: Element): PickTarget | null {
  const [kind, ...rest] = (element.getAttribute("data-copilot-ref") ?? "").split(":");
  const id = rest.join(":");
  if (!id || !["patient", "check", "fact", "document", "task", "section"].includes(kind)) return null;
  return { kind: kind as PickTarget["kind"], id,
    label: element.getAttribute("data-copilot-label") ?? id };
}

function CopilotPicker(): ReactNode {
  const copilot = useCopilot();
  const router = useRouter();
  const [hover, setHover] = useState<{ element: Element; rect: DOMRect } | null>(null);

  const choose = (element: Element) => {
    const chip = readChip(element);
    if (!chip) return;
    // Choosing a patient is the human selection click: open their record with the copilot.
    if (chip.kind === "patient") {
      copilot.setOpen(true);
      router.push(`/patient/${encodeURIComponent(chip.id)}`);
    } else {
      copilot.attach({ ...chip, kind: chip.kind });
    }
    copilot.setPicking(false);
    setHover(null);
  };

  useEffect(() => {
    const onOver = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest?.("[data-copilot-ref]");
      if (target && !target.closest("[data-copilot-ignore]")) {
        setHover({ element: target, rect: target.getBoundingClientRect() });
      } else if (!(event.target as Element | null)?.closest?.("[data-copilot-handle]")) {
        setHover(null);
      }
    };
    const onClick = (event: MouseEvent) => {
      if (!copilot.picking) return;
      const target = (event.target as Element | null)?.closest?.("[data-copilot-ref]");
      if (!target || target.closest("[data-copilot-ignore]")) return;
      event.preventDefault();
      event.stopPropagation();
      choose(target);
    };
    const onScroll = () => setHover(null);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, true);
    document.documentElement.toggleAttribute("data-copilot-picking", copilot.picking);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll, true);
      document.documentElement.removeAttribute("data-copilot-picking");
    };
  });

  if (!hover) return null;
  return <button type="button" data-copilot-handle data-copilot-ignore className={styles.askHandle}
    style={{ top: Math.max(hover.rect.top + 4, 4), left: hover.rect.right - 72 }}
    onClick={() => choose(hover.element)}>
    <Plus size={12} aria-hidden /> Ask
  </button>;
}
