import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "./db";
import { requireOrganizationMembership } from "./organizations";
import { kolkataToday } from "./fee-validation";

type FeeTotals = { charged: string; collected: string; outstanding: string; overdue: string; invalid: boolean };

export async function getOrganizationDashboard(organizationId: string, now = new Date()) {
  const { organization, role } = await requireOrganizationMembership(organizationId);
  const today = kolkataToday(now);
  const day = new Date(today + "T00:00:00.000Z");
  // No persistent cache. All four aggregates share a consistent request snapshot.
  return getDb().$transaction(async tx => {
    const activeStudents = await tx.student.count({ where: { organizationId: organization.id, status: "ACTIVE" } });
    const activeGroups = await tx.group.count({ where: { organizationId: organization.id, status: "ACTIVE" } });
    // Same per-charge balance rule as feeBalance/listFeeCharges: charged - paid.
    // Aggregate payments BEFORE joining charges, so each charge is counted once.
    // BIGINT/NUMERIC sums travel as text and never pass through JS Number.
    const [totals] = await tx.$queryRaw<FeeTotals[]>`
      WITH paid AS (
        SELECT "organizationId", "feeChargeId", SUM("amountPaise") AS amount
        FROM "FeePayment" WHERE "organizationId" = ${organization.id}
        GROUP BY "organizationId", "feeChargeId"
      ), balances AS (
        SELECT c."amountPaise" AS charged, COALESCE(p.amount, 0) AS collected,
          c."amountPaise" - COALESCE(p.amount, 0) AS remaining, c."dueDate"
        FROM "FeeCharge" c
        LEFT JOIN paid p ON p."organizationId" = c."organizationId" AND p."feeChargeId" = c.id
        WHERE c."organizationId" = ${organization.id}
      )
      SELECT COALESCE(SUM(charged), 0)::text AS charged,
        COALESCE(SUM(collected), 0)::text AS collected,
        COALESCE(SUM(remaining), 0)::text AS outstanding,
        COALESCE(SUM(remaining) FILTER (WHERE "dueDate" < ${day}::date AND remaining > 0), 0)::text AS overdue,
        COALESCE(BOOL_OR(collected < 0 OR remaining < 0), false) AS invalid
      FROM balances
    `;
    if (totals.invalid) throw new Error("Invalid fee balance.");
    const attendanceRows = await tx.attendance.groupBy({
      by: ["status"], where: { organizationId: organization.id, date: day }, _count: { _all: true },
    });
    const attendance = { PRESENT: 0, ABSENT: 0, LATE: 0 };
    for (const row of attendanceRows) attendance[row.status] = row._count._all;
    return { organization, role, today, activeStudents, activeGroups, attendance,
      fees: { charged: BigInt(totals.charged), collected: BigInt(totals.collected), outstanding: BigInt(totals.outstanding), overdue: BigInt(totals.overdue) },
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
