import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { requireOrganizationMembership } from "@/lib/organizations";
import { getDb } from "@/lib/db";

export class StudentAssignmentError extends Error {}
// FOR SHARE conflicts with UPDATE's row lock even when only status changes.
// Hold the lock through the student write/commit so deactivation cannot slip
// between validation and assignment. Call only with verified organization IDs.
export async function validateStudentGroup(
  tx: Prisma.TransactionClient, organizationId: string, groupId: string | null,
  currentGroupId: string | null = null,
) {
  if (!groupId) return;
  const [group] = await tx.$queryRaw<{ id: string; status: string }[]>`
    SELECT "id", "status" FROM "Group"
    WHERE "id" = ${groupId} AND "organizationId" = ${organizationId} FOR SHARE
  `;
  if (!group || (group.status !== "ACTIVE" && groupId !== currentGroupId)) {
    throw new StudentAssignmentError("Selected assignment is unavailable. Choose an active option or Unassigned.");
  }
}
export async function activeStudentGroups(organizationId: string) {
  const { organization, role } = await requireOrganizationMembership(organizationId);
  if (role !== "OWNER" && role !== "ADMIN") return [];
  return getDb().group.findMany({
    where: { organizationId: organization.id, status: "ACTIVE" },
    select: { id: true, name: true, section: true, status: true },
    orderBy: [{ name: "asc" }, { section: "asc" }, { id: "asc" }],
  });
}
