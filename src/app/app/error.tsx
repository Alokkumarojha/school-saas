"use client";
import { Button } from "@/components/ui/button";
export default function OrganizationError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">
        Workspace temporarily unavailable
      </h1>
      <p className="my-4 text-sm text-muted-foreground">
        We could not load your organizations. Please try again later.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
