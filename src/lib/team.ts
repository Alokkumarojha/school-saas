import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { requireOrganizationMembership } from "@/lib/organizations";
import { inviteSchema, memberChangeSchema, TEAM_PAGE_SIZE, teamPage } from "@/lib/team-validation";
import { createInvitationSecret, INVALID_INVITATION } from "@/lib/team-invitation-security";
import { teamProfiles, verifiedTeamEmails } from "@/lib/team-identity";

export class TeamError extends Error {}
const unavailable = "This team action is unavailable. Reload the page and check your access.";
const duplicate = "A pending invitation already exists for this email. Revoke it before issuing a new link, including if it has expired.";

async function lockOrganization(tx: Prisma.TransactionClient, organizationId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`;
  if (!rows.length) throw new TeamError(unavailable);
}
async function ownerTransaction<T>(organizationId: string, work: (tx: Prisma.TransactionClient, verifiedId: string, userId: string) => Promise<T>) {
  const userId = await requireUserId();
  if (!z.string().cuid().safeParse(organizationId).success) throw new TeamError(unavailable);
  return getDb().$transaction(async (tx) => {
    // All team writes: Organization first, then membership/invitation. The role
    // is read AFTER taking the lock, so open management forms cannot bypass it.
    await lockOrganization(tx, organizationId);
    const actor = await tx.membership.findUnique({ where: { organizationId_clerkUserId: { organizationId, clerkUserId: userId } } });
    if (!actor || actor.role !== "OWNER") throw new TeamError(unavailable);
    return work(tx, actor.organizationId, userId);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

export async function inviteTeamMember(organizationId: string, input: unknown) {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) throw new TeamError(parsed.error.issues[0]?.message ?? "Check the invitation fields.");
  try {
    return await ownerTransaction(organizationId, async (tx, verifiedId, userId) => {
      const existing = await tx.teamInvitation.findFirst({ where: { organizationId: verifiedId, email: parsed.data.email, status: "PENDING" }, select: { id: true } });
      if (existing) throw new TeamError(duplicate);
      const secret = createInvitationSecret();
      const invite = await tx.teamInvitation.create({ data: {
        organizationId: verifiedId, ...parsed.data, tokenHash: secret.tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), createdByClerkUserId: userId,
      } });
      await tx.teamAudit.create({ data: { organizationId: verifiedId, actorClerkUserId: userId, event: "INVITED", invitationId: invite.id, nextRole: invite.role } });
      return { organizationId: verifiedId, link: secret.link };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new TeamError(duplicate);
    throw error;
  }
}

export async function revokeTeamInvitation(organizationId: string, invitationId: string) {
  if (!z.string().cuid().safeParse(invitationId).success) throw new TeamError(unavailable);
  return ownerTransaction(organizationId, async (tx, verifiedId, userId) => {
    const invite = await tx.teamInvitation.findFirst({ where: { id: invitationId, organizationId: verifiedId, status: "PENDING" } });
    if (!invite) throw new TeamError(unavailable);
    await tx.teamInvitation.update({ where: { id: invite.id, organizationId: verifiedId }, data: { status: "REVOKED", revokedAt: new Date() } });
    await tx.teamAudit.create({ data: { organizationId: verifiedId, actorClerkUserId: userId, event: "INVITE_REVOKED", invitationId: invite.id } });
    return verifiedId;
  });
}

export async function changeTeamMember(organizationId: string, input: unknown) {
  const parsed = memberChangeSchema.safeParse(input);
  if (!parsed.success) throw new TeamError("Invalid member change. Reload and try again.");
  return ownerTransaction(organizationId, async (tx, verifiedId, userId) => {
    const { targetUserId, revision, operation, role, confirmed } = parsed.data;
    const where = { organizationId_clerkUserId: { organizationId: verifiedId, clerkUserId: targetUserId } };
    const target = await tx.membership.findUnique({ where });
    if (!target || target.role === "OWNER" || target.clerkUserId === userId) throw new TeamError(unavailable);
    if (target.revision !== revision) throw new TeamError("This membership has changed. Reload before making another change.");
    if (operation === "remove") {
      if (!confirmed) throw new TeamError("Confirm removal before continuing.");
      // Delete only membership; historical author IDs and module records remain.
      await tx.membership.delete({ where });
    } else {
      if (target.role === role) return verifiedId;
      await tx.membership.update({ where, data: { role, revision: randomUUID() } });
    }
    await tx.teamAudit.create({ data: {
      organizationId: verifiedId, actorClerkUserId: userId, targetClerkUserId: target.clerkUserId,
      event: operation === "remove" ? "MEMBER_REMOVED" : "MEMBER_ROLE_CHANGED",
      previousRole: target.role, nextRole: operation === "remove" ? null : role,
    } });
    return verifiedId;
  });
}

export async function listTeam(organizationId: string, query: { page?: string | string[]; invites?: string | string[] }) {
  const { organization, role } = await requireOrganizationMembership(organizationId);
  const db = getDb();
  const result = await db.$transaction(async (tx) => {
    const total = await tx.membership.count({ where: { organizationId: organization.id } });
    const page = Math.min(teamPage(query.page), Math.max(1, Math.ceil(total / TEAM_PAGE_SIZE)));
    const members = await tx.membership.findMany({ where: { organizationId: organization.id },
      select: { clerkUserId: true, role: true, revision: true }, orderBy: [{ createdAt: "asc" }, { clerkUserId: "asc" }], take: TEAM_PAGE_SIZE, skip: (page - 1) * TEAM_PAGE_SIZE });
    const invitations = role === "OWNER" ? await pendingInvitations(tx, organization.id, teamPage(query.invites)) : null;
    return { total, page, members, invitations };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  const profiles = await teamProfiles(result.members.map((member) => member.clerkUserId));
  return { organization, role, ...result, members: result.members.map((member) => ({ ...member, profile: profiles.get(member.clerkUserId) ?? { name: "Team member", email: null } })) };
}
async function pendingInvitations(tx: Prisma.TransactionClient, organizationId: string, requestedPage: number) {
  const where = { organizationId, status: "PENDING" as const };
  const total = await tx.teamInvitation.count({ where });
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / TEAM_PAGE_SIZE)));
  const items = await tx.teamInvitation.findMany({ where, select: { id: true, email: true, role: true, expiresAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * TEAM_PAGE_SIZE, take: TEAM_PAGE_SIZE });
  const now = Date.now();
  return { total, page, items: items.map(item => ({ ...item, expired: item.expiresAt.getTime() <= now })) };
}

async function verifiedInvitationIdentity() {
  const userId = await requireUserId();
  try { return { userId, emails: await verifiedTeamEmails(userId) }; }
  catch { throw new TeamError(INVALID_INVITATION); }
}
function validHash(hash: string) {
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new TeamError(INVALID_INVITATION);
}
export async function previewTeamInvitation(hash: string) {
  validHash(hash);
  const { userId, emails } = await verifiedInvitationIdentity();
  const invite = await getDb().teamInvitation.findUnique({ where: { tokenHash: hash }, include: { organization: { select: { name: true } } } });
  if (!invite || !emails.includes(invite.email) || invite.status === "REVOKED" ||
    invite.expiresAt.getTime() <= Date.now() ||
    (invite.status === "ACCEPTED" && invite.acceptedByClerkUserId !== userId)) throw new TeamError(INVALID_INVITATION);
  if (invite.status === "ACCEPTED") {
    const member = await getDb().membership.findUnique({ where: { organizationId_clerkUserId: { organizationId: invite.organizationId, clerkUserId: userId } } });
    if (!member) throw new TeamError(INVALID_INVITATION);
  }
  return { id: invite.id, name: invite.organization.name, role: invite.role, accepted: invite.status === "ACCEPTED" };
}

export async function acceptTeamInvitation(hash: string, expectedInvitationId: string) {
  validHash(hash);
  const { userId, emails } = await verifiedInvitationIdentity();
  const db = getDb();
  const initial = await db.teamInvitation.findUnique({ where: { tokenHash: hash }, select: { organizationId: true } });
  if (!initial) throw new TeamError(INVALID_INVITATION);
  return db.$transaction(async (tx) => {
    await lockOrganization(tx, initial.organizationId);
    const invite = await tx.teamInvitation.findUnique({ where: { tokenHash: hash } });
    if (!invite || invite.id !== expectedInvitationId || invite.organizationId !== initial.organizationId ||
      !emails.includes(invite.email) || invite.status === "REVOKED" || invite.expiresAt.getTime() <= Date.now()) throw new TeamError(INVALID_INVITATION);
    const key = { organizationId: invite.organizationId, clerkUserId: userId };
    const member = await tx.membership.findUnique({ where: { organizationId_clerkUserId: key } });
    if (invite.status === "ACCEPTED") {
      // Never recreate a removed membership from an already-consumed token.
      if (invite.acceptedByClerkUserId !== userId || !member) throw new TeamError(INVALID_INVITATION);
      return invite.organizationId;
    }
    if (!member) await tx.membership.create({ data: { ...key, role: invite.role } });
    await tx.teamInvitation.update({ where: { id: invite.id, organizationId: invite.organizationId }, data: { status: "ACCEPTED", acceptedByClerkUserId: userId, acceptedAt: new Date() } });
    await tx.teamAudit.create({ data: { organizationId: invite.organizationId, actorClerkUserId: userId, targetClerkUserId: userId,
      event: "INVITE_ACCEPTED", invitationId: invite.id, previousRole: member?.role ?? null, nextRole: member?.role ?? invite.role } });
    return invite.organizationId;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
