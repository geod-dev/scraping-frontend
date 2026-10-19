import { NextResponse, type NextRequest } from "next/server";

// Optional password gate for the whole dashboard (HTTP Basic auth).
// Enabled only when DASHBOARD_PASSWORD is set, so local development stays open.
// Username can be anything; the password must match DASHBOARD_PASSWORD.

function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

function decodeBasicPassword(header: string): string | null {
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return null;
  try {
    const decoded = atob(encoded);
    const separator = decoded.indexOf(":");
    return separator === -1 ? null : decoded.slice(separator + 1);
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return NextResponse.next();

  const header = request.headers.get("authorization");
  const provided = header ? decodeBasicPassword(header) : null;
  if (provided !== null && constantTimeEqual(provided, expected)) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Scraper dashboard", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
