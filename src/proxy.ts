import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "sb_guest";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Anonymous guest sessions: every visitor gets a random, httpOnly cookie on their
 * first request. No login, no PII — all progress is keyed by this id server-side.
 */
export function proxy(request: NextRequest) {
  const existing = request.cookies.get(COOKIE)?.value;
  if (existing && UUID_RE.test(existing)) return NextResponse.next();

  const id = crypto.randomUUID();
  // Make the new id visible to Server Components rendering this same request.
  request.cookies.set(COOKIE, id);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|samples/|icon|apple-icon|robots.txt|api/stripe/webhook).*)",
  ],
};
