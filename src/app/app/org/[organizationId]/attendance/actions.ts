"use server";
import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { requireOrganizationMembership } from "@/lib/organizations";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attendanceSaveSchema, type AttendanceState } from "@/lib/attendance-validation";
class AttendanceError extends Error {}

export async function saveAttendance(organizationId: string, input: unknown): Promise<AttendanceState> {
  const { organization, role } = await requireOrganizationMembership(organizationId);
  if (role !== "OWNER" && role !== "ADMIN") return { error: "Only owners and admins can record attendance." };
  const userId = await requireUserId();
  const parsed = attendanceSaveSchema().safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your selections." };
  const { groupId, date, entries } = parsed.data;
  try {
    const saved = await getDb().$transaction(async tx => {
      // Serialize this organization's attendance writes, including first use and
      // competing groups. ReadCommitted sees records committed by the prior saver.
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organization.id} FOR UPDATE`;
      const [membership] = await tx.$queryRaw<{ role: string }[]>`SELECT "role" FROM "Membership" WHERE "organizationId" = ${organization.id} AND "clerkUserId" = ${userId} FOR SHARE`;
      if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) throw new AttendanceError("Your access changed. Reload before recording attendance.");
      const [group] = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Group" WHERE "organizationId" = ${organization.id} AND "id" = ${groupId} FOR SHARE`;
      if (!group) throw new AttendanceError("Class/batch unavailable in this organization.");
      const day = new Date(date + "T00:00:00.000Z");
      const results: NonNullable<AttendanceState["saved"]> = [];
      // Stable lock ordering avoids deadlocks with other attendance saves.
      for (const entry of [...entries].sort((a, b) => a.studentId.localeCompare(b.studentId))) {
        const [student] = await tx.$queryRaw<{ status: string; groupId: string | null }[]>`SELECT "status", "groupId" FROM "Student" WHERE "organizationId" = ${organization.id} AND "id" = ${entry.studentId} FOR SHARE`;
        if (!student) throw new AttendanceError("Student unavailable in this organization. Reload the register.");
        const where = { organizationId: organization.id, studentId: entry.studentId, date: day };
        const current = await tx.attendance.findUnique({ where: { organizationId_studentId_date: where } });
        if (current && current.groupId !== groupId) throw new AttendanceError("A student is already marked in another class/batch on this date. Reload the register.");
        if (!current && (group.status !== "ACTIVE" || student.status !== "ACTIVE" || student.groupId !== groupId)) throw new AttendanceError("A student or class/batch is no longer eligible. Reload the register.");
        if ((current?.version ?? 0) !== entry.version) {
          // Identical replay is a no-op, never an overwrite.
          if (current?.status === entry.status) { results.push({ studentId: entry.studentId, status: current.status, version: current.version }); continue; }
          throw new AttendanceError("Attendance changed since you opened this register. Reload before saving; your selections have been kept.");
        }
        if (current?.status === entry.status) { results.push({ studentId: entry.studentId, status: current.status, version: current.version }); continue; }
        const record = current
          ? await tx.attendance.update({ where: { organizationId_studentId_date: where }, data: { status: entry.status, version: { increment: 1 }, lastUpdatedByClerkUserId: userId } })
          : await tx.attendance.create({ data: { ...where, groupId, status: entry.status, recordedByClerkUserId: userId, lastUpdatedByClerkUserId: userId } });
        results.push({ studentId: entry.studentId, status: record.status, version: record.version });
      }
      return results;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 20000 });
    revalidatePath(`/app/org/${organization.id}/attendance`);
    return { error: null, success: "Attendance saved. Unmarked students were not recorded.", saved };
  } catch (error) {
    return { error: error instanceof AttendanceError ? error.message : "Could not save attendance. Reload and try again; your selections have been kept." };
  }
}
