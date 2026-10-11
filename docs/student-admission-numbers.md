# Automatic student admission numbers

Admission numbers are assigned only on successful creation: ST001, ST002, ... ST999, ST1000. Each organization has its own persistent high-water mark. Existing numbers are unchanged. Editing never writes admissionNumber, even if a submitted form includes it.

## Database design and rollout

Migration: 20261011030000_student_admission_counter.

The migration creates StudentAdmissionCounter with one row per organization and a nonnegative DECIMAL(65,0) lastNumber. It locks Organization and Student against writes while seeding the maximum numeric suffix of existing uppercase ST[0-9]+ numbers, including inactive students. Custom numbers are left intact. The existing organizationId + admissionNumber unique constraint remains unchanged.

Allocation takes an organization row FOR UPDATE lock, then atomically upserts the counter using the greater of its saved high-water mark and existing standard admission numbers. Student creation occurs in the same ReadCommitted transaction. The organization lock serializes concurrent first use as well as later allocations. Each retry starts a fresh transaction; only Prisma P2034 conflicts/deadlocks are retried, at most three attempts. Failed inserts roll back allocation. Numbers belonging to committed students are not reused after deletion because the counter never decreases. Numbers deleted before this migration cannot be reconstructed from existing data.

Both actions independently obtain current membership and enforce OWNER/ADMIN before writing. The allocation helper receives only the verified organization ID; update writes explicitly include only name, guardianName, guardianPhone and status. Lookup/update scoping and stale-form demotion/revocation checks remain in place.

Stop old application writers during rollout. Back up the database through your normal process. The commands below use your existing private environment configuration; no environment files need editing for this feature. db:migrate runs Prisma migrate deploy and applies ALL pending migrations. No migration was applied during implementation.

```powershell
Set-Location 'C:\Users\aojha\school-saas'
npm.cmd run db:validate
npm.cmd run db:migrate
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run dev
```

## Verification boundaries

The Vitest suite uses mocked Clerk/database boundaries, a simulated allocation/locking/rollback model, and static React markup. It covers independent sequences; existing/inactive ST001 and ST002; custom legacy numbers; continuation beyond ST999; retained counters after simulated deletion; failed insert rollback; concurrent modeled calls; bounded retries; read-only rendering; tampered fields; OWNER/ADMIN access; STAFF/non-member rejection; and stale-form submissions after demotion/revocation.

These mocks do NOT execute SQL and do NOT prove PostgreSQL concurrency, transaction rollback, migration correctness on actual data, or Neon adapter behavior. No real database integration tests or browser tests were performed.

Before production, use a disposable PostgreSQL/Neon database:

1. Seed two organizations, existing ST001/ST002 with ST002 inactive, and custom legacy numbers. Apply the migration and verify all original records are unchanged and organization counters are correct.
2. Create students in both organizations; verify ST003 for the seeded organization and ST001 for the empty one. Repeat starting from ST999.
3. Submit parallel creations from independent connections to one organization, including a newly created organization with no counter row; verify distinct admission numbers. Repeat across two organizations.
4. Force a student insert failure after allocation inside a transaction; verify neither student nor counter increment commits. Delete the latest student only in this disposable database and verify its committed number is not reused.
5. Check mobile create/edit forms, pending feedback, values retained on errors, read-only legacy numbers, status updates, and redirect after saving. With test accounts, verify STAFF/non-member denial and an already-open ADMIN form after demotion/revocation. Do not alter live memberships for testing.
