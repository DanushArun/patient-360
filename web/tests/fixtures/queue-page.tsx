import { ReviewQueueView } from "@/app/review-queue/review-queue-view";
import type { ReactNode } from "react";
import type { LiveReviewQueue, QueueTask } from "@/lib/review-queue.mjs";

export default function ControlledQueue(): ReactNode {
  const queue: LiveReviewQueue = {
    patients: [{ id: "PAT-DC-04", name: "Fatima Begum" }], otherTasks: [], unavailable: [],
    issues: [{ key: "ISSUE-1", patientId: "PAT-DC-04", patientName: "Fatima Begum",
      encounterId: "VISIT-1", scheduled: "2026-10-03T09:00:00", daysToVisit: 1,
      gate: "Authorization", ruleId: "COV-AUTH-001", ruleVersion: 1, outcome: "conflicting",
      severity: "blocker", reason: "Authorization dates disagree.",
      knownAsOf: "2026-10-01T09:42:00", tasks: [task("1", "open"),
        task("2", "evidence_received"), task("3", "closed")] }],
  };
  return <><p role="status">Synthetic controlled test service</p>
    <ReviewQueueView queue={queue} loadedAt="2026-10-01T10:02:00" /></>;
}

function task(id: string, state: string): QueueTask {
  return { taskId: `TASK-SYN-${id}`, issueId: "ISSUE-1", patientId: "PAT-DC-04",
    ruleId: "COV-AUTH-001", encounterId: "VISIT-1", ownerId: "P-1", owner: "Dr Meera Iyer",
    action: "escalate", reason: "Verify the authorization date against the issued letter.",
    state, createdAt: "2026-10-01T10:00:00" };
}
