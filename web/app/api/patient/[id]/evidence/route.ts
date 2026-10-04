import { loadEvidenceHistory, prepareEvidencePacket } from "@/lib/patient";
import {
  apiError, apiErrorStatus, isSameOrigin, readJsonBody,
} from "@/lib/api-contracts.mjs";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return Response.json(await loadEvidenceHistory((await params).id));
  } catch (error) {
    // An outage is not "access withdrawn": only access-category codes purge patient state.
    const failure = apiError(error, "evidence_history_unavailable");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) {
    return Response.json(apiError("invalid_origin"), { status: 403 });
  }
  let input: { question: unknown; packetId: unknown };
  try {
    input = await readJsonBody(request) as typeof input;
  } catch (error) {
    const failure = apiError(error, "invalid_argument");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
  const { question, packetId } = input ?? {};
  if (typeof question !== "string" || !question.trim() || question.length > 4000 ||
    typeof packetId !== "string" || !/^[a-zA-Z0-9-]{8,80}$/.test(packetId)) {
    return Response.json(apiError("invalid_argument"), { status: 400 });
  }
  try {
    return Response.json(await prepareEvidencePacket((await params).id, question, packetId));
  } catch (error) {
    const failure = apiError(error, "packet_unavailable");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
}
