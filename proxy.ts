import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, constantTimeEqual, sessionToken } from "@/lib/auth";

// Optional password gate for the whole dashboard.
// Enabled only when DASHBOARD_PASSWORD is set, so local development stays open.
// Requests without a valid session cookie are redirected to /login.

export async function proxy(request: NextRequest) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return NextResponse.next();

  if (request.nextUrl.pathname === "/login") return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (session && constantTimeEqual(session, await sessionToken(expected))) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
