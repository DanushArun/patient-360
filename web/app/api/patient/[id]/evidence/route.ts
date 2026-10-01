import { loadEvidenceHistory, prepareEvidencePacket } from "@/lib/patient";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  try { return Response.json(await loadEvidenceHistory((await params).id)); }
  catch { return Response.json({error: "evidence_history_unavailable"}, {status: 403}); }
}
export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({error: "invalid_origin"}, {status:403});
  try {
    const {question, packetId} = await request.json();
    if (typeof question !== "string" || !question.trim() || question.length>4000 ||
      typeof packetId !== "string" || !/^[a-zA-Z0-9-]{8,80}$/.test(packetId))
      return Response.json({error:"invalid_argument"}, {status:400});
    return Response.json(await prepareEvidencePacket((await params).id, question, packetId));
  } catch { return Response.json({error:"packet_unavailable"}, {status:409}); }
}
