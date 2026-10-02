import Link from "next/link";
import { withPatientSession, procedureRows } from "@/lib/snowflake";
import { Page } from "@/components/sa";
export const dynamic = "force-dynamic";
export default async function DocumentPage({params,searchParams}: {
  params:Promise<{id:string;doc:string}>;
  searchParams:Promise<{page?:string;start?:string;end?:string}>;
}) {
  const {id,doc}=await params; const query=await searchParams;
  try {
    const pages=await withPatientSession(id,async run=>procedureRows(await run(
      "CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('document',?)",[doc])));
    const page=pages.find(p=>Number(p.PAGE_INDEX)===Number(query.page ?? 0));
    if(!page) throw new Error("source_unavailable");
    const text=String(page.TEXT ?? "");
    const start=Number(query.start),end=Number(query.end);
    const highlight=Number.isInteger(start)&&Number.isInteger(end)&&start>=0&&end>start&&end<=text.length;
    return <Page><Link href={`/patient/${encodeURIComponent(id)}`} prefetch={false}>← Patient record</Link>
      <header className="sa-screen-header"><div><p className="sa-eyebrow">Patient document evidence</p><h1>Source page {Number(page.PAGE_INDEX)+1}</h1>
        <p>{id} · {doc} · version {String(page.VERSION)}</p></div></header>
      <p className="sa-meta">Event time: {String(page.EVENT_TIME ?? "Not recorded")} · Source recorded: {String(page.SOURCE_RECORDED_AT ?? "Not recorded")} · Ingested: {String(page.INGESTED_AT ?? "Not recorded")}</p>
      <p className="sa-meta">Extracted source text. Highlighting identifies the cited span, not a clinical interpretation.</p>
      <pre className="sa-page-text" style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{highlight ? <>{text.slice(0,start)}<mark>{text.slice(start,end)}</mark>{text.slice(end)}</> : text}</pre>
    </Page>;
  } catch {
    return <Page><h1>Source page unavailable</h1><p>The page is absent or your current patient access does not permit viewing it.</p><Link href={`/patient/${encodeURIComponent(id)}`}>Return to patient record</Link></Page>;
  }
}
