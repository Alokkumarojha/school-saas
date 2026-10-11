BEGIN;

-- Block writes while taking the initial high-water mark. Existing student rows
-- and their admission numbers are never updated by this migration.
LOCK TABLE "Organization", "Student" IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE "StudentAdmissionCounter" (
    "organizationId" TEXT NOT NULL,
    "lastNumber" DECIMAL(65,0) NOT NULL DEFAULT 0,
    CONSTRAINT "StudentAdmissionCounter_pkey" PRIMARY KEY ("organizationId"),
    CONSTRAINT "StudentAdmissionCounter_nonnegative" CHECK ("lastNumber" >= 0),
    CONSTRAINT "StudentAdmissionCounter_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

-- No status filter: inactive records also reserve their historical number.
-- Nonstandard legacy numbers are preserved and excluded from the numeric max.
INSERT INTO "StudentAdmissionCounter" ("organizationId", "lastNumber")
SELECT o."id", COALESCE(MAX(
  CASE WHEN s."admissionNumber" ~ '^ST[0-9]+$'
    THEN SUBSTRING(s."admissionNumber" FROM 3)::numeric END
), 0)
FROM "Organization" o
LEFT JOIN "Student" s ON s."organizationId" = o."id"
GROUP BY o."id";

COMMIT;
