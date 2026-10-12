# Fee charges — Step 1

> Historical Step 1 baseline. Manual payments are now implemented in Step 2; see fee-payments.md for current balances, filters and collection behavior.

Only individual immutable charges are implemented. There are no payments, receipts, paid/outstanding balances, discounts, bulk or recurring charges, or payment gateway integration.

## Storage and limits

Migration: 20261012020000_fee_charges. Adds FeeCharge and Student(organizationId, id)'s composite unique key. The charge's composite FK to Student enforces the same organization. No existing student, group, admission-counter or record values are updated.

Money is PostgreSQL INTEGER paise. Accepted input is plain positive decimal rupees with up to two fractional digits, without commas, exponent notation or leading zeroes (except 0.xx). Conversion uses digit strings and BigInt, then converts the bounded integer to Number. The maximum is 2,147,483,647 paise (₹2,14,74,836.47), the signed INTEGER limit; the database check also requires a positive amount.

Due date is PostgreSQL DATE. Input must be an actual YYYY-MM-DD Gregorian calendar date, years 0001–9999. Prisma receives UTC midnight and display explicitly uses UTC, preserving date-only meaning. Overdue is before the current Asia/Kolkata calendar date; Upcoming includes today. These labels describe due dates only, not payment status.

## Authorization and idempotency

Every create submission rechecks membership and OWNER/ADMIN. Creator identity comes from Clerk on the server; role, ownership and creator fields supplied by the browser are ignored. STAFF may list/search only. Student selection is revalidated using student ID AND verified organization ID and must be ACTIVE.

The form receives a fresh UUID submission key; controlled fields and the key persist after errors. A database unique constraint on organizationId + submissionKey is the final idempotency guard. The transaction locks the organization row to serialize same-organization first use/replay, then takes a FOR SHARE lock on the scoped student to prevent deactivation between validation and commit.

A matching existing key succeeds without inserting only if canonical student/title/paise/date/creator match. A changed payload or different creator produces an error. Replays still require current authorization and an active student. A new form/key may intentionally create another charge with identical details. Opening a new form or reloading starts a new submission. No automatic transaction retries are used; manual retry retains the key, making an ambiguous commit safe to replay.

The picker requires a search and returns at most 20 students (21 fetched to detect another page). Queries are organization-scoped; charge creation searches active students, while filters can find inactive students' historical charges. No full directory is sent to the browser.

## Local migration

No migration was applied during implementation. Using existing private environment configuration:

```powershell
Set-Location 'C:\Users\aojha\school-saas'
npm.cmd run db:validate
npm.cmd run db:migrate
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run dev
```

db:migrate is prisma migrate deploy and applies ALL pending migrations. Apply the migration before serving the updated application.

## Verification boundaries

Vitest uses mocked membership, Clerk and database calls plus static React rendering. It checks exact parsing, invalid dates, Kolkata boundaries, scoped queries, role/stale-form denial, active-student checks, replay comparison, pagination, and bounded search. These are not real PostgreSQL constraint/concurrency tests or browser tests.

Pending on an isolated PostgreSQL/Neon database:
- Apply the migration and confirm existing data is unchanged.
- Attempt a cross-tenant charge directly; confirm the composite FK rejects it.
- Race two identical submissions with one key; confirm exactly one charge.
- Race mismatched payloads with one key; confirm the second fails.
- Race student deactivation against creation; confirm lock ordering and active-at-write behavior.
- Verify actual PostgreSQL DATE round-trips and due-date filters around Kolkata midnight.

Pending browser checks:
- Desktop and 390px mobile layout, dark mode, navigation clearance.
- Student search, result pagination, selection and keyboard operation with hundreds of students.
- Controlled values/key retained on validation/database errors and double-click/retry behavior.
- STAFF view-only controls and already-open OWNER/ADMIN forms after test-account demotion/revocation.
- Student/due filters, page reset, Previous/Next, refresh and Clear filters.
