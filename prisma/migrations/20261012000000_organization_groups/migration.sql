CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "Group" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "section" VARCHAR(60) NOT NULL DEFAULT '',
  "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Group_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Group_name_nonempty" CHECK (length(btrim(regexp_replace("name", '[[:space:]]+', ' ', 'g'))) > 0),
  CONSTRAINT "Group_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- An expression index enforces normalization even for non-application writers.
-- Empty sections are non-null empty strings; inactive groups still reserve names.
CREATE UNIQUE INDEX "Group_organization_name_section_key" ON "Group" (
  "organizationId",
  lower(btrim(regexp_replace("name", '[[:space:]]+', ' ', 'g'))),
  lower(btrim(regexp_replace("section", '[[:space:]]+', ' ', 'g')))
);
CREATE INDEX "Group_organizationId_createdAt_idx" ON "Group"("organizationId", "createdAt");
