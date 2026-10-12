CREATE UNIQUE INDEX "Student_organizationId_id_key" ON "Student"("organizationId", "id");
CREATE TABLE "FeeCharge" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "title" VARCHAR(150) NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "dueDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByClerkUserId" TEXT NOT NULL,
  "submissionKey" UUID NOT NULL,
  CONSTRAINT "FeeCharge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeeCharge_amountPaise_check" CHECK ("amountPaise" > 0 AND "amountPaise" <= 2147483647),
  CONSTRAINT "FeeCharge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FeeCharge_organizationId_studentId_fkey" FOREIGN KEY ("organizationId", "studentId") REFERENCES "Student"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "FeeCharge_organizationId_submissionKey_key" ON "FeeCharge"("organizationId", "submissionKey");
CREATE INDEX "FeeCharge_organizationId_createdAt_id_idx" ON "FeeCharge"("organizationId", "createdAt", "id");
CREATE INDEX "FeeCharge_organizationId_studentId_dueDate_idx" ON "FeeCharge"("organizationId", "studentId", "dueDate");
