import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <Card className="mx-auto mt-16 max-w-lg items-center px-8 py-8 text-center">
      <p className="text-sm font-semibold tracking-wide text-primary uppercase">404</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">The item you are looking for does not exist or was removed.</p>
      <Link href="/" className={buttonVariants({ size: "lg" })}>
        Back to overview
      </Link>
    </Card>
  );
}
