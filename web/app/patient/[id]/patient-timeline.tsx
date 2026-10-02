"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
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

function EventRow({ event, patientId, knownAsOf }: {
  event: TimelineEvent; patientId?: string; knownAsOf?: string;
}): ReactNode {
  return <details open className="sa-timeline-event">
    <summary className="sa-timeline-title">
      {event.concept}{event.value !== null && <> · {event.value} {event.unit}</>}
      {event.value_text && <> · {event.value_text}</>}
    </summary>
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
    <EventSources event={event} patientId={patientId} knownAsOf={knownAsOf} />
  </details>;
}

function EventSources({ event, patientId, knownAsOf }: {
  event: TimelineEvent; patientId?: string; knownAsOf?: string;
}): ReactNode {
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
    {patientId && knownAsOf && event.source_document_ids?.map((docId) => <div key={docId}>
      <Link prefetch={false} href={`/patient/${encodeURIComponent(patientId)}/documents/`
        + `${encodeURIComponent(docId)}?${new URLSearchParams({
          known_as_of: knownAsOf, return: "timeline",
        })}`}>Open document {docId}</Link>
    </div>)}
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
    `/api/patient/${encodeURIComponent(patientId)}/timeline`, { cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) },
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

type TimelineClock = "event_time" | "source_recorded_at" | "ingested_at";

export function PatientTimelineContent({ data, patientId }: {
  data: PatientTimeline | null; patientId?: string;
}): ReactNode {
  const [clock, setClock] = useState<TimelineClock>("event_time");
  const [source, setSource] = useState("all");
  const events = (data?.timeline ?? []).filter((event) => matchesSource(event, source))
    .sort((a, b) => String(b[clock] ?? "").localeCompare(String(a[clock] ?? "")));
  return <section aria-label="Patient timeline">
    <TimelineHeading data={data} />
    <div className="sa-timeline-filters">
      <label>Source type<select value={source} onChange={(event) => setSource(event.target.value)}>
        <option value="all">All recorded events</option>
        <option value="document">Document backed</option>
        <option value="derived">Derived values</option>
        <option value="unlinked">No linked document</option>
      </select></label>
      <label>Order by<select value={clock}
        onChange={(event) => setClock(event.target.value as TimelineClock)}>
        <option value="event_time">Event time</option>
        <option value="source_recorded_at">Source recorded</option>
        <option value="ingested_at">Ingested</option>
      </select></label>
    </div>
    {events.length ? events.map((event) => <EventRow key={event.event_id} event={event}
      patientId={patientId} knownAsOf={data?.known_as_of} />)
      : <p className="sa-limitation" role="status">{data?.timeline.length
        ? "No events match this source filter."
        : "No timeline events were returned for this patient."}</p>}
  </section>;
}

function matchesSource(event: TimelineEvent, source: string): boolean {
  if (source === "document") return Boolean(event.source_document_ids?.length);
  if (source === "derived") return event.is_derived;
  if (source === "unlinked") return !event.source_document_ids?.length;
  return true;
}

function TimelineHeading({ data }: { data: PatientTimeline | null }): ReactNode {
  return <header className="sa-timeline-heading">
    <h2>Record timeline</h2>
    <p className="sa-meta">Snapshot known as of {data?.known_as_of ?? "Not available"}.</p>
    <p className="sa-meta">Three clocks remain visible for each event. Changing the order
      does not recompute the snapshot or reconstruct a historical rule result.</p>
    {data?.total_events !== undefined && <p className="sa-meta">
      Showing {data.timeline.length} of {data.total_events} recorded events.
      {data.truncated && <> This view contains the latest {data.timeline_limit} events;
        older events are not displayed.</>}
    </p>}
    {data?.provenance_observed_at && <p className="sa-meta">
      Source links reflect the record at {data.provenance_observed_at}.
    </p>}
  </header>;
}

export function PatientTimelinePanel({ patientId }: { patientId: string }): ReactNode {
  const timeline = usePatientTimeline(patientId);
  if (timeline.state === "loading") return <TimelineLoading />;
  if (timeline.state === "error") return <TimelineError retry={timeline.retry} />;
  return <PatientTimelineContent data={timeline.data} patientId={patientId} />;
}
