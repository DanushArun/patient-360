"use client";

import { useEffect } from "react";
import { PATIENT_ACCESS_EVENT } from "@/lib/workspace-state.mjs";
import { readTaskUpdate, storeTaskUpdate, taskUpdateKey,
  type TaskUpdateAttempt } from "@/lib/task-update-request.mjs";

type Recovery = {
  patientId: string; taskId: string;
  attempt: { current: TaskUpdateAttempt | null };
  restore: (attempt: TaskUpdateAttempt) => void;
  report: (message: string) => void;
};

export function useTaskUpdateRecovery(runtime: Recovery): void {
  useEffect(() => {
    restoreAttempt(runtime);
    const clear = (event: Event): void => {
      if ((event as CustomEvent<{ patientId: string }>).detail?.patientId !== runtime.patientId) {
        return;
      }
      runtime.attempt.current = null;
      persistTaskAttempt(runtime.patientId, runtime.taskId, null);
    };
    window.addEventListener(PATIENT_ACCESS_EVENT, clear);
    return () => window.removeEventListener(PATIENT_ACCESS_EVENT, clear);
  }, [runtime.patientId, runtime.taskId]);
}

function restoreAttempt(runtime: Recovery): void {
  try {
    const saved = readTaskUpdate(sessionStorage,
      taskUpdateKey(runtime.patientId, runtime.taskId), runtime.taskId);
    if (saved.error) {
      runtime.report("A previous update could not be restored. Reload retry is unavailable.");
    }
    if (saved.attempt) {
      runtime.attempt.current = saved.attempt;
      runtime.restore(saved.attempt);
    }
  } catch {
    runtime.report("Session storage is unavailable. Reload retry is unavailable.");
  }
}

export function persistTaskAttempt(patientId: string, taskId: string,
  attempt: TaskUpdateAttempt | null): boolean {
  try {
    return storeTaskUpdate(sessionStorage, taskUpdateKey(patientId, taskId), attempt);
  } catch {
    return false;
  }
}
