# Organization overview

The organization workspace reads real records through `getOrganizationDashboard`. Its data boundary independently requires current Clerk membership and uses only the returned organization ID. OWNER/ADMIN see existing create links; STAFF see view links. Existing module authorization remains in place. The public sample dashboard and shared shell are unchanged.

## Metric definitions

- Active students: organization students with status ACTIVE, including Unassigned.
- Active Classes/Batches: organization groups with status ACTIVE, including empty groups.
- Fees (all-time): charged is the sum of FeeCharge.amountPaise; collected is the sum of recorded FeePayment.amountPaise for those charges. Historical charges/payments remain included regardless of student status.
- Outstanding: sum of each charge's amount minus its recorded payments, using the existing fee balance rule. Fully paid charges contribute zero. Invalid negative/overpaid balances fail rather than being silently clamped.
- Overdue: outstanding balances only for charges with dueDate strictly before today's date in Asia/Kolkata. Today-due and future charges are excluded.
- Today's recorded attendance: saved PRESENT, ABSENT and LATE records on today's Kolkata calendar date, without joining current students/groups or filtering their active status. No inferred Absence or Unmarked count.

Payments currently represent manual records, including UPI/bank transfer entries, not gateway confirmation or bank settlement.

## Query and precision guarantees

One repeatable-read transaction executes four bounded aggregate queries: active student count, active group count, fee totals, and attendance grouped by status (at most three rows). Membership is checked before the transaction. All fee totals come from one SQL statement in the same snapshot. Payments are grouped by organization/charge before the charge join, preventing multiplication of charged amounts when several payments exist. Both sides of the join are organization scoped. No directory or charge/payment history is loaded into application memory.

PostgreSQL BIGINT/NUMERIC sums are returned as decimal text, then converted to bigint. Rupees and paise are formatted using integer quotient/remainder and en-IN grouping; aggregate values are never converted to floating-point Number. There is no persistent cache, and the page explicitly uses force-dynamic rendering. The date is calculated once per request. Refresh the page after Kolkata midnight or external changes to see an updated snapshot.

## Verification limits and manual checklist

Vitest tests use fixture-backed mocks plus SQL-contract assertions and static React rendering. They check scoping, role UI, zero values, active/inactive counts, per-charge balance scenarios, date boundaries, large sums, and retained attendance. They do NOT execute the SQL against PostgreSQL or prove database snapshot behavior.

Browser navigation to the running local app reached the sign-in page; no authenticated dashboard visual verification was possible in that browser session.

Manual checks with an authorized account, without changing production records:

1. Open two organizations; compare dashboard counts/totals with their existing module records and confirm all links stay in the selected organization.
2. Use a disposable test organization to verify zero states, mixed active/inactive students/groups, partial/full payments, multiple payments per charge, and yesterday/today/future due dates.
3. Check saved attendance remains counted after student/group inactivation or transfer. Verify active-student count is not used to infer absence.
4. Compare OWNER/ADMIN create links with STAFF view-only links; verify a non-member cannot load the organization URL.
5. Check desktop and 390px layouts, both themes, long organization names and large INR values. Confirm safe-area bottom navigation does not cover content.
6. On a disposable database, compare the aggregate SQL with independently calculated sums and verify a consistent snapshot while another transaction records a payment.

No new migration, schema, dependency, environment setting, or live-data changes are required.
