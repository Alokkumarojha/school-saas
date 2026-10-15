import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), db: vi.fn(), getUser: vi.fn(), getUserList: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth, clerkClient: async () => ({ users: { getUser: mocks.getUser, getUserList: mocks.getUserList } }) }));
vi.mock("@/lib/db", () => ({ getDb: mocks.db }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { inviteTeamMember, revokeTeamInvitation, changeTeamMember, acceptTeamInvitation, previewTeamInvitation, listTeam } from "@/lib/team";
import { createInvitation, updateMember } from "@/app/app/org/[organizationId]/team/actions";
import { invitationHash } from "@/lib/team-invitation-security";
import TeamPage from "@/app/app/org/[organizationId]/team/page";
import { createStudent, updateStudent } from "@/app/app/org/[organizationId]/students/actions";
import { createGroup, updateGroup } from "@/app/app/org/[organizationId]/groups/actions";
import { createFeeCharge, searchFeeStudents } from "@/app/app/org/[organizationId]/fees/actions";
import { recordFeePayment } from "@/app/app/org/[organizationId]/fees/payment-actions";
import { saveAttendance } from "@/app/app/org/[organizationId]/attendance/actions";

const org = "cmg00000000000000000000001", other = "cmg00000000000000000000002";
const organization = { id: org, name: "Test School", type: "SCHOOL", slug: "test-school" };
type Role = "OWNER" | "ADMIN" | "STAFF";
type Member = { organizationId: string; clerkUserId: string; role: Role; revision: string; organization: typeof organization };
type Invite = { id: string; organizationId: string; email: string; role: "ADMIN" | "STAFF"; tokenHash: string; status: "PENDING" | "ACCEPTED" | "REVOKED"; expiresAt: Date; acceptedByClerkUserId: string | null; organization: typeof organization };
let members: Member[], invites: Invite[], audits: Record<string, unknown>[], lockOrder: string[], sequence: number;
type MemberKey = { organizationId_clerkUserId: { organizationId: string; clerkUserId: string } };
type InviteWhere = Partial<Pick<Invite, "id" | "organizationId" | "email" | "status" | "tokenHash">>;
const memberMatches = (member: Member, where: MemberKey) => member.organizationId === where.organizationId_clerkUserId.organizationId && member.clerkUserId === where.organizationId_clerkUserId.clerkUserId;
const inviteMatches = (invite: Invite, where: InviteWhere) => Object.entries(where).every(([key, value]) => invite[key as keyof Invite] === value);
const tx = {
  $queryRaw: vi.fn(async (_sql: TemplateStringsArray, id: string) => { lockOrder.push("organization"); return [org, other].includes(id) ? [{ id }] : []; }),
  membership: {
    findUnique: vi.fn(async ({ where }: { where: MemberKey }) => { lockOrder.push("membership"); return members.find(member => memberMatches(member, where)) ?? null; }),
    create: vi.fn(async ({ data }: { data: { organizationId: string; clerkUserId: string; role: Role } }) => { const member = { ...data, revision: randomUUID(), organization }; members.push(member); return member; }),
    update: vi.fn(async ({ where, data }: { where: MemberKey; data: Partial<Member> }) => { const member = members.find(member => memberMatches(member, where))!; Object.assign(member, data); return member; }),
    delete: vi.fn(async ({ where }: { where: MemberKey }) => { members = members.filter(member => !memberMatches(member, where)); }),
    count: vi.fn(async ({ where }: { where: { organizationId: string } }) => members.filter(m => m.organizationId === where.organizationId).length),
    findMany: vi.fn(async ({ where, skip, take }: { where: { organizationId: string }; skip: number; take: number }) => members.filter(m => m.organizationId === where.organizationId).slice(skip, skip + take)),
  },
  teamInvitation: {
    findUnique: vi.fn(async ({ where }: { where: InviteWhere }) => invites.find(invite => inviteMatches(invite, where)) ?? null),
    findFirst: vi.fn(async ({ where }: { where: InviteWhere }) => invites.find(invite => inviteMatches(invite, where)) ?? null),
    create: vi.fn(async ({ data }: { data: Omit<Invite, "id" | "status" | "acceptedByClerkUserId" | "organization"> }) => { const invite: Invite = { ...data, id: `cmg00000000000000000000${String(++sequence).padStart(3, "0")}`, status: "PENDING", acceptedByClerkUserId: null, organization }; invites.push(invite); return invite; }),
    update: vi.fn(async ({ where, data }: { where: InviteWhere; data: Partial<Invite> }) => { const invite = invites.find(invite => inviteMatches(invite, where))!; Object.assign(invite, data); return invite; }),
    count: vi.fn(async ({ where }: { where: InviteWhere }) => invites.filter(i => inviteMatches(i, where)).length),
    findMany: vi.fn(async ({ where, skip, take }: { where: InviteWhere; skip: number; take: number }) => invites.filter(i => inviteMatches(i, where)).slice(skip, skip + take)),
  },
  teamAudit: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { audits.push(data); return data; }) },
};
// In-memory serialized transaction + rollback model, NOT a PostgreSQL lock test.
let queue: Promise<unknown>;
const transaction = vi.fn(<T>(work: (client: typeof tx) => Promise<T>) => {
  const run = queue.then(async () => {
    const before = structuredClone({ members, invites, audits });
    try { return await work(tx); }
    catch (error) { ({ members, invites, audits } = before); throw error; }
  });
  queue = run.catch(() => undefined);
  return run;
});
function member(userId: string, role: Role, organizationId = org): Member { return { organizationId, clerkUserId: userId, role, revision: randomUUID(), organization: { ...organization, id: organizationId } }; }
function actor(id = "owner") { mocks.auth.mockResolvedValue({ userId: id }); }
function input(target = "admin", overrides: Record<string, unknown> = {}) { return { targetUserId: target, revision: members.find(m => m.clerkUserId === target)!.revision, role: "STAFF", operation: "role", confirmed: false, ...overrides }; }
async function invitation(role: "ADMIN" | "STAFF" = "STAFF") {
  actor();
  const result = await inviteTeamMember(org, { email: " Person.Name+school@Example.com ", role });
  const hash = invitationHash(result.link.split("#")[1]);
  return { hash, id: invites.find(i => i.tokenHash === hash)!.id, link: result.link };
}
beforeEach(() => {
  vi.clearAllMocks(); queue = Promise.resolve(); sequence = 100; lockOrder = [];
  members = [member("owner", "OWNER"), member("admin", "ADMIN"), member("staff", "STAFF"), member("other-owner", "OWNER", other)]; invites = []; audits = [];
  mocks.db.mockReturnValue({ ...tx, $transaction: transaction }); actor();
  vi.stubEnv("APP_ORIGIN", "https://vidya.example"); vi.stubEnv("TEAM_INVITATION_COOKIE_SECRET", "test-only-not-a-secret-".repeat(3));
  mocks.getUser.mockImplementation(async (id: string) => ({ id, emailAddresses: [{ emailAddress: "PERSON.NAME+school@example.com", verification: { status: "verified" } }] }));
  mocks.getUserList.mockResolvedValue({ data: [], totalCount: 0 });
});
afterEach(() => vi.unstubAllEnvs());

describe("team management authorization and audit (mocked database)", () => {
  it("OWNER creates a normalized hash-only invitation and transactional audit", async () => {
    const result = await invitation("ADMIN");
    expect(invites[0]).toMatchObject({ organizationId: org, email: "person.name+school@example.com", role: "ADMIN", tokenHash: result.hash });
    expect(invites[0].expiresAt.getTime() - Date.now()).toBeGreaterThan(7 * 86400000 - 1000);
    expect(JSON.stringify({ invites, audits })).not.toContain(result.link.split("#")[1]);
    expect(audits).toEqual([expect.objectContaining({ organizationId: org, event: "INVITED", actorClerkUserId: "owner" })]);
    expect(lockOrder.slice(0, 2)).toEqual(["organization", "membership"]);
  });
  it.each(["admin", "staff", "outsider"])("denies every management operation to %s", async id => {
    const invite = await invitation(); actor(id);
    await expect(inviteTeamMember(org, { email: "new@example.com", role: "ADMIN" })).rejects.toThrow("unavailable");
    await expect(changeTeamMember(org, input())).rejects.toThrow("unavailable");
    await expect(changeTeamMember(org, input("admin", { operation: "remove", confirmed: true }))).rejects.toThrow("unavailable");
    await expect(revokeTeamInvitation(org, invite.id)).rejects.toThrow("unavailable");
    expect(tx.membership.update).not.toHaveBeenCalled(); expect(tx.membership.delete).not.toHaveBeenCalled();
  });
  it("rejects OWNER invitation and role assignment", async () => {
    await expect(inviteTeamMember(org, { email: "x@example.com", role: "OWNER" })).rejects.toThrow();
    await expect(changeTeamMember(org, input("admin", { role: "OWNER" }))).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
  it("protects all owners, self-removal and foreign members/invitations", async () => {
    members.push(member("second-owner", "OWNER"));
    for (const target of ["owner", "second-owner", "other-owner"]) {
      await expect(changeTeamMember(org, input(target))).rejects.toThrow("unavailable");
      await expect(changeTeamMember(org, input(target, { operation: "remove", confirmed: true }))).rejects.toThrow("unavailable");
    }
    const invite = await invitation();
    actor("other-owner");
    await expect(revokeTeamInvitation(other, invite.id)).rejects.toThrow("unavailable");
    await expect(inviteTeamMember(org, { email: "new@example.com", role: "STAFF" })).rejects.toThrow("unavailable");
  });
  it("allows ADMIN ↔ STAFF and rejects stale target revisions, including removal/re-add", async () => {
    const stale = input();
    await changeTeamMember(org, stale);
    expect(members.find(m => m.clerkUserId === "admin")?.role).toBe("STAFF");
    await expect(changeTeamMember(org, { ...stale, role: "ADMIN" })).rejects.toThrow("has changed");
    await changeTeamMember(org, input("admin", { role: "ADMIN" }));
    await expect(changeTeamMember(org, stale)).rejects.toThrow("has changed");
    members = members.filter(m => m.clerkUserId !== "admin"); members.push(member("admin", "ADMIN"));
    await expect(changeTeamMember(org, stale)).rejects.toThrow("has changed");
    expect(audits.map(a => a.event)).toEqual(["MEMBER_ROLE_CHANGED", "MEMBER_ROLE_CHANGED"]);
  });
  it("requires explicit removal confirmation and only removes membership", async () => {
    await expect(changeTeamMember(org, input("admin", { operation: "remove" }))).rejects.toThrow("Confirm removal");
    await changeTeamMember(org, input("admin", { operation: "remove", confirmed: true }));
    expect(members.some(m => m.clerkUserId === "admin")).toBe(false);
    expect(audits.at(-1)).toMatchObject({ event: "MEMBER_REMOVED", targetClerkUserId: "admin" });
    expect(tx.membership.delete).toHaveBeenCalledWith({ where: { organizationId_clerkUserId: { organizationId: org, clerkUserId: "admin" } } });
  });
  it("models two role changes from the same revision as one success and one stale form", async () => {
    const stale = input();
    const results = await Promise.allSettled([changeTeamMember(org, stale), changeTeamMember(org, { ...stale, role: "ADMIN" })]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(audits).toHaveLength(1);
  });
  it.each(["ADMIN", "STAFF", null])("rechecks owner authority inside the transaction after access becomes %s", async role => {
    const stale = input();
    const invite = await invitation();
    if (role) members[0].role = role as Role; else members.shift();
    await expect(changeTeamMember(org, stale)).rejects.toThrow("unavailable");
    await expect(inviteTeamMember(org, { email: "new@example.com", role: "STAFF" })).rejects.toThrow("unavailable");
    await expect(revokeTeamInvitation(org, invite.id)).rejects.toThrow("unavailable");
    expect(tx.membership.update).not.toHaveBeenCalled();
  });
  it("rolls back writes when the audit fails", async () => {
    tx.teamAudit.create.mockRejectedValueOnce(new Error("audit failed"));
    await expect(invitation()).rejects.toThrow("audit failed");
    expect(invites).toHaveLength(0);
    tx.teamAudit.create.mockRejectedValueOnce(new Error("audit failed"));
    await expect(changeTeamMember(org, input())).rejects.toThrow("audit failed");
    expect(members.find(m => m.clerkUserId === "admin")?.role).toBe("ADMIN");
  });
  it("models duplicate concurrent pending invitations and explicit revoke/reissue", async () => {
    const results = await Promise.allSettled([inviteTeamMember(org, { email: " Test@Example.com ", role: "STAFF" }), inviteTeamMember(org, { email: "test@example.com", role: "ADMIN" })]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1); expect(invites).toHaveLength(1);
    invites[0].expiresAt = new Date(0);
    await expect(inviteTeamMember(org, { email: "test@example.com", role: "STAFF" })).rejects.toThrow("Revoke");
    await revokeTeamInvitation(org, invites[0].id);
    await inviteTeamMember(org, { email: "test@example.com", role: "STAFF" });
    expect(invites.map(i => i.status)).toEqual(["REVOKED", "PENDING"]);
  });
});

describe("invitation acceptance (mocked identity and serialized transactions)", () => {
  it.each(["ADMIN", "STAFF"] as const)("explicitly joins as %s with server identity, not browser roles", async role => {
    const invite = await invitation(role); actor("recipient");
    expect(await previewTeamInvitation(invite.hash)).toMatchObject({ name: "Test School", role });
    expect(members.some(m => m.clerkUserId === "recipient")).toBe(false);
    expect(await acceptTeamInvitation(invite.hash, invite.id)).toBe(org);
    expect(members.find(m => m.clerkUserId === "recipient")).toMatchObject({ role, organizationId: org });
    expect(audits.at(-1)).toMatchObject({ event: "INVITE_ACCEPTED", actorClerkUserId: "recipient" });
  });
  it.each(["unverified", "wrong", "dots", "plus", "failure"])("rejects %s identity without disclosing details", async kind => {
    const invite = await invitation(); actor("recipient");
    if (kind === "failure") mocks.getUser.mockRejectedValue(new Error("Clerk down"));
    else mocks.getUser.mockResolvedValue({ id: "recipient", emailAddresses: [{ emailAddress: kind === "wrong" ? "other@example.com" : kind === "dots" ? "personname+school@example.com" : kind === "plus" ? "person.name@example.com" : "person.name+school@example.com", verification: { status: "unverified" === kind ? "unverified" : "verified" } }] });
    await expect(previewTeamInvitation(invite.hash)).rejects.toThrow("does not match");
    await expect(acceptTeamInvitation(invite.hash, invite.id)).rejects.toThrow("does not match");
    expect(tx.membership.create).not.toHaveBeenCalled();
  });
  it.each(["expired", "revoked", "invalid", "wrong-preview"])("rejects %s invitations and cross-tab cookie replacement", async kind => {
    const invite = await invitation();
    if (kind === "expired") invites[0].expiresAt = new Date(0);
    if (kind === "revoked") await revokeTeamInvitation(org, invite.id);
    actor("recipient");
    await expect(acceptTeamInvitation(kind === "invalid" ? "f".repeat(64) : invite.hash, kind === "wrong-preview" ? "another-invite" : invite.id)).rejects.toThrow("unavailable");
    expect(tx.membership.create).not.toHaveBeenCalled();
  });
  it("models concurrent/repeated acceptance as one membership and one acceptance audit", async () => {
    const invite = await invitation(); actor("recipient");
    expect(await Promise.all([acceptTeamInvitation(invite.hash, invite.id), acceptTeamInvitation(invite.hash, invite.id)])).toEqual([org, org]);
    expect(tx.membership.create).toHaveBeenCalledTimes(1);
    expect(audits.filter(a => a.event === "INVITE_ACCEPTED")).toHaveLength(1);
    expect(await acceptTeamInvitation(invite.hash, invite.id)).toBe(org);
  });
  it("models acceptance queued behind revocation using the same org lock", async () => {
    const invite = await invitation();
    const revoking = revokeTeamInvitation(org, invite.id);
    await Promise.resolve(); actor("recipient");
    const accepting = acceptTeamInvitation(invite.hash, invite.id);
    await revoking;
    await expect(accepting).rejects.toThrow("unavailable");
    expect(invites[0].status).toBe("REVOKED"); expect(tx.membership.create).not.toHaveBeenCalled();
  });
  it("does not revoke a consumed invitation or allow another verified account to replay it", async () => {
    const invite = await invitation(); actor("recipient");
    await acceptTeamInvitation(invite.hash, invite.id);
    actor(); await expect(revokeTeamInvitation(org, invite.id)).rejects.toThrow("unavailable");
    actor("different-recipient");
    await expect(acceptTeamInvitation(invite.hash, invite.id)).rejects.toThrow("unavailable");
    expect(tx.membership.create).toHaveBeenCalledTimes(1);
  });
  it("accepts a matching verified secondary email, but refetches verification on POST", async () => {
    const invite = await invitation(); actor("recipient");
    mocks.getUser.mockResolvedValue({ id: "recipient", emailAddresses: [
      { emailAddress: "primary@example.com", verification: { status: "verified" } },
      { emailAddress: "person.name+school@example.com", verification: { status: "verified" } },
    ] });
    await previewTeamInvitation(invite.hash);
    mocks.getUser.mockResolvedValue({ id: "recipient", emailAddresses: [] });
    await expect(acceptTeamInvitation(invite.hash, invite.id)).rejects.toThrow("unavailable");
    expect(tx.membership.create).not.toHaveBeenCalled();
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
  });
  it.each(["OWNER", "ADMIN", "STAFF"] as const)("preserves existing %s membership on acceptance", async role => {
    const invite = await invitation(role === "STAFF" ? "ADMIN" : "STAFF");
    members.push(member("recipient", role)); actor("recipient");
    await acceptTeamInvitation(invite.hash, invite.id);
    expect(members.find(m => m.clerkUserId === "recipient")?.role).toBe(role);
    expect(tx.membership.create).not.toHaveBeenCalled(); expect(tx.membership.update).not.toHaveBeenCalled();
  });
  it("never recreates membership using a consumed invite after owner removal", async () => {
    const invite = await invitation(); actor("recipient"); await acceptTeamInvitation(invite.hash, invite.id);
    actor(); await changeTeamMember(org, input("recipient", { operation: "remove", confirmed: true }));
    actor("recipient");
    await expect(acceptTeamInvitation(invite.hash, invite.id)).rejects.toThrow("unavailable");
    await expect(previewTeamInvitation(invite.hash)).rejects.toThrow("unavailable");
    expect(tx.membership.create).toHaveBeenCalledTimes(1);
  });
  it("rolls back both consumption and membership on audit failure", async () => {
    const invite = await invitation(); actor("recipient");
    tx.teamAudit.create.mockRejectedValueOnce(new Error("audit failed"));
    await expect(acceptTeamInvitation(invite.hash, invite.id)).rejects.toThrow("audit failed");
    expect(invites[0].status).toBe("PENDING"); expect(members.some(m => m.clerkUserId === "recipient")).toBe(false);
  });
});

describe("bounded team UI and access removal from existing modules", () => {
  it.each(["owner", "admin", "staff"])("lists only this organization for %s and limits invite details to owners", async id => {
    await invitation(); actor(id);
    const html = renderToStaticMarkup(await TeamPage({ params: Promise.resolve({ organizationId: org }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("Staff currently have view-only access");
    expect(html.includes("Invite a team member")).toBe(id === "owner");
    expect(html.includes("person.name+school@example.com")).toBe(id === "owner");
    expect(html.includes("Remove member")).toBe(id === "owner");
    expect(tx.teamInvitation.findMany.mock.calls.length > 0).toBe(id === "owner");
    expect(mocks.getUserList).toHaveBeenCalledWith({ userId: ["owner", "admin", "staff"], limit: 20 });
    expect(html).not.toContain("other-owner");
  });
  it("paginates both lists, clamps malformed pages, and bounds Clerk lookups", async () => {
    for (let i = 0; i < 42; i++) members.push(member(`member-${i}`, "STAFF"));
    const first = await invitation();
    for (let i = 0; i < 22; i++) invites.push({ ...invites[0], id: `id-${i}`, email: `${i}@example.com` });
    const result = await listTeam(org, { page: "2", invites: "2" });
    expect(result.members).toHaveLength(20); expect(result.invitations?.items).toHaveLength(3);
    expect(tx.membership.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { organizationId: org }, skip: 20, take: 20, orderBy: [{ createdAt: "asc" }, { clerkUserId: "asc" }] }));
    expect((await listTeam(org, { page: ["1", "2"], invites: "-2" })).page).toBe(1);
    expect((await listTeam(org, { page: "999", invites: "999" })).invitations?.page).toBe(2);
    const html = renderToStaticMarkup(await TeamPage({ params: Promise.resolve({ organizationId: org }), searchParams: Promise.resolve({ page: "2", invites: "2" }) }));
    expect(html).toContain("page=1&amp;invites=2"); expect(html).toContain("page=2&amp;invites=1"); expect(html).not.toContain(first.hash);
  });
  it("profile failures retain access and use neutral fallback; non-members query no lists", async () => {
    mocks.getUserList.mockRejectedValue(new Error("Clerk down"));
    expect((await listTeam(org, {})).members[0].profile).toEqual({ name: "Team member", email: null });
    actor("outsider"); tx.membership.findMany.mockClear();
    await expect(listTeam(org, {})).rejects.toThrow("NOT_FOUND");
    expect(tx.membership.findMany).not.toHaveBeenCalled();
  });
  it("actions return readable errors and never accept forged actor fields", async () => {
    actor("staff"); const form = new FormData(); form.set("email", "new@example.com"); form.set("role", "ADMIN"); form.set("clerkUserId", "owner");
    expect(await createInvitation(org, {}, form)).toHaveProperty("error");
    form.set("role", "STAFF"); form.set("operation", "role");
    expect(await updateMember(org, "admin", members[1].revision, {}, form)).toHaveProperty("error");
    expect(tx.membership.update).not.toHaveBeenCalled();
  });
  it("removed ADMIN cannot submit previously-open forms in any existing module", async () => {
    actor("admin"); await listTeam(org, {});
    actor(); await changeTeamMember(org, input("admin", { operation: "remove", confirmed: true })); actor("admin");
    const form = new FormData();
    const actions = [
      () => createStudent(org, { error: null }, form), () => updateStudent(org, "student", { error: null }, form),
      () => createGroup(org, { error: null }, form), () => updateGroup(org, "group", { error: null }, form),
      () => createFeeCharge(org, { error: null }, form), () => recordFeePayment(org, "charge", { error: null }, form),
      () => searchFeeStudents(org, "Asha", 1), () => saveAttendance(org, {}),
    ];
    transaction.mockClear();
    for (const action of actions) await expect(action()).rejects.toThrow("NOT_FOUND");
    expect(transaction).not.toHaveBeenCalled();
  });
});
