"use server";
import { Prisma } from "@/generated/prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { requireOrganizationMembership } from "@/lib/organizations";
import { paymentSchema } from "@/lib/fee-payment-validation";
import { feeListContext, feeContextQuery, type FeeQuery } from "@/lib/fee-context";
import type { FeeState } from "@/lib/fee-validation";
class PaymentError extends Error {}

export async function recordFeePayment(organizationId: string, feeChargeId: string, _state: FeeState, form: FormData): Promise<FeeState> {
  const { organization, role } = await requireOrganizationMembership(organizationId);
  if (role !== "OWNER" && role !== "ADMIN") return { error: "Only owners and admins can record payments." };
  const recorder = await requireUserId();
  const result = paymentSchema().safeParse(Object.fromEntries(["amount", "paymentDate", "method", "submissionKey", "reference", "note"].map(key => [key, form.get(key) ?? ""])));
  if (!result.success) return { error: result.error.issues[0]?.message ?? "Check the form fields." };
  const query: FeeQuery = {};
  for (const key of ["page", "due", "studentId"] as const) {
    const values = form.getAll("return." + key);
    if (values.some(value => typeof value !== "string")) return { error: "Invalid list context." };
    query[key] = values.length > 1 ? values as string[] : values[0] as string | undefined;
  }
  const context = await feeListContext(organization.id, query);
  const payload = result.data;
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await getDb().$transaction(async tx => {
          // Org lock serializes submission keys even across different charges.
          // Always acquire org before charge to keep the lock order consistent.
          await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organization.id} FOR UPDATE`;
          const [charge] = await tx.$queryRaw<{ id: string; amountPaise: number }[]>`SELECT "id", "amountPaise" FROM "FeeCharge" WHERE "id" = ${feeChargeId} AND "organizationId" = ${organization.id} FOR UPDATE`;
          if (!charge) throw new PaymentError("Charge unavailable in this organization.");
          const existing = await tx.feePayment.findUnique({ where: { organizationId_submissionKey: { organizationId: organization.id, submissionKey: payload.submissionKey } } });
          // Check replay BEFORE balance: the original payment already reduced it.
          if (existing) {
            if (existing.feeChargeId !== charge.id || existing.amountPaise !== payload.amount || existing.paymentDate.toISOString().slice(0, 10) !== payload.paymentDate || existing.method !== payload.method || (existing.reference ?? "") !== payload.reference || (existing.note ?? "") !== payload.note || existing.recordedByClerkUserId !== recorder) {
              throw new PaymentError("This submission key was already used with different details. Reload to start a new payment.");
            }
            return;
          }
          const [sum] = await tx.$queryRaw<{ paid: string }[]>`SELECT COALESCE(SUM("amountPaise"), 0)::text AS paid FROM "FeePayment" WHERE "organizationId" = ${organization.id} AND "feeChargeId" = ${charge.id}`;
          const remaining = BigInt(charge.amountPaise) - BigInt(sum.paid);
          if (BigInt(payload.amount) > remaining) throw new PaymentError("Payment exceeds the remaining balance. Refresh the charge and check the amount.");
          await tx.feePayment.create({ data: {
            organizationId: organization.id, feeChargeId: charge.id, amountPaise: payload.amount,
            paymentDate: new Date(payload.paymentDate + "T00:00:00.000Z"), method: payload.method,
            reference: payload.reference || null, note: payload.note || null,
            submissionKey: payload.submissionKey, recordedByClerkUserId: recorder,
          } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 10000 });
        break;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt >= 2) throw error;
      }
    }
  } catch (error) {
    return { error: error instanceof PaymentError ? error.message : "Could not record the payment. Retry this submission." };
  }
  const list = `/app/org/${organization.id}/fees`;
  revalidatePath(list);
  revalidatePath(`${list}/${feeChargeId}`);
  redirect(`${list}/${feeChargeId}?${feeContextQuery(context)}`);
}
