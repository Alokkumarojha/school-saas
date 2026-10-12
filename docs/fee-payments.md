# Manual fee payments — Step 2

FeePayment records are immutable through the application. CASH, UPI and BANK_TRANSFER entries are manual organization records; no gateway verification, refunds, payment edit/delete, or receipts are implemented. Existing charges may be collected even when the student is inactive.

## Migration and local setup

20261012030000_fee_payments adds FeePaymentMethod, FeePayment, the charge composite unique key, payment/charge composite FK, positive INTEGER amount check, organization/submission-key uniqueness and a charge-history index. Existing charges, students, groups, admission numbers and counters are untouched.

No migration was applied. Using the existing environment configuration:

```powershell
Set-Location 'C:\Users\aojha\school-saas'
npm.cmd run db:validate
npm.cmd run db:migrate
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run dev
```

db:migrate uses prisma migrate deploy and applies ALL pending migrations.

## Money, date and transaction behavior

The existing exact rupee-string parser is reused (₹0.01 to ₹2,14,74,836.47). Payment dates are actual calendar dates no later than today's Asia/Kolkata date, stored as DATE and rendered at UTC to preserve date-only meaning. References are trimmed to at most 100 characters; notes at most 500; blank values are stored as null.

Every write independently verifies current membership and OWNER/ADMIN role. Recorder identity comes from Clerk. Writes first lock the verified organization row, then the scoped charge row FOR UPDATE. The organization lock additionally serializes the organization-wide submission keys across different charges; this deliberately serializes all payment writes in one organization at this scale. The charge lock protects the sum/check/insert sequence.

Replay is checked before balance. Same key with equal charge, paise, date, method, reference, note and recorder returns success without another insert. Different payload is rejected. PostgreSQL SUM(INTEGER) uses BIGINT and is returned as text; server arithmetic uses BigInt. Only then is remaining balance compared and the immutable record inserted. P2034 write conflicts/deadlocks retry at most three attempts; no retry for unique, validation or ambiguous connection errors. A user retry retains the same key.

## Lists and navigation

All includes fully paid charges. Overdue/Upcoming require remaining balance greater than zero as well as the Kolkata-relative due-date condition. A shared parameterized SQL CTE aggregates organization payments, scopes charges and applies balance conditions before count/pagination. Exactly two set-based queries obtain count and page; there is no per-card payment query. Payment status is derived separately from due-date state.

Charge detail uses a repeatable-read snapshot for charge/balance/history/count and 20-record deterministic history pagination. Payment success revalidates list and detail. Student/due/list-page context is allowlisted, validated with verified organization ownership, and preserved in detail Back links, history links and payment submissions. List pages clamp when counts change.

## Verification boundaries and pending checks

Tests use mocked Clerk/database responses, static React rendering, SQL-contract assertions and a serialized transaction model. They cover partial/full payments, exact decimals, overpayment, replay/mismatch, inactive students, roles, tenant boundaries, stale forms, retry bounds, list balance predicates and modeled concurrent submissions. They do NOT establish actual PostgreSQL lock scheduling or constraints.

Before production, on an isolated PostgreSQL/Neon database:
- Apply the migration and confirm existing data is unchanged.
- Verify cross-organization charge/payment FK rejection and duplicate submission-key enforcement.
- Race separate connections paying ₹70 each against a ₹100 charge: one should succeed, one should return overpayment.
- Race identical same-key requests; confirm one record and replay success. Race different payloads with the same key across same/different charges; confirm mismatch denial.
- Force rollback and transient transaction conflicts, then verify no partial records and bounded retry behavior.
- Verify grouped balances and filtered counts across paid/partial/unpaid charges before pagination, including Kolkata midnight.

Browser checks remain pending: desktop and 390px mobile/dark-mode layouts; retained values/key and pending feedback; partial/full success and form disappearance; manual UPI/bank labels; STAFF view-only detail; inactive-student collection; history pagination; filtered list→detail→payment→Back navigation; stale test-account forms after demotion/revocation. No real database or browser tests were performed.
