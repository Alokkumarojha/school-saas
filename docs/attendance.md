# Daily attendance — Step 1

## Data model and access

`Attendance` stores a PostgreSQL DATE, organization, student, original group, PRESENT/ABSENT/LATE status, integer revision, creator/last updater Clerk IDs, and timestamps. Composite foreign keys enforce that both student and group belong to the organization. A unique organization/student/date key allows one mark per day across all groups. Restrictive foreign keys protect history. No existing students, groups, counters, or payment records are modified by this additive migration.

OWNER/ADMIN may read and write; STAFF may read only. Reads verify membership independently of the layout. Each save verifies membership again, then locks and rechecks the membership inside the transaction. IDs and roles from client input cannot determine ownership. Server Zod validation checks identifiers, real calendar dates, Kolkata future-date limits, status, revision, duplicate IDs, and the 50-entry limit.

## Roster and history

The selected group's register includes currently active assigned students (only when the group is active), plus all students with saved marks under that group/date regardless of current assignment or status. It is paginated at 50 students, with identical count/fetch conditions in a repeatable-read snapshot and deterministic admission-number/id ordering. Only this scoped roster page is loaded; the organization-wide student directory is never loaded. Group choices include inactive groups for accessing history.

New marks on past dates still use CURRENT assignments: there is no historical enrollment model. Existing marks retain the original group forever through this module. A current student already marked elsewhere on that day is visible but read-only in the new group's register. Correct the mark in its original register. Inactive groups expose saved records only. Names/admission numbers shown are current student details, not historical identity snapshots.

Unmarked means no attendance row exists. There is no implicit Present default. Only changed, explicitly marked selections are submitted. Omitted students are never deleted or cleared. Saved statuses can be corrected but clearing/deleting a saved mark is outside this step. Counts describe the displayed page, including marked-elsewhere students; they are not whole-group reports. Unsaved new selections may be returned to Unmarked before saving.

## Atomicity and concurrency

Each save is one ReadCommitted transaction. The organization's row is locked FOR UPDATE to serialize attendance saves (including concurrent first marks and competing groups). Membership, selected group, and affected students are locked FOR SHARE through commit; role changes, group deactivation and student transfer/inactivation cannot slip between eligibility checks and writes. Lock acquisition uses organization, membership, group, then sorted student IDs. Historical records may be corrected after transfer/inactivation; new marks require an active group and active currently assigned student.

Existing revision mismatches return a reload error without overwriting. If the requested status already matches the saved record, replay is a no-op and returns its revision. No writes occur for unchanged statuses. The organization/day uniqueness constraint is a second safeguard against duplicates. A failure on any entry rolls back the complete save. Transaction failures are not automatically retried. Organization-wide serialization favors correctness for this first version, at the cost of parallel write throughput across classes. Lock timeout/failure returns an error and keeps client selections.

The form keeps selections on failures, updates local revisions on success, disables edits while saving, warns on group/date load with unsaved changes, and guards links/tab close. Browser history back/forward navigation is not comprehensively blocked. Every page change is a separate save boundary.

## Migration (not applied by this task)

Migration: `20261013000000_daily_attendance`.

Run locally after reviewing the migration and confirming the configured target database. `migrate deploy` applies ALL pending migrations, not just attendance. No reset or db push is required.

```powershell
Set-Location 'C:\Users\aojha\school-saas'
npm run db:validate
npx prisma migrate deploy
npm run db:generate
npm run dev
```

No new environment variables or dependencies are required.

## Verification and manual checklist

Vitest uses mocked database transactions and static React markup. Tests inspect scoped queries, role checks, locked eligibility, revision conflict handling, idempotent no-ops, validation, bounded pagination, and history retention. The rollback mock checks transaction rejection/commit flow; it does NOT prove real PostgreSQL rollback or row-lock behavior.

Before release, with an approved disposable test database:

1. Apply migrations and verify composite foreign keys reject foreign student/group IDs and the daily unique key rejects duplicate marks across groups.
2. OWNER/ADMIN: mark only two students; verify all others remain Unmarked after refresh. Correct a saved mark; check creator stays unchanged, updater/timestamps/revision change. Repeat the same save and check there is no duplicate.
3. STAFF: inspect the register, confirm view-only controls, and submit a forged write. Non-member: attempt direct route/action access. Open a form as ADMIN, demote/revoke before save, and verify denial.
4. Transfer/inactivate a student and inactivate the original group after marking. Verify the original record remains visible/correctable, the new group cannot move it, and unmarked newly ineligible students cannot be saved.
5. Open the same register in two browsers: save different marks for the same student. The second must receive a reload conflict. Repeat with concurrent first saves under different groups and verify one daily row only. Test a concurrent transfer/deactivation and a multi-entry failure for real transaction rollback.
6. Test invalid dates, leap day, future dates, and the Kolkata midnight boundary.
7. At desktop and 390px mobile widths, check five navigation items, long names, dropdowns, dark mode, focus/labels, pagination and bottom-safe-area spacing. Verify group/date and pagination preserve context, warnings appear for unsaved edits, cancel keeps selections, and errors retain selections.
8. Use 51+ assigned students to check page limits and displayed-page counts. Confirm no demo data appears in organization attendance.

No live database, browser, real PostgreSQL concurrency, or notification integration is verified by the automated mocks.
