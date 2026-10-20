"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto mt-16 max-w-lg items-center px-8 py-8 text-center">
      <p className="text-sm font-semibold tracking-wide text-destructive uppercase">Something went wrong</p>
      <h1 className="text-xl font-semibold">This page could not be displayed</h1>
      <p className="text-sm text-muted-foreground">The scraper API may be busy or unreachable. Try again in a moment.</p>
      {error.digest ? <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      <Button size="lg" onClick={() => reset()}>
        Try again
      </Button>
    </Card>
  );
}
