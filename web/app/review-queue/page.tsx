import type { ReactNode } from "react";
import { withUiReadDeadline } from "@/lib/ui-read-deadline.mjs";
import { loadReviewQueue } from "@/lib/workspace-read";
import { invalidatePatient, WORKSPACE_SCOPE } from "@/lib/read-cache";
import { ReviewQueueFailure, ReviewQueueView } from "./review-queue-view";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage({ searchParams }: PageProps<"/review-queue">)
  : Promise<ReactNode> {
  // "Refresh queue" asks for a fresh read, never the cached copy.
  if ((await searchParams).refresh === "1") invalidatePatient(WORKSPACE_SCOPE);
  try {
    const { queue, loadedAt } = await withUiReadDeadline(loadReviewQueue());
    return <ReviewQueueView queue={queue} loadedAt={loadedAt} />;
  } catch {
    return <ReviewQueueFailure />;
  }
}
