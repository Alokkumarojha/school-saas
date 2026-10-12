import "server-only";
import { validateStudentGroup } from "@/lib/student-groups";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import type { z } from "zod";
import type { createStudentSchema } from "@/lib/student-validation";

// This server-only helper accepts an organization ID already verified by the
// calling action. It is not a Server Action or a browser-callable endpoint.
export async function createStudentWithAdmissionNumber(
  organizationId: string,
  details: z.output<typeof createStudentSchema>,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await getDb().$transaction(async tx => {
        // Also serializes first use, when there is no counter row to lock yet.
        const organization = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE
        `;
        if (!organization.length) throw new Error("Organization unavailable.");

        await validateStudentGroup(tx, organizationId, details.groupId || null);
        // Read existing standard numbers only AFTER acquiring the row lock.
        // GREATEST never lowers the persisted high-water mark after deletion.
        // Resynchronizing also handles legacy imports made before this allocation.
        const [counter] = await tx.$queryRaw<{ number: string }[]>`
          INSERT INTO "StudentAdmissionCounter" ("organizationId", "lastNumber")
          SELECT ${organizationId}, COALESCE(MAX(
            CASE WHEN "admissionNumber" ~ '^ST[0-9]+$'
              THEN SUBSTRING("admissionNumber" FROM 3)::numeric END
          ), 0) + 1 FROM "Student" WHERE "organizationId" = ${organizationId}
          ON CONFLICT ("organizationId") DO UPDATE
          SET "lastNumber" = GREATEST(
            "StudentAdmissionCounter"."lastNumber", EXCLUDED."lastNumber" - 1
          ) + 1
          RETURNING "lastNumber"::text AS "number"
        `;
        if (!counter || !/^[1-9]\d*$/.test(counter.number)) throw new Error("Invalid admission counter.");
        const admissionNumber = `ST${counter.number.padStart(3, "0")}`;
        // Explicit fields only; counter increment and insert commit or roll back together.
        return tx.student.create({ data: {
          organizationId, admissionNumber, groupId: details.groupId || null, name: details.name,
          guardianName: details.guardianName, guardianPhone: details.guardianPhone || null,
        } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 10000 });
    } catch (error) {
      // Retry only Prisma's known write-conflict/deadlock error. Validation,
      // unique violations, timeouts and ambiguous connection errors are not retried.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt === 2) throw error;
    }
  }
  throw new Error("Admission allocation retries exhausted.");
}
