"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonStyle } from "@/components/sa";
import type { PatientTimeline, TimelineEvent } from "@/lib/patient";

function Clock({ label, value }: { label: string; value: string }): ReactNode {
  return <div>
    <div className="sa-clock-label">{label}</div>
    <div className="sa-clock-value sa-num">{value || "Not recorded"}</div>
  </div>;
}

function EventRow({ event }: { event: TimelineEvent }): ReactNode {
  return <div className="sa-timeline-event">
    <div className="sa-timeline-title">
      {event.concept}{event.value !== null && <> · {event.value}</>}
    </div>
    <div className="sa-meta">
      <code>{event.event_id || "Event ID unavailable"}</code>
      {event.is_derived && " · Derived value"}
    </div>
    <div className="sa-clocks">
      <Clock label="Event time" value={event.event_time} />
      <Clock label="Source recorded" value={event.source_recorded_at} />
      <Clock label="Ingested" value={event.ingested_at} />
    </div>
  </div>;
}

export function PatientTimelinePanel({ patientId }: { patientId: string }): ReactNode {
  const [data, setData] = useState<PatientTimeline | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const attempted = useRef(false);
  async function load(): Promise<void> {
    setState("loading");
    try {
      const response = await fetch(
        `/api/patient/${encodeURIComponent(patientId)}/timeline`, { cache: "no-store" }
      );
      const result = await response.json() as PatientTimeline & { error?: string };
      if (!response.ok || result.error) throw new Error(result.error ?? "timeline_unavailable");
      setData(result);
      setState("ready");
    } catch {
      setState("error");
    }
  }
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    void load();
  }, [patientId]);
  if (state === "loading") return <div role="status" className="sa-meta">
    Loading the bound patient timeline…
  </div>;
  if (state === "error") return <div className="sa-limitation" role="alert">
    Timeline unavailable. No events are shown from an incomplete response.
    <button type="button" style={buttonStyle} onClick={() => void load()}>Retry timeline</button>
  </div>;
  return <section aria-label="Patient timeline">
    <div className="sa-field-label">Record timeline · known as of {data?.known_as_of}</div>
    <div className="sa-meta" style={{ margin: "4px 0 14px" }}>
      These recorded events show when they happened, when the source recorded them, and when
      SAARTHI ingested them. A derived value is labelled explicitly.
    </div>
    {data?.timeline.length
      ? [...data.timeline].reverse().map((event) => <EventRow key={event.event_id} event={event} />)
      : <div className="sa-limitation">No timeline events were returned for this patient.</div>}
  </section>;
}
