import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { normalizeStudentPage, normalizeStudentSearch, normalizeStudentStatus, type StudentListContext } from "./student-list-context";

// Caller must first verify membership. Never accepts a destination URL or path.
export async function validateStudentReturn(verifiedOrganizationId: string, query: Record<string, unknown>): Promise<StudentListContext> {
  if (!["page", "q", "status", "groupId"].some(key => query[key] !== undefined)) return {};
  const groupId = query.groupId ?? "";
  if (typeof groupId !== "string" || (groupId !== "" && groupId !== "unassigned" && !z.string().cuid().safeParse(groupId).success)) notFound();
  if (groupId && groupId !== "unassigned") {
    const group = await getDb().group.findFirst({ where: { id: groupId, organizationId: verifiedOrganizationId }, select: { id: true } });
    if (!group) notFound();
  }
  return { page: String(normalizeStudentPage(query.page)), q: normalizeStudentSearch(query.q), status: normalizeStudentStatus(query.status), groupId };
}
export function studentReturnFields(form: FormData) {
  return Object.fromEntries(["page", "q", "status", "groupId"].map(key => {
    const values = form.getAll("return." + key);
    return [key, values.length === 0 ? undefined : values.length === 1 ? values[0] : values];
  }));
}
