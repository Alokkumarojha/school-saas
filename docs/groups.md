# Classes / Batches

The shared Group model and /app/org/[organizationId]/groups routes use the verified organization's type to display Classes for schools and Batches for coaching organizations.

OWNER/ADMIN can create/edit; STAFF can list. Every action and query rechecks membership; editable lookups and updates require both the group ID and verified organization ID. Forms never supply authoritative roles or ownership. Names and sections are trimmed and internal whitespace collapsed. Empty sections are stored as non-null empty strings. Status may be ACTIVE or INACTIVE; no deletion or student assignment is implemented.

## Migration

20261012000000_organization_groups creates GroupStatus, Group, an organization foreign key, a pagination index, and the unique expression index Group_organization_name_section_key. It does not update existing organizations, students, or admission counters.

The unique key consists of organizationId plus lowercased, whitespace-normalized name and section. Different sections are allowed, inactive groups still reserve their name/section, and unchanged edits do not conflict with themselves. PostgreSQL enforces uniqueness, including concurrent writes; application validation alone is not the constraint.

Prisma 7.10.0 cannot express this expression index in the model's @@unique syntax. Its SQL migration is authoritative; preserve the index when preparing future migrations and review schema-diff output. Database lower() uses the database collation's case behavior.

No migration was applied during implementation. Run locally using existing environment configuration:

```powershell
Set-Location 'C:\Users\aojha\school-saas'
npm.cmd run db:validate
npm.cmd run db:migrate
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run dev
```

db:migrate runs prisma migrate deploy and applies ALL pending migrations.

## Verification boundaries

Vitest uses mocked Clerk/database calls and static React rendering. Tests cover permissions, tenant scoping, stale submissions after demotion/revocation, whitespace normalization, duplicate-error responses, unchanged edits, different sections, status changes, pagination, and terminology/navigation. Mocked P2002 responses do not verify the real PostgreSQL unique index.

Pending in a disposable database: apply the migration, create equivalent mixed-case/whitespace name-section pairs (including blank sections), verify one fails, verify different sections and different organizations succeed, verify unchanged edits and concurrent duplicates, and confirm existing students/counters are untouched.

Pending browser checks: school/coaching labels; STAFF controls and direct URLs; create/edit pending feedback and retained input after duplicate errors; Active/Inactive badges; pagination past 20 records; desktop sidebar and 390px mobile bottom navigation in both themes; stale forms after changing test-only membership. No browser or live database verification was performed.
