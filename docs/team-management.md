# Team Management Step 1

Prisma `Organization` and `Membership` remain the access authority. Clerk supplies authentication and server-verified identity; this feature does not use Clerk Organizations. Public sample pages are unchanged.

## Permissions

| Role | Member list | Pending invitations | Invite/revoke | Change ADMIN ↔ STAFF | Remove non-owner |
| --- | --- | --- | --- | --- | --- |
| OWNER | Yes | Yes | Yes | Yes | Yes, explicit confirmation |
| ADMIN | Yes | No | No | No | No |
| STAFF | Yes | No | No | No | No |

All OWNER memberships are protected, including the current user. No ownership transfers, OWNER invitations, owner demotion/removal, or self-removal are supported. Staff remain view-only in existing modules. Team access is in the desktop sidebar and mobile header; the bottom navigation remains five items.

Management actions authenticate on every call, lock the organization row, then re-read the actor's Prisma membership and OWNER role inside the write transaction. Target memberships/invitations are scoped to that organization. Every membership has a UUID revision, replaced on role changes, to reject old management forms (including remove/re-add and ADMIN → STAFF → ADMIN cycles).

## Data and migration

Migration: `20261014000000_team_management` (created, not applied).

- Adds a UUID revision to existing memberships without changing their roles. PostgreSQL `gen_random_uuid()` backfills existing rows; new UUIDs are supplied by Prisma. Requires PostgreSQL 13+ (supported by Neon).
- Adds `TeamInvitation`: organization, normalized email, ADMIN/STAFF role, SHA-256 token hash, pending/accepted/revoked status, expiry, creator/accepter IDs, and timestamps. There is no raw-token column.
- Adds a database partial unique index on `(organizationId, email)` for PENDING invitations, plus a unique token hash and bounded-list index.
- Adds `TeamAudit`: organization, actor/target Clerk IDs, event, invitation ID, previous/next role, and timestamp. No raw token, token hash, or email is written to audit records. Audits commit or roll back with their changes. Audit browsing/export is not part of this step.
- Membership removal deletes only the membership. Existing student, fee, payment, attendance, and author-history records are untouched.

All team writes use PostgreSQL READ COMMITTED transactions and acquire the organization row lock first. This serializes duplicate pending invitations, acceptance versus revocation/removal, and competing role changes for an organization. A partial unique index independently enforces the pending-invitation invariant. No automatic retry hides a failed transaction: the user can retry; acceptance replay is idempotent. Creation is not submission-idempotent: if its response is lost, the pending invitation remains, and the owner must revoke/reissue to recover a link.

Expired pending invitations continue occupying their unique slot until revoked. A lost link is also revoked and reissued. Reissue creates a new token; the old one stays invalid. Accepting a pending invite consumes it even for an existing member, preserving that member's current role. A replay returns the existing membership only for the original accepting user. It never recreates membership after removal, and all invitations remain subject to their seven-day expiry.

## Configuration (do not commit secrets)

Existing Clerk and database configuration stays in place. Add these through local process configuration or your deployment secret manager:

- `APP_ORIGIN`: one trusted canonical origin, e.g. `http://localhost:3000` during local development, or `https://your-app.example` in production. No path/query/fragment/credentials. Production requires HTTPS; non-production HTTP is allowed only on localhost/127.0.0.1. Never derive this from request Host/Forwarded headers. Ensure this origin serves `/join` directly without a redirect to a different host.
- `TEAM_INVITATION_COOKIE_SECRET`: a separately generated random secret containing at least 32 bytes of entropy, shared by all app instances. This is not a Clerk API key. Store securely; never log it. Rotation invalidates current one-hour invitation sessions; recipients can reopen original unexpired links.

Example local PowerShell setup without printing the signing secret or editing an environment file:

```powershell
Set-Location 'C:\Users\aojha\school-saas'
$env:APP_ORIGIN = 'http://localhost:3000'
$invitationBytes = New-Object byte[] 32
$invitationRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$invitationRng.GetBytes($invitationBytes)
$invitationRng.Dispose()
$env:TEAM_INVITATION_COOKIE_SECRET = [Convert]::ToBase64String($invitationBytes)
```

For production, generate/store a persistent secret through your secret manager and set `APP_ORIGIN` to the deployed HTTPS origin. Configure that origin and sign-in/sign-up routes in the existing Clerk application's allowed redirect/origin settings. No Clerk invitation-sending API is called and no new messaging provider is needed.

After reviewing the migration and confirming your existing database configuration points to the intended local/test database, run these commands yourself (not run during this implementation):

```powershell
Set-Location 'C:\Users\aojha\school-saas'
npm run db:validate
npm run db:migrate
npm run db:generate
npm run dev
```

`db:migrate` runs `prisma migrate deploy` and applies **all pending migrations**. Inspect pending migrations with `npx prisma migrate status` first if needed. Do not use `db push` or reset. The app needs this migration before Team can be used against that database.

## Invitation privacy and sign-in flow

1. Owner receives a copyable `${APP_ORIGIN}/join#<token>` link once. The token has 32 random bytes (base64url). The database keeps only its SHA-256 hash. The app sends no email/SMS.
2. `/join` has no Clerk client, analytics, external images, or other third-party resources. A strict same-origin resource policy, no-referrer, no-store, and noindex headers apply. The fragment is not sent in the HTTP URL or Referrer. Client code immediately removes it from browser history, then POSTs it to a Next server action.
3. The server puts a signed hash and one-hour expiry in an HttpOnly, SameSite=Lax cookie limited to `/join` (Secure in production). The raw token is not stored in cookies or browser storage. A database hash alone cannot forge this signed session.
4. The browser opens `/join/accept`. If signed out, sign-in/sign-up preserve only the allowlisted `/join/accept` return destination, never the token or arbitrary return URLs. Other return values fall back to `/app`.
5. The server fetches the current Clerk user and requires an email with verification status `verified`, matching after trim/lowercase only. Dots and plus suffixes are significant. A matching verified secondary address is allowed.
6. Opening the page only previews the invitation. Explicit Join rechecks identity and invitation state, then atomically consumes it, creates membership if absent, and writes audit. A bound invitation ID prevents another tab's invitation cookie from joining a different organization than the displayed preview.

Do not add analytics/session replay/third-party scripts to `/join`, log POST bodies or cookies, or capture invitation response bodies in monitoring. Configure reverse proxies/APM to redact these routes' payloads and cookies. Link text is confidential; share it privately. Keep the canonical HTTPS origin free of redirects that might forward the fragment. Clerk middleware only runs after the fragment is stripped, on `/join/accept`.

## Limits and verification

- Lists paginate at 20 records with deterministic ordering; member display uses at most one Clerk `getUserList` request for 20 IDs. Display lookup failure produces “Team member / Profile unavailable” without changing authorization. Identity lookup failure during acceptance fails closed.
- Invitation sessions need JavaScript and expire after one hour; reopen the original link after expiry. Opening another invite replaces the cookie, so an older preview returns an error rather than joining the wrong organization.
- No automatic sending, bulk invitations, ownership changes, audit UI, automatic invite cleanup, or rate-limiting service is added. Keep operational limits/monitoring appropriate to deployment.
- Previously rendered pages can remain visible in a removed member's browser; subsequent server requests/actions recheck membership. Already in-flight legacy module transactions may complete; this is not a remote sign-out or cancellation system.
- Automated tests use mocked Clerk/database responses and an explicitly serialized in-memory transaction model. They verify code paths, query scoping, rollback handling, and race/replay outcomes in that model. They do **not** verify PostgreSQL locks/constraints, real Clerk redirects/email verification, clipboard behavior, or browser layout/header enforcement.

### Two-account local checklist (test database only)

1. Apply the migration yourself. Sign in as account A, an owner. Create a STAFF invitation for account B's verified email. Check 390px and desktop in both themes, including long email/name wrapping, copy feedback, member/invite pagination, and five bottom links.
2. Open the link in account B's separate browser profile, initially signed out. Complete sign-in (and separately test sign-up) and verify arrival at the explicit Join page. Check that GET creates no membership. Check wrong/unverified email shows no organization details. Confirm tokens are absent from request URLs, referrers, storage, third-party requests and server logs; verify no-store/CSP headers in the deployed build.
3. Join as B. Verify the organization picker and correct org-specific module links, view-only STAFF controls, and denial of direct writes. A promotes B to ADMIN; test normal authorized module forms. A demotes B while forms remain open; submitting must be denied. Test stale team-role forms in two A tabs.
4. A removes B after explicit confirmation while B has student/group/charge/payment/attendance forms open. Verify all subsequent list requests/actions deny access and historical records remain. Replay B's consumed link; membership must not return. A issues a new invitation; B can join again. Invite an already-present B to a different role and confirm no role change on acceptance.
5. Revoke a pending invite and test its old link. Reissue and ensure only the new link works. On a disposable database fixture, test expiry and multiple OWNER protection without changing production memberships.
6. With real PostgreSQL connections and test identities, race two accepts, accept versus revoke, duplicate invitations, two role changes, and accept versus removal. Verify one valid final state, no duplicate membership/pending invite, matching transactional audit, and removed-member replay denial. Verify rollback by forcing a transaction failure in an isolated test environment.

Official SDK references: [Clerk server client](https://clerk.com/docs/reference/backend/overview), [getUser](https://clerk.com/docs/reference/backend/user/get-user), [getUserList](https://clerk.com/docs/reference/backend/user/get-user-list), [verified email representation](https://clerk.com/docs/reference/backend/types/backend-email-address), and [redirect configuration](https://clerk.com/docs/guides/development/customize-redirect-urls).

## CSP boundaries

The original `/join/:path*` policy unintentionally covered `/join/accept`. A client-side redirect or Link from that document retained its same-origin-only CSP, blocking Clerk on subsequent auth/organization pages. There was one CSP emitter in the repository, not two conflicting project headers.

The restrictive policy now matches **only `/join`**. The landing strips the fragment before POSTing it, waits for the HttpOnly session cookie, then uses `window.location.replace('/join/accept')` for a full document load. Its home/exit anchor also uses a full document navigation, not a prefetched Next Link. Do not change these boundary crossings to router navigation.

`/join/accept`, `/sign-in/*`, `/sign-up/*`, and `/app/*` share a Clerk-compatible policy. Their client-side navigation therefore retains a compatible policy. `next.config.ts` is the sole CSP emitter; do not also enable Clerk's automatic middleware CSP or add a second proxy/CDN CSP without reviewing the effective intersection. Public sample pages retain their existing header behavior.

The Clerk Frontend API origin is derived from the existing public `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; no development hostname is hardcoded. The policy follows [Clerk's official CSP guidance](https://clerk.com/docs/guides/secure/best-practices/csp-headers), including Cloudflare challenges, Clerk image/worker/style sources and narrowly scoped `https://*.protect.clerk.com` sources. Connections include `https://*.protect.clerk.com:*` because Clerk protection uses non-443 ports. There is no unrestricted `*`, `http:`, or `https:` source. `unsafe-eval` is development-only. No additional environment configuration is required.

Clerk converts the internal invitation return path to an absolute URL when switching sign-in/sign-up forms. Redirect validation accepts only `/join/accept` or its exact absolute representation under the existing configured `APP_ORIGIN`, then returns the fixed relative path. Arbitrary external paths, query strings, fragments, repeated parameters and other organizations remain rejected. Use the configured canonical origin when opening invitation links.

All these route rules retain no-referrer and private/no-store configuration. Next's development server can override Cache-Control with `must-revalidate, no-cache`; production response headers must be verified separately. Inspect real response headers after deploying/restarting, including any hosting/CDN headers, and hard-refresh tabs opened under the old policy (hot reload cannot replace a document's CSP).
