import { apiError, apiErrorStatus } from "@/lib/api-contracts.mjs";
import { loadSchemes } from "@/lib/workspace-read";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await loadSchemes(id));
  } catch (error) {
    // Fixed code set only: driver and procedure text never reaches the client.
    const failure = apiError(error, "schemes_unavailable");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
}
