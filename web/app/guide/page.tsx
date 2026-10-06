import type { ReactNode } from "react";
import { Page, WorkspaceBar, WorkspaceNav } from "@/components/sa";
import { fetchPractitionerName } from "@/lib/census";
import { GuideDirectory } from "./guide-view";

export const dynamic = "force-dynamic";

export default async function GuidePage(): Promise<ReactNode> {
  const practitioner = await fetchPractitionerName().catch(() => "Practitioner");
  return <Page>
    <WorkspaceNav current="guide" practitioner={practitioner} />
    <WorkspaceBar section="Guide" knownAsOf="Synthetic data only" />
    <GuideDirectory />
  </Page>;
}
