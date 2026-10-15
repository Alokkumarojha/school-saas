-- Existing membership roles and module history remain unchanged.
ALTER TABLE "Membership" ADD COLUMN "revision" UUID NOT NULL DEFAULT gen_random_uuid();
-- Prisma generates UUIDs for new memberships; temporary default backfills existing rows.
ALTER TABLE "Membership" ALTER COLUMN "revision" DROP DEFAULT;
CREATE TYPE "TeamInviteRole" AS ENUM ('ADMIN', 'STAFF');
CREATE TYPE "TeamInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');
CREATE TYPE "TeamAuditEvent" AS ENUM ('INVITED', 'INVITE_REVOKED', 'INVITE_ACCEPTED', 'MEMBER_ROLE_CHANGED', 'MEMBER_REMOVED');
CREATE TABLE "TeamInvitation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "role" "TeamInviteRole" NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "status" "TeamInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdByClerkUserId" TEXT NOT NULL,
  "acceptedByClerkUserId" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TeamInvitation_email_normalized" CHECK ("email" = lower(btrim("email"))),
  CONSTRAINT "TeamInvitation_hash_format" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "TeamInvitation_tokenHash_key" ON "TeamInvitation"("tokenHash");
CREATE UNIQUE INDEX "TeamInvitation_pending_email_key" ON "TeamInvitation"("organizationId", "email") WHERE "status" = 'PENDING';
CREATE INDEX "TeamInvitation_organizationId_status_createdAt_id_idx" ON "TeamInvitation"("organizationId", "status", "createdAt", "id");
CREATE TABLE "TeamAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "actorClerkUserId" TEXT NOT NULL,
  "event" "TeamAuditEvent" NOT NULL,
  "targetClerkUserId" TEXT,
  "invitationId" TEXT,
  "previousRole" "MembershipRole",
  "nextRole" "MembershipRole",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TeamAudit_organizationId_createdAt_id_idx" ON "TeamAudit"("organizationId", "createdAt", "id");
