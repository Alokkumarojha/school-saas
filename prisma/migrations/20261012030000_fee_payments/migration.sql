CREATE TYPE "FeePaymentMethod" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER');
CREATE UNIQUE INDEX "FeeCharge_organizationId_id_key" ON "FeeCharge"("organizationId", "id");
CREATE TABLE "FeePayment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "feeChargeId" TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "paymentDate" DATE NOT NULL,
  "method" "FeePaymentMethod" NOT NULL,
  "reference" VARCHAR(100),
  "note" VARCHAR(500),
  "recordedByClerkUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submissionKey" UUID NOT NULL,
  CONSTRAINT "FeePayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeePayment_amountPaise_check" CHECK ("amountPaise" > 0),
  CONSTRAINT "FeePayment_organizationId_feeChargeId_fkey" FOREIGN KEY ("organizationId", "feeChargeId") REFERENCES "FeeCharge"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "FeePayment_organizationId_submissionKey_key" ON "FeePayment"("organizationId", "submissionKey");
CREATE INDEX "FeePayment_organizationId_feeChargeId_createdAt_id_idx" ON "FeePayment"("organizationId", "feeChargeId", "createdAt", "id");
