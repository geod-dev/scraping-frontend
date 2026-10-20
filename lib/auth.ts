// Password gate helpers shared by proxy.ts and the login action.
// The browser only ever holds a digest derived from DASHBOARD_PASSWORD, never the password.
// Changing the password changes the digest, which invalidates every existing session.

export const SESSION_COOKIE = "dashboard_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

export async function sessionToken(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`dashboard-session:${password}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Both sides are hashed first, so the comparison always runs on equal-length strings.
export async function passwordMatches(input: string, expected: string): Promise<boolean> {
  return constantTimeEqual(await sessionToken(input), await sessionToken(expected));
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Only same-site relative paths are allowed, so the login redirect cannot be abused.
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  if (value === "/login" || value.startsWith("/login?")) return "/";
  return value;
}
