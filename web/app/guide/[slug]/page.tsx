import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Page, WorkspaceBar, WorkspaceNav } from "@/components/sa";
import { fetchPractitionerName } from "@/lib/census";
import { guideBySlug } from "@/lib/guides";
import { GuideArticle } from "../guide-view";

export const dynamic = "force-dynamic";

export default async function GuideArticlePage({ params }: PageProps<"/guide/[slug]">)
  : Promise<ReactNode> {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();
  const practitioner = await fetchPractitionerName().catch(() => "Practitioner");
  return <Page>
    <WorkspaceNav current="guide" practitioner={practitioner} />
    <WorkspaceBar section={guide.title} knownAsOf="Synthetic data only" />
    <GuideArticle guide={guide} />
  </Page>;
}
