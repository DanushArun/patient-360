"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { readWorklistState, saveWorklistState } from "@/lib/worklist-storage.mjs";
import type { WorklistState } from "@/lib/worklist-storage.mjs";

type WorklistControls = {
  search: string;
  setSearch: (search: string) => void;
  view: "state" | "visits";
  setView: (view: "state" | "visits") => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  dateRange: "date" | "next7";
  setDateRange: (range: "date" | "next7") => void;
};

export function useWorklistState(availableDates: string[]): WorklistControls {
  const datesKey = availableDates.join("\u0000");
  const [state, setState] = useState<WorklistState>({ search: "", view: "state", scroll: 0,
    selectedDate: availableDates[0] ?? "", dateRange: "date" });
  const [restored, setRestored] = useState(false);
  const persistenceAvailable = useRef(true);
  useWorklistEffects({ availableDates, datesKey, state, setState, restored, setRestored,
    persistenceAvailable });
  return {
    search: state.search, view: state.view,
    selectedDate: availableDates.includes(state.selectedDate)
      ? state.selectedDate : availableDates[0] ?? "",
    dateRange: state.dateRange,
    setSearch: (search) => setState((current) => ({ ...current, search, scroll: 0 })),
    setView: (view) => setState((current) => ({ ...current, view, scroll: 0 })),
    setSelectedDate: (selectedDate) => setState((current) => ({
      ...current, selectedDate, dateRange: "date", scroll: 0,
    })),
    setDateRange: (dateRange) => setState((current) => ({ ...current, dateRange, scroll: 0 })),
  };
}

function useWorklistEffects(options: {
  availableDates: string[];
  datesKey: string;
  state: WorklistState;
  setState: Dispatch<SetStateAction<WorklistState>>;
  restored: boolean;
  setRestored: (restored: boolean) => void;
  persistenceAvailable: { current: boolean };
}): void {
  const { availableDates, datesKey, state, setState, restored, setRestored,
    persistenceAvailable } = options;
  useEffect(() => restoreWorklist(availableDates, setState, setRestored, persistenceAvailable),
    [datesKey]);
  useEffect(() => restoreScroll(restored, state.scroll), [restored]);
  useEffect(() => saveWorklist(state, restored, persistenceAvailable), [restored, state]);
}

function restoreWorklist(dates: string[], setState: Dispatch<SetStateAction<WorklistState>>,
  setRestored: (restored: boolean) => void, available: { current: boolean }): void {
  try { setState(readWorklistState(sessionStorage, dates)); }
  catch {
    available.current = false;
    setState((current) => ({ ...current, search: "", view: "state", scroll: 0,
      selectedDate: dates[0] ?? "", dateRange: "date" }));
  }
  setRestored(true);
}

function restoreScroll(restored: boolean, scroll: number): (() => void) | void {
  if (!restored) return;
  const frame = requestAnimationFrame(() => window.scrollTo(0, scroll));
  return () => cancelAnimationFrame(frame);
}

function saveWorklist(state: WorklistState, restored: boolean,
  available: { current: boolean }): (() => void) | void {
  if (!restored || !available.current) return;
  const save = (next: WorklistState): void => {
    if (available.current && !persistState(next)) available.current = false;
  };
  save(state);
  const saveScroll = (): void => save({ ...state, scroll: window.scrollY });
  window.addEventListener("scroll", saveScroll, { passive: true });
  return () => {
    window.removeEventListener("scroll", saveScroll);
    save({ ...state, scroll: window.scrollY });
  };
}

function persistState(state: WorklistState): boolean {
  try {
    saveWorklistState(sessionStorage, state);
    return true;
  } catch {
    return false;
  }
}
