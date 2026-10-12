import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { requireOrganizationMembership } from "@/lib/organizations";
import { kolkataToday } from "@/lib/fee-validation";
import { normalizeStudentPage } from "@/lib/student-list-context";

export async function listFeeCharges(organizationId: string, query: { page?: string | string[]; studentId?: string | string[]; due?: string | string[] }, now = new Date()) {
  const { organization, role } = await requireOrganizationMembership(organizationId);
  const studentId = query.studentId ?? "";
  if (typeof studentId !== "string" || (studentId && !z.string().cuid().safeParse(studentId).success)) notFound();
  const student = studentId ? await getDb().student.findFirst({ where: { id: studentId, organizationId: organization.id }, select: { id: true, name: true, admissionNumber: true } }) : null;
  if (studentId && !student) notFound();
  const due = query.due === "overdue" || query.due === "upcoming" ? query.due : "all";
  const today = new Date(kolkataToday(now) + "T00:00:00.000Z");
  const where: Prisma.FeeChargeWhereInput = {
    organizationId: organization.id,
    ...(studentId ? { studentId } : {}),
    ...(due === "overdue" ? { dueDate: { lt: today } } : due === "upcoming" ? { dueDate: { gte: today } } : {}),
  };
  const total = await getDb().feeCharge.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(normalizeStudentPage(query.page), totalPages);
  const charges = await getDb().feeCharge.findMany({
    where, select: { id: true, title: true, amountPaise: true, dueDate: true, student: { select: { name: true, admissionNumber: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20,
  });
  return { organization, role, charges, student, studentId, due, page, total, totalPages };
}
