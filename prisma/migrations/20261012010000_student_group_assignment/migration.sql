-- Existing students remain unassigned. No records or counters are updated.
ALTER TABLE "Student" ADD COLUMN "groupId" TEXT;
CREATE UNIQUE INDEX "Group_organizationId_id_key" ON "Group"("organizationId", "id");
CREATE INDEX "Student_organizationId_groupId_idx" ON "Student"("organizationId", "groupId");
ALTER TABLE "Student" ADD CONSTRAINT "Student_organizationId_groupId_fkey"
  FOREIGN KEY ("organizationId", "groupId") REFERENCES "Group"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
