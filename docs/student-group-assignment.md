# Student Class/Batch assignment

Each student has zero or one group. The nullable Student.groupId migration leaves all existing students Unassigned; admission numbers and counters are not updated.

Migration: 20261012010000_student_group_assignment. It adds a unique key on Group(organizationId, id), a Student(organizationId, groupId) index, and a composite foreign key to that Group key. The existing Organization relation remains. RESTRICT prevents deleting a referenced group or changing its identity/organization; null groupId permits Unassigned. The earlier normalized group-name index is unchanged.

## Assignment concurrency

Create checks the selected group inside the existing admission-counter transaction, after locking the organization and before allocating the number. Update locks the scoped student row FOR UPDATE, reads its current assignment, validates the selection, then writes only editable fields. Admission numbers remain immutable.

Group validation uses a parameterized SELECT scoped by group ID AND verified organization ID with FOR SHARE. This row lock conflicts with PostgreSQL UPDATE's lock even for a non-key status change, and remains held until student commit/rollback. If deactivation wins the lock first, a new assignment fails; if assignment wins first, subsequent deactivation preserves the committed assignment. No extra change to the group action is needed for PostgreSQL's standard UPDATE row locking.

Only the locked student's currently assigned inactive group may be retained. An omitted field from an older edit form preserves that current assignment; an explicit empty field unassigns. Missing, foreign, or newly inactive selections fail without clearing the assignment. OWNER/ADMIN checks run freshly on every action. The counter and student creation still commit or roll back together, with the existing bounded P2034 retry policy.

## Filtering and options

Create/edit options are organization-scoped ACTIVE groups, plus the current group on edit. List filters include all groups, with inactive labels, plus All and Unassigned. groupId is empty for All, unassigned for Unassigned, or a CUID. Invalid, repeated, missing/foreign group identifiers return the same not-found boundary; they never silently become an unfiltered list. Valid group conditions combine with q/status in the shared count/fetch predicate.

## Local setup

No migrations were applied during implementation. Using your existing environment configuration:

```powershell
Set-Location 'C:\Users\aojha\school-saas'
npm.cmd run db:validate
npm.cmd run db:migrate
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run dev
```

db:migrate runs prisma migrate deploy and applies ALL pending migrations. Apply the migration before running the updated app.

## Verification still required

Automated tests use mocked database/Clerk responses and static React markup. They check transaction boundaries and requested locks, not real PostgreSQL lock scheduling or constraints.

In an isolated PostgreSQL/Neon test database:
- Apply the migration to existing data and verify all student groupId values are null and admission numbers/counters unchanged.
- Attempt a direct cross-organization assignment; the composite FK must reject it.
- Race assignment against group deactivation using separate connections in both orders. Verify the lock/wait behavior above and no new assignment to an already inactive group.
- Fail an insert after counter allocation and confirm the counter rolls back; rerun concurrent admission-number tests.
- Verify null/unassigned updates, unchanged inactive retention, and rejection of invalid/foreign group selections.

Browser checks remain pending: School/Class and Coaching/Batch terminology, active options and current inactive labels, retained values after errors, no-active-group link, mobile 390px and desktop layout in both themes, q/status/groupId pagination/refresh/clear behavior, and stale test-account forms after demotion/revocation. No real database or browser verification was performed.
