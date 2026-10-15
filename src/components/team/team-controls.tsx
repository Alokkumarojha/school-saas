"use client";
import { useActionState, useState } from "react";
import { createInvitation, revokeInvitation, updateMember } from "@/app/app/org/[organizationId]/team/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TeamState } from "@/lib/team-validation";

const selectClass = "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm";
function Feedback({ state }: { state: TeamState }) {
  return <>{state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</p>}{state.success && <p role="status" className="text-sm text-primary">{state.success}</p>}</>;
}
export function InviteForm({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState(createInvitation.bind(null, organizationId), {});
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STAFF");
  const [copied, setCopied] = useState(false);
  return <form action={action} className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm font-medium">Email<Input name="email" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" /></label>
      <label className="space-y-1 text-sm font-medium">Role<select className={selectClass} name="role" value={role} onChange={(event) => setRole(event.target.value)}><option value="STAFF">Staff — view only</option><option value="ADMIN">Admin</option></select></label>
    </div>
    <Button disabled={pending} onClick={() => setCopied(false)}>{pending ? "Creating invitation…" : "Create invitation link"}</Button>
    <Feedback state={state} />
    {state.link && <div className="space-y-2 rounded-xl bg-muted p-3">
      <label className="block text-sm font-medium">Invitation link<Input aria-label="Invitation link" readOnly value={state.link} onFocus={(event) => event.target.select()} /></label>
      <Button type="button" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(state.link!); setCopied(true); } catch { setCopied(false); } }}>Copy link</Button>
      <p role="status" className="text-xs text-muted-foreground">{copied ? "Link copied." : "Select and copy the link manually if clipboard access is unavailable. Share it privately with the intended recipient."}</p>
    </div>}
  </form>;
}
export function RevokeInvite({ organizationId, invitationId }: { organizationId: string; invitationId: string }) {
  const [state, action, pending] = useActionState(revokeInvitation.bind(null, organizationId, invitationId), {});
  return <form action={action} className="space-y-2"><Button variant="outline" disabled={pending}>{pending ? "Revoking…" : "Revoke invitation"}</Button><Feedback state={state} /></form>;
}
export function MemberControls({ organizationId, userId, revision, currentRole }: { organizationId: string; userId: string; revision: string; currentRole: "ADMIN" | "STAFF" }) {
  const [state, action, pending] = useActionState(updateMember.bind(null, organizationId, userId, revision), {});
  const [role, setRole] = useState(currentRole);
  const [confirmed, setConfirmed] = useState(false);
  return <form action={action} className="mt-3 space-y-3 border-t border-border pt-3">
    <label className="block space-y-1 text-sm font-medium">Member role<select className={selectClass} name="role" value={role} onChange={(event) => setRole(event.target.value as "ADMIN" | "STAFF")}><option value="ADMIN">Admin</option><option value="STAFF">Staff — view only</option></select></label>
    <Button variant="outline" name="operation" value="role" disabled={pending}>{pending ? "Saving…" : "Save role"}</Button>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="confirmed" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="size-5 shrink-0" />I confirm removing this member’s organization access.</label>
    <Button variant="outline" name="operation" value="remove" disabled={pending || !confirmed}>Remove member</Button>
    <Feedback state={state} />
  </form>;
}
