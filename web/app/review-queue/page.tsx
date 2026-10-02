import ReviewQueueClient from "./review-queue-client";
import { readLiveReviewQueue } from "@/lib/review-queue.mjs";
import { withReadSession } from "@/lib/snowflake";
import { Page, WorkspaceNav } from "@/components/sa";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  try {
    const queue = await withReadSession(readLiveReviewQueue);
    return <ReviewQueueClient queue={queue} loadedAt={new Date().toISOString()} />;
  } catch {
    return <Page>
      <WorkspaceNav current="queue" />
      <header className="sa-screen-header"><div><p className="sa-eyebrow">Coordinator workspace</p><h1>Review queue</h1></div></header>
      <div className="sa-empty-state" role="alert"><strong>The review queue could not be loaded.</strong>
        <span>Check the Snowflake connection and care-team access, then try again.</span>
        <a href="/review-queue" className="sa-primary-action">Try again</a>
      </div>
    </Page>;
  }
}
