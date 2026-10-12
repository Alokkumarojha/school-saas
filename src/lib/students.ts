import { normalizeStudentPage, normalizeStudentSearch, normalizeStudentStatus } from "./student-list-context";
import { notFound } from "next/navigation";
import { z } from "zod";
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { requireOrganizationMembership } from "@/lib/organizations";

export const STUDENTS_PER_PAGE = 20;
export type StudentQuery = { q?: string | string[]; status?: string | string[]; groupId?: string | string[] };

export async function listOrganizationStudents(
  organizationId: string,
  requestedPage: string | string[] | undefined,
  query: StudentQuery = {},
) {
  const { organization, role } = await requireOrganizationMembership(organizationId);
  const q = normalizeStudentSearch(query.q);
  const status = normalizeStudentStatus(query.status);
  const groupId = query.groupId ?? "";
  if (typeof groupId !== "string" || (groupId !== "" && groupId !== "unassigned" && !z.string().cuid().safeParse(groupId).success)) notFound();
  const groups = await getDb().group.findMany({
    where: { organizationId: organization.id },
    select: { id: true, name: true, section: true, status: true },
    orderBy: [{ name: "asc" }, { section: "asc" }, { id: "asc" }],
  });
  if (groupId && groupId !== "unassigned" && !groups.some(group => group.id === groupId)) notFound();
  const filtered = Boolean(q || status !== "ALL" || groupId);
  // Prisma contains uses LIKE: escape its metacharacters for literal partial matching.
  const contains = q.replace(/[\\%_]/g, "\\$&");
  const where: Prisma.StudentWhereInput = {
    organizationId: organization.id,
    ...(groupId ? { groupId: groupId === "unassigned" ? null : groupId } : {}),
    ...(status !== "ALL" ? { status } : {}),
    ...(q ? { OR: [
      { name: { contains, mode: "insensitive" } },
      { admissionNumber: { contains, mode: "insensitive" } },
    ] } : {}),
  };
  const db = getDb();
  const total = await db.student.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / STUDENTS_PER_PAGE));
  const page = Math.min(normalizeStudentPage(requestedPage), totalPages);
  const students = await db.student.findMany({
    where,
    select: {
      id: true, admissionNumber: true, name: true,
      guardianName: true, guardianPhone: true, status: true,
      group: { select: { id: true, name: true, section: true, status: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * STUDENTS_PER_PAGE,
    take: STUDENTS_PER_PAGE,
  });
  return { organization, role, students, total, page, totalPages, q, status, filtered, groupId, groups };
}
