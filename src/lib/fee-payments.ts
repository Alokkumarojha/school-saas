import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { notFound } from "next/navigation";
import { getDb } from "./db";
import { requireOrganizationMembership } from "./organizations";
import { normalizeStudentPage } from "./student-list-context";
import { feeBalance } from "./fee-payment-validation";
export async function getFeeChargeDetail(organizationId: string, feeChargeId: string, requestedPage?: string | string[]) {
  const { organization, role } = await requireOrganizationMembership(organizationId);
  // Snapshot keeps history/count/balance consistent for this render.
  return getDb().$transaction(async tx => {
    const charge = await tx.feeCharge.findFirst({ where: { id: feeChargeId, organizationId: organization.id }, include: { student: { select: { name: true, admissionNumber: true, status: true } } } });
    if (!charge) notFound();
    const where = { organizationId: organization.id, feeChargeId: charge.id };
    const [sum] = await tx.$queryRaw<{ paid: string }[]>`SELECT COALESCE(SUM("amountPaise"), 0)::text AS paid FROM "FeePayment" WHERE "organizationId" = ${organization.id} AND "feeChargeId" = ${charge.id}`;
    const total = await tx.feePayment.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / 20));
    const page = Math.min(normalizeStudentPage(requestedPage), totalPages);
    const payments = await tx.feePayment.findMany({ where, select: { id: true, amountPaise: true, paymentDate: true, method: true, reference: true, note: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 });
    return { organization, role, charge, payments, total, totalPages, page, ...feeBalance(charge.amountPaise, sum.paid) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
