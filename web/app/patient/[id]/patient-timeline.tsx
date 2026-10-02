"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonStyle } from "@/components/sa";
import type { PatientTimeline, TimelineEvent } from "@/lib/patient";
import { announcePatientAccessWithdrawn, purgesPatientState } from "@/lib/workspace-state.mjs";
import { isCurrentPatientRequest } from "@/lib/patient-request-lifecycle.mjs";

function Clock({ label, value }: { label: string; value: string }): ReactNode {
  return <div>
    <div className="sa-clock-label">{label}</div>
    <div className="sa-clock-value sa-num">{value || "Not recorded"}</div>
  </div>;
}

function EventRow({ event }: { event: TimelineEvent }): ReactNode {
  return <div className="sa-timeline-event">
    <div className="sa-timeline-title">
      {event.concept}{event.value !== null && <> · {event.value} {event.unit}</>}
      {event.value_text && <> · {event.value_text}</>}
    </div>
    <div className="sa-meta">
      <code>{event.event_id || "Event ID unavailable"}</code>
      {event.is_derived && " · Derived value"}
      {" · "}{event.value_state}
      {event.abnormal_flag && <> · recorded flag: {event.abnormal_flag}</>}
    </div>
    <div className="sa-clocks">
      <Clock label="Event time" value={event.event_time} />
      <Clock label="Source recorded" value={event.source_recorded_at} />
      <Clock label="Ingested" value={event.ingested_at} />
    </div>
    {event.derivation && <p className="sa-meta">Derivation: {event.derivation}</p>}
    {event.valid_until && <p className="sa-meta">Valid until: {event.valid_until}</p>}
    <EventSources event={event} />
  </div>;
}

function EventSources({ event }: { event: TimelineEvent }): ReactNode {
  const groups = [
    ["Source events", event.source_event_ids],
    ["Verified assertions", event.source_assertion_ids],
    ["Source documents", event.source_document_ids],
  ] as const;
  return <dl className="sa-meta">
    {groups.map(([label, ids]) => ids?.length ? <div key={label}>
      <dt>{label}</dt><dd>{ids.join(", ")}</dd>
    </div> : null)}
    {event.source_links_observed_at && <div>
      <dt>Source links observed</dt><dd>{event.source_links_observed_at}</dd>
    </div>}
  </dl>;
}

type TimelineLoadState = "loading" | "ready" | "error";
type TimelineResult = { data: PatientTimeline | null; state: TimelineLoadState; retry: () => void };
type TimelineSnapshot = {
  patientId: string;
  data: PatientTimeline | null;
  state: TimelineLoadState;
};

async function requestTimeline(
  patientId: string,
  signal: AbortSignal,
): Promise<PatientTimeline | null> {
  const response = await fetch(
    `/api/patient/${encodeURIComponent(patientId)}/timeline`, { cache: "no-store", signal },
  );
  const result = await response.json() as PatientTimeline & {
    error?: string; purge_patient_state?: boolean;
  };
  if (purgesPatientState(result)) {
    announcePatientAccessWithdrawn(patientId);
    return null;
  }
  if (!response.ok || result.error) throw new Error(result.error ?? "timeline_unavailable");
  return result;
}

function usePatientTimeline(patientId: string): TimelineResult {
  const [retryCount, setRetryCount] = useState(0);
  const [snapshot, setSnapshot] = useState<TimelineSnapshot | null>(null);
  const activePatient = useRef(patientId);
  activePatient.current = patientId;
  useEffect(() => {
    const controller = new AbortController();
    setSnapshot({ patientId, data: null, state: "loading" });
    void loadTimeline(patientId, controller, activePatient, setSnapshot);
    return () => controller.abort();
  }, [patientId, retryCount]);
  const current = snapshot?.patientId === patientId ? snapshot : null;
  return {
    data: current?.data ?? null,
    state: current?.state ?? "loading",
    retry: () => setRetryCount((count) => count + 1),
  };
}

async function loadTimeline(
  patientId: string,
  controller: AbortController,
  activePatient: { current: string },
  setSnapshot: (snapshot: TimelineSnapshot) => void,
): Promise<void> {
  try {
    const data = await requestTimeline(patientId, controller.signal);
    if (!isCurrentPatientRequest(patientId, activePatient.current, controller.signal)) return;
    if (data) setSnapshot({ patientId, data, state: "ready" });
  } catch {
    if (isCurrentPatientRequest(patientId, activePatient.current, controller.signal)) {
      setSnapshot({ patientId, data: null, state: "error" });
    }
  }
}

function TimelineLoading(): ReactNode {
  return <div role="status" className="sa-meta">Loading the bound patient timeline…</div>;
}

function TimelineError({ retry }: { retry: () => void }): ReactNode {
  return <div className="sa-limitation" role="alert">
    Timeline unavailable. No events are shown from an incomplete response.
    <button type="button" style={buttonStyle} onClick={retry}>Retry timeline</button>
  </div>;
}

export function PatientTimelineContent({ data }: { data: PatientTimeline | null }): ReactNode {
  return <section aria-label="Patient timeline">
    <div className="sa-field-label">Record timeline · known as of {data?.known_as_of}</div>
    <div className="sa-meta" style={{ margin: "4px 0 14px" }}>
      These recorded events show when they happened, when the source recorded them, and when
      SAARTHI ingested them. A derived value is labelled explicitly.
    </div>
    {data?.total_events !== undefined && <p className="sa-meta">
      Showing {data.timeline.length} of {data.total_events} recorded events.
      {data.truncated && <> This view contains the latest {data.timeline_limit} events;
        older events are not displayed.</>}
    </p>}
    {data?.provenance_observed_at && <p className="sa-meta">
      Source links reflect the record at {data.provenance_observed_at}.
    </p>}
    {data?.timeline.length
      ? [...data.timeline].reverse().map((event) => <EventRow key={event.event_id} event={event} />)
      : <div className="sa-limitation">No timeline events were returned for this patient.</div>}
  </section>;
}

export function PatientTimelinePanel({ patientId }: { patientId: string }): ReactNode {
  const timeline = usePatientTimeline(patientId);
  if (timeline.state === "loading") return <TimelineLoading />;
  if (timeline.state === "error") return <TimelineError retry={timeline.retry} />;
  return <PatientTimelineContent data={timeline.data} />;
}
