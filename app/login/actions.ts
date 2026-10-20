"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, passwordMatches, safeRedirectPath, sessionToken } from "@/lib/auth";

export async function login(formData: FormData) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) redirect("/");

  const next = safeRedirectPath(formData.get("next"));
  const password = formData.get("password");
  if (typeof password !== "string" || !(await passwordMatches(password, expected))) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await sessionToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(next);
}
