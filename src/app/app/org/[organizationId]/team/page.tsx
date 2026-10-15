import Link from "next/link";
import { listTeam } from "@/lib/team";
import { TEAM_PAGE_SIZE } from "@/lib/team-validation";
import { InviteForm, MemberControls, RevokeInvite } from "@/components/team/team-controls";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Team", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";
export default async function TeamPage({ params, searchParams }: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ page?: string | string[]; invites?: string | string[] }>;
}) {
  const { organizationId } = await params;
  const data = await listTeam(organizationId, await searchParams);
  const base = `/app/org/${data.organization.id}/team`;
  const owner = data.role === "OWNER";
  const invitationPage = data.invitations?.page ?? 1;
  function pagination(page: number, total: number, kind: "page" | "invites") {
    const href = (next: number) => `${base}?${new URLSearchParams({ page: String(kind === "page" ? next : data.page), invites: String(kind === "invites" ? next : invitationPage) })}`;
    return <nav aria-label={kind === "page" ? "Member pages" : "Invitation pages"} className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      {page > 1 && <Button asChild variant="outline"><Link href={href(page - 1)}>Previous</Link></Button>}
      <span>Page {page} of {Math.max(1, Math.ceil(total / TEAM_PAGE_SIZE))} · {total} {kind === "page" ? "members" : "pending invitations"}</span>
      {page * TEAM_PAGE_SIZE < total && <Button asChild variant="outline"><Link href={href(page + 1)}>Next</Link></Button>}
    </nav>;
  }
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Team</h1><p className="mt-1 text-sm text-muted-foreground">Owners manage the team. Admins manage existing modules. Staff currently have view-only access.</p></div>
    <section aria-labelledby="members-heading"><h2 id="members-heading" className="mb-3 text-lg font-semibold">Members</h2>
      <div className="grid gap-3 lg:grid-cols-2">{data.members.map((member) => <Card key={member.clerkUserId} className="min-w-0 p-4">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0 [overflow-wrap:anywhere]"><h3 className="font-semibold">{member.profile.name}</h3><p className="mt-1 text-sm text-muted-foreground">{member.profile.email ?? "Profile unavailable"}</p></div>
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{member.role === "OWNER" ? "Owner" : member.role === "ADMIN" ? "Admin" : "Staff"}</span></div>
        {owner && member.role !== "OWNER" && <MemberControls key={member.revision} organizationId={data.organization.id} userId={member.clerkUserId} revision={member.revision} currentRole={member.role} />}
      </Card>)}</div>
      {!data.members.length && <p className="text-sm text-muted-foreground">No members to display.</p>}
      {pagination(data.page, data.total, "page")}
    </section>
    {owner && data.invitations && <>
      <Card className="p-4 sm:p-5"><h2 className="mb-2 text-lg font-semibold">Invite a team member</h2><p className="mb-4 text-sm text-muted-foreground">Links expire after 7 days. Nothing is sent automatically. If a link is lost or expired, revoke its pending invitation before creating another. Ownership changes are not supported.</p><InviteForm organizationId={data.organization.id} /></Card>
      <section aria-labelledby="invitations-heading"><h2 id="invitations-heading" className="mb-3 text-lg font-semibold">Pending invitations</h2>
        <div className="grid gap-3 lg:grid-cols-2">{data.invitations.items.map((invite) => <Card key={invite.id} className="min-w-0 space-y-2 p-4">
          <h3 className="font-semibold [overflow-wrap:anywhere]">{invite.email}</h3><p className="text-sm">{invite.role === "ADMIN" ? "Admin" : "Staff"}</p>
          <p className="text-sm text-muted-foreground">{invite.expired ? "Expired" : "Expires"}: {invite.expiresAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST</p>
          <RevokeInvite organizationId={data.organization.id} invitationId={invite.id} />
        </Card>)}</div>
        {!data.invitations.items.length && <p className="text-sm text-muted-foreground">No pending invitations. Create a link to add an admin or staff member.</p>}
        {pagination(data.invitations.page, data.invitations.total, "invites")}
      </section>
    </>}
  </div>;
}
