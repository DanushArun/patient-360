"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ContextReference } from "@/lib/api-contracts.mjs";
import type { CohortSession } from "@/lib/copilot-session.mjs";
import {
  planRequest, rankItems, type LiveSection, type LiveStep, type RosterEntry,
} from "@/lib/copilot-intent.mjs";
import { createLiveRunner, StepSkipped, type LiveRun, type StepTools } from "@/lib/copilot-run.mjs";
import type { AgentTurn } from "@/lib/patient";
import {
  clearMarks, flyToChat, frames, mark, readRef, reveal, taggedItems, waitFor,
} from "./live-dom";

// The live copilot: an optional layer that carries out a request on the dashboard itself
// (open the patient, open the section, find the item, bring it into the chat, ask the record,
// mark what the answer cites). It never decides anything clinical. Every fact still comes from
// the governed reads behind /api/ask and /api/copilot/cohort (R1), and a patient is only ever
// opened by a person's click (COPILOT-SPEC §0).

/** What a patient page lets the live copilot do. Registered by the page while it is mounted. */
export type LivePatientPage = {
  kind: "patient";
  patientId: string;
  patientName: string;
  section: string;
  setSection: (section: LiveSection) => void;
  ask: (question: string, context: ContextReference[]) => Promise<void>;
  stop: () => void;
  turnCount: () => number;
  latestAnswer: () => AgentTurn | null;
  selectGate: (ruleId: string) => void;
  /** Puts text in the patient composer so a person can correct a misheard request. */
  setDraft: (text: string) => void;
};

export type LiveChip = ContextReference & { label: string };

type LiveDeps = {
  setOpen: (open: boolean) => void;
  attach: (chip: LiveChip) => void;
  chips: LiveChip[];
  clearChips: () => void;
  cohortSession: CohortSession;
  patientId: string | null;
};

export type LiveState = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
  run: LiveRun | null;
  history: LiveRun[];
  /** Where the latest run's activity sits in the conversation (turn count at its question). */
  anchor: { runId: string; scope: "patient" | "cohort"; index: number } | null;
  reply: string | null;
  /** Plans and starts a request. Returns false when there is nothing to do with it. */
  start: (text: string, source: LiveRun["source"]) => boolean;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  choose: (patientId: string) => void;
  returnToOrigin: () => void;
  draft: (text: string) => void;
  registerPage: (page: LivePatientPage | null) => void;
  setRoster: (roster: RosterEntry[]) => void;
};

const ENABLED_KEY = "saarthi-live-copilot";
const KIND_NOUN: Record<string, string> = { document: "document", check: "record check",
  fact: "record fact" };

function routeOf(pathname: string): "census" | "queue" | "patient" | "other" {
  if (pathname === "/") return "census";
  if (pathname.startsWith("/review-queue")) return "queue";
  if (pathname.startsWith("/patient/")) return "patient";
  return "other";
}

/** Every identifier an answer points at: record checks, facts and documents. */
function citedIds(turn: AgentTurn | null): Set<string> {
  const ids = new Set<string>();
  if (!turn) return ids;
  for (const gate of turn.gates ?? []) {
    if (gate.rule_id) ids.add(gate.rule_id);
    for (const id of gate.evidence_ids ?? []) ids.add(id);
  }
  for (const item of turn.record?.items ?? []) if (item.ruleId) ids.add(item.ruleId);
  for (const id of turn.record?.sources ?? []) ids.add(id);
  for (const claim of turn.artifact?.claims ?? []) {
    if (claim.rule_id) ids.add(claim.rule_id);
    for (const evidence of claim.evidence ?? []) {
      ids.add(evidence.id);
      if (evidence.doc_id) ids.add(evidence.doc_id);
    }
  }
  return ids;
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function useLiveCopilot(deps: LiveDeps): LiveState {
  const router = useRouter();
  const pathname = usePathname();
  const [enabled, setEnabledState] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<LiveState["anchor"]>(null);
  const pageRef = useRef<LivePatientPage | null>(null);
  const rosterRef = useRef<RosterEntry[]>([]);
  const found = useRef<{ element: HTMLElement; kind: string; id: string; label: string } | null>(null);
  const lastAnswer = useRef<AgentTurn | null>(null);
  const lastCohortIds = useRef<string[]>([]);
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    try {
      if (localStorage.getItem(ENABLED_KEY) === "off") setEnabledState(false);
    } catch { /* storage unavailable: keep the default */ }
  }, []);

  const execute = useCallback(async (step: LiveStep, tools: StepTools): Promise<string> => {
    const { signal } = tools;
    const current = depsRef.current;
    switch (step.type) {
      case "select_patient": {
        const page = pageRef.current;
        const only = step.candidates.length === 1 ? step.candidates[0] : null;
        if (only && page?.patientId === only.id) return `Already on ${only.name}'s record`;
        const offered = step.candidates.flatMap((candidate) => [
          ...document.querySelectorAll(`[data-copilot-ref="patient:${CSS.escape(candidate.id)}"]`),
          ...document.querySelectorAll(`a[href="/patient/${encodeURIComponent(candidate.id)}"]`)]);
        mark(offered, "suggested");
        let chosen: string;
        try {
          chosen = await tools.awaitChoice(step.candidates);
        } finally {
          clearMarks("suggested");
        }
        const name = step.candidates.find((item) => item.id === chosen)?.name ?? chosen;
        tools.expectPatient(chosen);
        if (pageRef.current?.patientId !== chosen) {
          router.push(`/patient/${encodeURIComponent(chosen)}`);
          await waitFor(() => pageRef.current?.patientId === chosen, signal, 45000,
            `${name}'s record did not open. Try opening it from the list.`);
        }
        return `Opened ${name}'s record`;
      }
      case "go": {
        tools.expectPatient(null);
        const path = step.to === "census" ? "/" : "/review-queue";
        const label = step.to === "census" ? "Day care" : "the review queue";
        if (routeOf(pathRef.current) !== step.to) {
          router.push(path);
          await waitFor(() => routeOf(window.location.pathname) === step.to
            && document.querySelector(step.to === "census"
              ? "section[aria-label='Day-care visits'], [role='alert']" : "main"),
          signal, 45000, `${label} did not open. Try the sidebar link.`);
        }
        return `Opened ${label}`;
      }
      case "section": {
        const page = await waitFor(() => pageRef.current, signal, 15000,
          "The patient record is not open.");
        page.setSection(step.section);
        await frames(2);
        return `Opened ${step.section}`;
      }
      case "find": {
        const noun = KIND_NOUN[step.kind];
        const items = await waitFor(() => {
          const list = taggedItems(step.kind);
          return list.length ? list : null;
        }, signal, 20000, `No ${noun} is on this page.`);
        // Rows arrive together; give a list one more frame to finish rendering.
        await frames(2);
        const settled = taggedItems(step.kind).length ? taggedItems(step.kind) : items;
        const index = rankItems(settled.map((element) => ({ text:
          `${element.getAttribute("data-copilot-label") ?? ""} ${element.textContent ?? ""}` })),
        step.terms, step.codes);
        if (index < 0) throw new Error(`No ${noun} matching “${step.phrase}” is on this page.`);
        const element = settled[index];
        const ref = readRef(element);
        if (!ref) throw new Error(`That ${noun} cannot be referenced.`);
        clearMarks("found");
        reveal(element);
        mark([element], "found");
        found.current = { element, ...ref };
        if (step.open) {
          if (step.kind === "check") pageRef.current?.selectGate(ref.id);
          else element.querySelector<HTMLButtonElement>(step.kind === "fact"
            ? "button[aria-expanded]" : "button")?.click();
          return `Found and opened ${ref.label}`;
        }
        return `Found ${ref.label}`;
      }
      case "collect": {
        const item = found.current;
        if (!item?.element.isConnected) throw new Error("The item to add is no longer on screen.");
        if (!["check", "fact", "document"].includes(item.kind)) {
          throw new Error("Only record checks, facts and documents can be added to the chat.");
        }
        current.setOpen(true);
        await waitFor(() => document.querySelector("[data-copilot-composer]"), signal, 5000,
          "The chat did not open.");
        await flyToChat(item.element, item.label);
        current.attach({ kind: item.kind as LiveChip["kind"], id: item.id, label: item.label });
        return `Added ${item.label} to the chat`;
      }
      case "ask": {
        current.setOpen(true);
        if (step.scope === "cohort") {
          const session = current.cohortSession;
          setAnchor({ runId: tools.run.id, scope: "cohort",
            index: session.getSnapshot().turns.length });
          signal.addEventListener("abort", () => session.stop(), { once: true });
          await session.send(step.question);
          const last = session.getSnapshot().turns.at(-1);
          if (!last || last.role !== "assistant" || last.error) {
            throw new Error("The day-care checks could not be read.");
          }
          lastCohortIds.current = last.rows.map((row) => row.patientId);
          if (last.refused) return "Referred to the treating practitioner";
          return last.title ? `Found ${plural(last.rows.length, "patient")}: ${last.title}`
            : "Answered from the day-care checks";
        }
        const page = await waitFor(() => pageRef.current, signal, 15000,
          "The patient record is not open.");
        const context = current.chips.map(({ kind, id }) => ({ kind, id }));
        current.clearChips();
        const before = page.turnCount();
        setAnchor({ runId: tools.run.id, scope: "patient", index: before });
        signal.addEventListener("abort", () => page.stop(), { once: true });
        await page.ask(step.question, context);
        // The answer lands in page state; wait for it to render before reading it.
        await waitFor(() => page.turnCount() >= before + 2, signal, 5000,
          "No answer arrived. The chat shows why.");
        const answer = page.latestAnswer();
        lastAnswer.current = answer;
        if (!answer || answer.error) throw new Error("The record did not answer. The chat shows why.");
        if (answer.artifact?.classification === "CLASS_A") {
          return "Referred to the treating practitioner";
        }
        return "Answered from the record";
      }
      case "mark": {
        clearMarks("cited");
        if (step.scope === "cohort") {
          const cards = lastCohortIds.current.flatMap((id) => [...document.querySelectorAll(
            `[data-copilot-ref="patient:${CSS.escape(id)}"]`)]);
          if (!cards.length) throw new StepSkipped("None of those patients are on this view");
          mark(cards, "cited");
          return `Marked ${plural(new Set(lastCohortIds.current).size, "patient")} on the list`;
        }
        const ids = citedIds(lastAnswer.current);
        const elements = ["check", "fact", "document"].flatMap((kind) => taggedItems(kind))
          .filter((element) => ids.has(readRef(element)?.id ?? ""));
        if (!elements.length) throw new StepSkipped("Nothing the answer cites is on this view");
        mark(elements, "cited");
        const section = pageRef.current?.section ?? "this view";
        return `Marked ${plural(elements.length, "cited item")} on ${section}`;
      }
    }
  }, [router]);

  const [runner] = useState(() => createLiveRunner({ execute: (step, tools) =>
    executeRef.current(step, tools) }));
  const executeRef = useRef(execute);
  executeRef.current = execute;
  const snapshot = useSyncExternalStore(runner.subscribe, runner.getSnapshot, runner.getSnapshot);

  // Patient changed under the run: continue only if the run opened it.
  useEffect(() => { runner.notePatient(deps.patientId); }, [runner, deps.patientId]);

  // Manual work wins. A person's click, key or scroll pauses any step that would move the view.
  const status = snapshot.run?.status;
  useEffect(() => {
    if (status !== "running") return;
    const ignoredKeys = new Set(["Shift", "Meta", "Control", "Alt", "CapsLock", "Tab"]);
    const onInput = (event: Event) => {
      if (!event.isTrusted) return;
      if (event instanceof KeyboardEvent && ignoredKeys.has(event.key)) return;
      if ((event.target as Element | null)?.closest?.("[data-copilot-ignore]")) return;
      runner.noteManualInput();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const name of events) document.addEventListener(name, onInput, { capture: true, passive: true });
    return () => {
      for (const name of events) document.removeEventListener(name, onInput, { capture: true });
    };
  }, [status, runner]);

  // Marks belong to the view they were made on.
  useEffect(() => { clearMarks("found"); clearMarks("cited"); }, [pathname]);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    try { localStorage.setItem(ENABLED_KEY, next ? "on" : "off"); } catch { /* not stored */ }
    if (!next) {
      runner.cancel("Stopped because the copilot was turned off.");
      clearMarks();
      setReply(null);
    }
  }, [runner]);

  const start = useCallback((text: string, source: LiveRun["source"]): boolean => {
    const page = pageRef.current;
    const route = routeOf(pathRef.current);
    const plan = planRequest(text, {
      route,
      patient: page ? { id: page.patientId, name: page.patientName } : null,
      section: page?.section ?? null,
      roster: rosterRef.current,
    });
    if (plan.control === "cancel") { runner.cancel(); return true; }
    if (plan.control === "back") { router.back(); return true; }
    if (!plan.steps.length) {
      setReply(plan.reply);
      return false;
    }
    setReply(null);
    clearMarks();
    setAnchor(null);
    found.current = null;
    lastAnswer.current = null;
    setHidden(false);
    void runner.start(text, plan.steps, { source,
      origin: window.location.pathname + window.location.hash,
      expectedPatient: page?.patientId ?? null });
    return true;
  }, [runner, router]);

  const returnToOrigin = useCallback(() => {
    const origin = runner.getSnapshot().run?.origin;
    if (!origin) return;
    const [path, hash] = origin.split("#");
    const page = pageRef.current;
    if (page && path === window.location.pathname && hash) {
      const section = hash.charAt(0).toUpperCase() + hash.slice(1);
      page.setSection(section as LiveSection);
    } else {
      router.push(origin);
    }
  }, [runner, router]);

  const registerPage = useCallback((page: LivePatientPage | null) => { pageRef.current = page; }, []);
  const setRoster = useCallback((roster: RosterEntry[]) => {
    if (roster.length) rosterRef.current = roster;
  }, []);

  return useMemo<LiveState>(() => ({
    enabled, setEnabled, hidden, setHidden, run: snapshot.run, history: snapshot.history, anchor,
    reply, start,
    pause: () => runner.pause(), resume: () => runner.resume(),
    cancel: () => runner.cancel(), choose: (id) => { runner.choose(id); },
    returnToOrigin, registerPage, setRoster,
    draft: (text) => pageRef.current?.setDraft(text),
  }), [enabled, setEnabled, hidden, snapshot, anchor, reply, start, runner, returnToOrigin,
    registerPage, setRoster]);
}
