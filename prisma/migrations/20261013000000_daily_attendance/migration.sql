CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE');
CREATE TABLE "Attendance" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "recordedByClerkUserId" TEXT NOT NULL,
  "lastUpdatedByClerkUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Attendance_version_check" CHECK ("version" > 0),
  CONSTRAINT "Attendance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Attendance_organizationId_studentId_fkey" FOREIGN KEY ("organizationId", "studentId") REFERENCES "Student"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "Attendance_organizationId_groupId_fkey" FOREIGN KEY ("organizationId", "groupId") REFERENCES "Group"("organizationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "Attendance_organizationId_studentId_date_key" ON "Attendance"("organizationId", "studentId", "date");
CREATE INDEX "Attendance_organizationId_groupId_date_idx" ON "Attendance"("organizationId", "groupId", "date");
