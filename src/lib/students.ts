import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { requireOrganizationMembership } from "@/lib/organizations";

export const STUDENTS_PER_PAGE = 20;
export type StudentQuery = { q?: string | string[]; status?: string | string[] };

export async function listOrganizationStudents(
  organizationId: string,
  requestedPage: string | string[] | undefined,
  query: StudentQuery = {},
) {
  const { organization, role } = await requireOrganizationMembership(organizationId);
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
  const status = query.status === "ACTIVE" || query.status === "INACTIVE" ? query.status : "ALL";
  const filtered = Boolean(q || status !== "ALL");
  // Prisma contains uses LIKE: escape its metacharacters for literal partial matching.
  const contains = q.replace(/[\\%_]/g, "\\$&");
  const where: Prisma.StudentWhereInput = {
    organizationId: organization.id,
    ...(status !== "ALL" ? { status } : {}),
    ...(q ? { OR: [
      { name: { contains, mode: "insensitive" } },
      { admissionNumber: { contains, mode: "insensitive" } },
    ] } : {}),
  };
  const db = getDb();
  const total = await db.student.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / STUDENTS_PER_PAGE));
  const numericPage = typeof requestedPage === "string" && /^[1-9]\d*$/.test(requestedPage)
    ? Number(requestedPage)
    : 1;
  const page = Number.isSafeInteger(numericPage)
    ? Math.min(numericPage, totalPages)
    : 1;
  const students = await db.student.findMany({
    where,
    select: {
      id: true, admissionNumber: true, name: true,
      guardianName: true, guardianPhone: true, status: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * STUDENTS_PER_PAGE,
    take: STUDENTS_PER_PAGE,
  });
  return { organization, role, students, total, page, totalPages, q, status, filtered };
}

