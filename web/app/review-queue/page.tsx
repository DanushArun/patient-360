import ReviewQueueClient, { type Issue } from "./review-queue-client";
import queue from "../../../frontend/fixtures/review_queue.json";

export default function ReviewQueuePage() {
  return <ReviewQueueClient initialIssues={queue.issues as Issue[]} />;
}
