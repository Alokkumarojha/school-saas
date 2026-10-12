import "server-only";
import { getDb } from "@/lib/db";
import { requireOrganizationMembership } from "@/lib/organizations";
import { notFound } from "next/navigation";

export async function listOrganizationGroups(organizationId: string, requestedPage?: string | string[]) {
  const { organization, role } = await requireOrganizationMembership(organizationId);
  const where = { organizationId: organization.id };
  const total = await getDb().group.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const parsed = typeof requestedPage === "string" && /^[1-9]\d*$/.test(requestedPage) ? Number(requestedPage) : 1;
  const page = Number.isSafeInteger(parsed) ? Math.min(parsed, totalPages) : 1;
  const groups = await getDb().group.findMany({
    where, select: { id: true, name: true, section: true, status: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20,
  });
  return { organization, role, groups, total, totalPages, page };
}
export async function getEditableGroup(organizationId: string, groupId: string) {
  const membership = await requireOrganizationMembership(organizationId);
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") notFound();
  const group = await getDb().group.findFirst({
    where: { id: groupId, organizationId: membership.organization.id },
    select: { id: true, name: true, section: true, status: true },
  });
  if (!group) notFound();
  return { ...membership, group };
}
