import { NextResponse, type NextRequest } from "next/server";
import { BASIC_CHALLENGE } from "./lib/request-auth";
import { parseBasicAuthorization } from "./lib/session-security";

// This only triggers the browser's login prompt. Snowflake validates every
// credential independently on each request; a syntactically valid header is
// not treated as an authenticated identity here.
export function proxy(request: NextRequest) {
  if (parseBasicAuthorization(request.headers.get("authorization"))) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  return new NextResponse("Professional Snowflake login required", {
    status: 401,
    headers: { "WWW-Authenticate": BASIC_CHALLENGE, "Cache-Control": "no-store" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
