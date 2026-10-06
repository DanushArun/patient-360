"use client";

import { useEffect, useState } from "react";
import {
  announcePatientAccessWithdrawn,
  purgesPatientState,
} from "@/lib/workspace-state.mjs";
import {
  coverageRequestKey,
  coverageResultForKey,
  coverageRowFromEnvelope,
} from "@/lib/workspace-authorization-read.mjs";

export type AuthorizationRecord = {
  auth_id?: string; status?: string; letter_status?: string; expires_at?: string | null;
  requested_at?: string | null; decided_at?: string | null; observed_at?: string | null;
  payer_name?: string | null;
};

export type AuthorizationLetter = {
  assertion_id?: string; value?: string; predicate?: string; verification_status?: string;
  source_link_status?: string; doc_id?: string; page_index?: number;
  char_start?: number; char_end?: number; doc_type?: string;
  excerpt_start?: number;
  source_facility?: string | null; event_time?: string | null;
  source_recorded_at?: string | null; ingested_at?: string | null; excerpt?: string | null;
};

export type CoverageComparison = {
  known_as_of?: string; requested_known_as_of?: string; as_of_semantics?: string;
  observed_at?: string; authorizations_truncated?: boolean; letters_truncated?: boolean;
  rule?: { rule_id?: string; rule_version?: number; outcome?: string; reason?: string;
    known_as_of?: string };
  authorizations?: AuthorizationRecord[]; letters?: AuthorizationLetter[];
};

export type AuthorizationReadState = "loading" | "ready" | "empty" | "error" | "access";
type ReadResult = { key: string; state: AuthorizationReadState; data: CoverageComparison | null };

export function useWorkspaceAuthorizationComparison(patientId: string, knownAsOf: string | null,
  preview: boolean): { current: ReadResult; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const key = coverageRequestKey(patientId, knownAsOf, attempt);
  const [result, setResult] = useState<ReadResult>({ key: "", state: "loading", data: null });
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    const url = comparisonUrl(patientId, knownAsOf);
    setResult({ key, state: "loading", data: null });
    void readComparison(url, patientId, controller.signal).then((next) => {
      if (!controller.signal.aborted) setResult({ key, ...next });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key, state: "error", data: null });
    });
    return () => controller.abort();
  }, [key, knownAsOf, patientId, preview]);
  return { current: coverageResultForKey(result, key) as ReadResult,
    retry: () => setAttempt((value) => value + 1) };
}

function comparisonUrl(patientId: string, knownAsOf: string | null): string {
  const query = new URLSearchParams({ view: "coverage_comparison" });
  if (knownAsOf) query.set("known_as_of", knownAsOf);
  return `/api/patient/${encodeURIComponent(patientId)}/workspace?${query}`;
}

async function readComparison(url: string, patientId: string, signal: AbortSignal): Promise<{
  state: AuthorizationReadState; data: CoverageComparison | null;
}> {
  const response = await fetch(url, { cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
  const body = await response.json() as ApiEnvelope;
  if (signal.aborted) return { state: "loading", data: null };
  if (purgesPatientState(body) || isAccessError(body.error)) {
    announcePatientAccessWithdrawn(patientId);
    return { state: "access", data: null };
  }
  if (!response.ok || body.error) throw new Error("coverage_read_unavailable");
  const data = coverageRowFromEnvelope(body) as CoverageComparison | null;
  return { state: data ? "ready" : "empty", data };
}

type ApiEnvelope = { rows?: unknown; error?: string; purge_patient_state?: boolean };

function isAccessError(code?: string): boolean {
  return code === "no_patient_access" || code === "access_withdrawn"
    || code === "consent_not_valid" || code === "binding_mismatch";
}
