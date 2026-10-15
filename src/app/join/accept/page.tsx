import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { previewTeamInvitation } from "@/lib/team";
import { INVALID_INVITATION, INVITATION_COOKIE, readInvitationSeal } from "@/lib/team-invitation-security";
import { JoinForm } from "@/components/team/join-form";

export default async function AcceptInvitationPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=%2Fjoin%2Faccept");
  let invitation;
  try {
    const hash = readInvitationSeal((await cookies()).get(INVITATION_COOKIE)?.value);
    if (hash) invitation = await previewTeamInvitation(hash);
  } catch { /* Do not disclose invite details or log token-bearing requests. */ }
  if (!invitation) return <><h1 className="text-xl font-bold">Invitation unavailable</h1><p className="text-sm text-muted-foreground">{INVALID_INVITATION} If your invitation session expired, reopen the original link.</p><Link href="/app" className="inline-flex min-h-11 items-center font-semibold text-primary">Your organizations and account</Link></>;
  return <><h1 className="text-xl font-bold [overflow-wrap:anywhere]">{invitation.accepted ? "Invitation accepted" : "Join"} · {invitation.name}</h1>
    <p className="text-sm text-muted-foreground">Invitation role: {invitation.role === "ADMIN" ? "Admin" : "Staff (view only)"}. If you already belong to this organization, your current role will stay unchanged.</p>
    <p className="text-sm">Opening this page does not join the organization. Continue below when you are ready.</p>
    <JoinForm invitationId={invitation.id} accepted={invitation.accepted} />
  </>;
}
