import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { requireOrganizationMembership } from "@/lib/organizations";
import { kolkataToday } from "@/lib/fee-validation";
import { feeBalance } from "./fee-payment-validation";
import { feeListContext, type FeeQuery } from "./fee-context";

type ChargeRow = { id: string; title: string; amountPaise: number; dueDate: Date; studentName: string; admissionNumber: string; paid: string };
export async function listFeeCharges(organizationId: string, query: FeeQuery, now = new Date()) {
  const { organization, role } = await requireOrganizationMembership(organizationId);
  const context = await feeListContext(organization.id, query);
  const { studentId, student, due } = context;
  const today = new Date(kolkataToday(now) + "T00:00:00.000Z");
  // Both count and page use the identical scoped aggregate before pagination.
  // PostgreSQL sums INTEGER as BIGINT; keep it as text until checked with BigInt.
  const filtered = Prisma.sql`
    WITH balances AS (
      SELECT c.*, COALESCE(p.paid, 0) AS paid
      FROM "FeeCharge" c
      LEFT JOIN (
        SELECT "feeChargeId", "organizationId", SUM("amountPaise") AS paid
        FROM "FeePayment" WHERE "organizationId" = ${organization.id}
        GROUP BY "organizationId", "feeChargeId"
      ) p ON p."feeChargeId" = c.id AND p."organizationId" = c."organizationId"
      WHERE c."organizationId" = ${organization.id}
      ${studentId ? Prisma.sql`AND c."studentId" = ${studentId}` : Prisma.empty}
    ), filtered AS (
      SELECT * FROM balances
      ${due === "overdue" ? Prisma.sql`WHERE "dueDate" < ${today}::date AND paid < "amountPaise"` : due === "upcoming" ? Prisma.sql`WHERE "dueDate" >= ${today}::date AND paid < "amountPaise"` : Prisma.empty}
    )
  `;
  const [count] = await getDb().$queryRaw<{ total: string }[]>(Prisma.sql`${filtered} SELECT COUNT(*)::text AS total FROM filtered`);
  const total = Number(count.total);
  if (!Number.isSafeInteger(total)) throw new Error("Too many charges.");
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(context.page, totalPages);
  const rows = await getDb().$queryRaw<ChargeRow[]>(Prisma.sql`${filtered}
    SELECT c.id, c.title, c."amountPaise", c."dueDate", c.paid::text AS paid,
      s.name AS "studentName", s."admissionNumber"
    FROM filtered c JOIN "Student" s ON s.id = c."studentId" AND s."organizationId" = c."organizationId"
    ORDER BY c."createdAt" DESC, c.id DESC LIMIT 20 OFFSET ${(page - 1) * 20}
  `);
  const charges = rows.map(row => ({ ...row, student: { name: row.studentName, admissionNumber: row.admissionNumber }, ...feeBalance(row.amountPaise, row.paid) }));
  return { organization, role, charges, student, studentId, due, page, total, totalPages };
}
