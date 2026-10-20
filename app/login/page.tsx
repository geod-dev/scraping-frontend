import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "./actions";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  if (!process.env.DASHBOARD_PASSWORD) redirect("/");

  const { error, next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">CC</span>
          <div>
            <CardTitle>Competitor Catalog</CardTitle>
            <CardDescription>Scraper console</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
            <input type="hidden" name="next" value={next ?? "/"} />
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required autoFocus autoComplete="current-password" aria-invalid={error ? true : undefined} />
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  Incorrect password.
                </p>
              ) : null}
            </div>
            <Button type="submit" size="lg" className="w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
