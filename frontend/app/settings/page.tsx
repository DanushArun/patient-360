import type { ReactNode } from "react";
import { Page, WorkspaceBar, WorkspaceNav } from "@/components/sa";
import { fetchPractitionerName } from "@/lib/census";
import { SettingsView } from "./settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage(): Promise<ReactNode> {
  const practitioner = await fetchPractitionerName().catch(() => "Practitioner");
  return <Page>
    <WorkspaceNav current="settings" practitioner={practitioner} />
    <WorkspaceBar section="Settings" knownAsOf="Saved in this browser" />
    <SettingsView practitioner={practitioner} />
  </Page>;
}
