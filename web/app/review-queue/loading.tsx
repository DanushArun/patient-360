import { Page, WorkspaceNav } from "@/components/sa";

export default function ReviewQueueLoading() {
  return <Page><WorkspaceNav current="queue" />
    <header className="sa-screen-header"><div><p className="sa-eyebrow">Coordinator workspace</p><h1>Review queue</h1></div></header>
    <div className="sa-empty-state" role="status" aria-busy="true">Loading patient readiness and review tasks…</div>
  </Page>;
}
