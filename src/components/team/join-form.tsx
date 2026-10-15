"use client";
import { useActionState } from "react";
import { joinOrganization } from "@/app/join/actions";
import { Button } from "@/components/ui/button";

export function JoinForm({ invitationId, accepted }: { invitationId: string; accepted: boolean }) {
  const [state, action, pending] = useActionState(joinOrganization.bind(null, invitationId), {});
  return <form action={action} className="space-y-3">
    <Button disabled={pending}>{pending ? "Checking membership…" : accepted ? "Open organization" : "Join organization"}</Button>
    {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</p>}
  </form>;
}
