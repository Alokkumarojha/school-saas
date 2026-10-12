"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { requireOrganizationMembership } from "@/lib/organizations";
import { requireUserId } from "@/lib/auth";
import { feeChargeSchema, type FeeState } from "@/lib/fee-validation";

export async function searchFeeStudents(organizationId: string, search: string, requestedPage: number, activeOnly = true) {
  const { organization } = await requireOrganizationMembership(organizationId);
  const q = typeof search === "string" ? search.trim().slice(0, 100) : "";
  if (!q) return { students: [], hasMore: false };
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10000 ? requestedPage : 1;
  const contains = q.replace(/[\\%_]/g, "\\$&");
  const students = await getDb().student.findMany({
    where: { organizationId: organization.id, ...(activeOnly !== false ? { status: "ACTIVE" as const } : {}), OR: [{ name: { contains, mode: "insensitive" as const } }, { admissionNumber: { contains, mode: "insensitive" as const } }] },
    select: { id: true, name: true, admissionNumber: true },
    orderBy: [{ name: "asc" }, { id: "asc" }], skip: (page - 1) * 20, take: 21,
  });
  return { students: students.slice(0, 20), hasMore: students.length > 20 };
}
class ChargeError extends Error {}
export async function createFeeCharge(organizationId: string, _state: FeeState, form: FormData): Promise<FeeState> {
  const { organization, role } = await requireOrganizationMembership(organizationId);
  if (role !== "OWNER" && role !== "ADMIN") return { error: "Only owners and admins can create fee charges." };
  const creator = await requireUserId();
  const result = feeChargeSchema.safeParse(Object.fromEntries(["studentId", "title", "amount", "dueDate", "submissionKey"].map(key => [key, form.get(key)])));
  if (!result.success) return { error: result.error.issues[0]?.message ?? "Check the form fields." };
  const payload = result.data;
  try {
    await getDb().$transaction(async tx => {
      // Serializes same-organization first use/replay, backed by the unique key.
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organization.id} FOR UPDATE`;
      // Blocks concurrent student deactivation until this transaction commits.
      const [student] = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Student" WHERE "id" = ${payload.studentId} AND "organizationId" = ${organization.id} FOR SHARE`;
      if (!student || student.status !== "ACTIVE") throw new ChargeError("Selected student is unavailable. Choose an active student.");
      const existing = await tx.feeCharge.findUnique({ where: { organizationId_submissionKey: { organizationId: organization.id, submissionKey: payload.submissionKey } } });
      if (existing) {
        if (existing.studentId !== payload.studentId || existing.title !== payload.title || existing.amountPaise !== payload.amount || existing.dueDate.toISOString().slice(0, 10) !== payload.dueDate || existing.createdByClerkUserId !== creator) {
          throw new ChargeError("This submission key was already used with different details. Open a new charge form.");
        }
        return;
      }
      await tx.feeCharge.create({ data: {
        organizationId: organization.id, studentId: payload.studentId, title: payload.title,
        amountPaise: payload.amount, dueDate: new Date(payload.dueDate + "T00:00:00.000Z"),
        submissionKey: payload.submissionKey, createdByClerkUserId: creator,
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  } catch (error) {
    return { error: error instanceof ChargeError ? error.message : "Could not save the charge. Please retry this submission." };
  }
  const path = `/app/org/${organization.id}/fees`;
  revalidatePath(path);
  redirect(path);
}
