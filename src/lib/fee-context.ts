import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getDb } from "./db";
import { normalizeStudentPage } from "./student-list-context";
export type FeeQuery = { page?: string | string[]; studentId?: string | string[]; due?: string | string[] };
export async function feeListContext(verifiedOrganizationId: string, query: FeeQuery) {
  const studentId = query.studentId ?? "";
  if (typeof studentId !== "string" || (studentId && !z.string().cuid().safeParse(studentId).success)) notFound();
  const student = studentId ? await getDb().student.findFirst({ where: { id: studentId, organizationId: verifiedOrganizationId }, select: { id: true, name: true, admissionNumber: true } }) : null;
  if (studentId && !student) notFound();
  const due = query.due === "overdue" || query.due === "upcoming" ? query.due : "all";
  return { studentId, student, due, page: normalizeStudentPage(query.page) };
}
export function feeContextQuery(context: { page: number; studentId: string; due: string }) {
  return new URLSearchParams({ ...(context.studentId ? { studentId: context.studentId } : {}), ...(context.due !== "all" ? { due: context.due } : {}), page: String(context.page) }).toString();
}
