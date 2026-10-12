"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { requireOrganizationMembership } from "@/lib/organizations";
import { groupLabels, groupSchema, type GroupState } from "@/lib/group-validation";

async function save(organizationId: string, groupId: string | null, form: FormData): Promise<GroupState> {
  const { organization, role } = await requireOrganizationMembership(organizationId);
  const { singular, plural } = groupLabels(organization.type);
  if (role !== "OWNER" && role !== "ADMIN") return { error: `Only owners and admins can manage ${plural.toLowerCase()}.` };
  const result = groupSchema.safeParse({ name: form.get("name"), section: form.get("section") ?? "", status: form.get("status") });
  if (!result.success) return { error: result.error.issues[0]?.message ?? "Check the form fields." };
  // Explicit allowlist: ownership/role/IDs from form fields are never accepted.
  const data = { name: result.data.name, section: result.data.section, status: result.data.status };
  try {
    if (groupId !== null) {
      const updated = await getDb().group.updateMany({ where: { id: groupId, organizationId: organization.id }, data });
      if (!updated.count) return { error: `${singular} unavailable in this organization.` };
    } else {
      await getDb().group.create({ data: { ...data, organizationId: organization.id } });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: `A ${singular.toLowerCase()} with this name and section already exists.` };
    }
    return { error: `Could not save the ${singular.toLowerCase()}. Please try again.` };
  }
  const path = `/app/org/${organization.id}/groups`;
  revalidatePath(path);
  redirect(path);
}
export async function createGroup(organizationId: string, _state: GroupState, form: FormData): Promise<GroupState> {
  return save(organizationId, null, form);
}
export async function updateGroup(organizationId: string, groupId: string, _state: GroupState, form: FormData): Promise<GroupState> {
  return save(organizationId, groupId, form);
}
