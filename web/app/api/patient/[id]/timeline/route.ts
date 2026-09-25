import { loadPatientTimeline } from "@/lib/patient";
import { createPatientGet } from "@/lib/session-security";

export const dynamic = "force-dynamic";

export const GET = createPatientGet(loadPatientTimeline, "timeline_unavailable");
