import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { notFound } from "next/navigation";
import { getDb } from "./db";
import { requireOrganizationMembership } from "./organizations";
import { ATTENDANCE_PAGE_SIZE, attendanceSelectionSchema, type AttendanceRow } from "./attendance-validation";
import { kolkataToday } from "./fee-validation";
import { normalizeStudentPage } from "./student-list-context";

export async function getAttendance(organizationId: string, query: Record<string, string | string[] | undefined>) {
  const { organization, role } = await requireOrganizationMembership(organizationId);
  const db = getDb();
  const groups = await db.group.findMany({ where: { organizationId: organization.id }, select: { id: true, name: true, section: true, status: true }, orderBy: [{ name: "asc" }, { section: "asc" }, { id: "asc" }] });
  const date = query.date === undefined ? kolkataToday() : query.date;
  if (query.groupId === undefined) return { organization, role, groups, date: typeof date === "string" ? date : kolkataToday(), selected: null };
  const parsed = attendanceSelectionSchema().safeParse({ groupId: query.groupId, date });
  if (!parsed.success) return { organization, role, groups, date: kolkataToday(), selected: null, error: parsed.error.issues[0].message };
  const group = groups.find(item => item.id === parsed.data.groupId);
  if (!group) notFound();
  const day = new Date(parsed.data.date + "T00:00:00.000Z");
  return db.$transaction(async tx => {
    // Include historical records independently of today's assignment/status.
    const where: Prisma.StudentWhereInput = { organizationId: organization.id, OR: [
      ...(group.status === "ACTIVE" ? [{ groupId: group.id, status: "ACTIVE" as const }] : []),
      { attendance: { some: { organizationId: organization.id, groupId: group.id, date: day } } },
    ] };
    const total = await tx.student.count({ where });
    const pages = Math.max(1, Math.ceil(total / ATTENDANCE_PAGE_SIZE));
    const page = Math.min(normalizeStudentPage(query.page), pages);
    const students = await tx.student.findMany({ where, orderBy: [{ admissionNumber: "asc" }, { id: "asc" }], take: ATTENDANCE_PAGE_SIZE, skip: (page - 1) * ATTENDANCE_PAGE_SIZE,
      select: { id: true, name: true, admissionNumber: true, status: true, groupId: true, attendance: { where: { organizationId: organization.id, date: day }, select: { groupId: true, status: true, version: true } } },
    });
    const rows: AttendanceRow[] = students.map(student => {
      const record = student.attendance[0];
      const elsewhere = !!record && record.groupId !== group.id;
      return { id: student.id, name: student.name, admissionNumber: student.admissionNumber,
        status: record?.status ?? null, version: record?.version ?? 0,
        editable: role !== "STAFF" && !elsewhere,
        explanation: elsewhere ? "Already recorded under another class/batch for this date. Edit it in the original register." : record && (student.groupId !== group.id || student.status !== "ACTIVE") ? "Saved historical record; current assignment or student status has changed." : null,
      };
    });
    return { organization, role, groups, date: parsed.data.date, selected: { group, rows, page, pages, total } };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
