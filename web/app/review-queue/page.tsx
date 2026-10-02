import type { ReactNode } from "react";
import { readLiveReviewQueue } from "@/lib/review-queue.mjs";
import { withUiReadDeadline } from "@/lib/ui-read-deadline.mjs";
import { withReadSession } from "@/lib/snowflake";
import { ReviewQueueFailure, ReviewQueueView } from "./review-queue-view";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage(): Promise<ReactNode> {
  try {
    const queue = await withUiReadDeadline(withReadSession(readLiveReviewQueue));
    return <ReviewQueueView queue={queue} loadedAt={new Date().toISOString()} />;
  } catch {
    return <ReviewQueueFailure />;
  }
}
