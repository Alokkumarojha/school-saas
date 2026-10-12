import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), membership: vi.fn(), count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ getDb: () => ({
  membership: { findUnique: mocks.membership },
  group: { count: mocks.count, findMany: mocks.findMany, findFirst: mocks.findFirst, create: mocks.create, updateMany: mocks.updateMany },
}) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (path: string) => { throw new Error("REDIRECT:" + path); } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { Prisma } from "@/generated/prisma/client";
import { groupSchema } from "@/lib/group-validation";
import { listOrganizationGroups, getEditableGroup } from "@/lib/groups";
import { createGroup, updateGroup } from "@/app/app/org/[organizationId]/groups/actions";
import GroupsPage from "@/app/app/org/[organizationId]/groups/page";
import NewGroupPage from "@/app/app/org/[organizationId]/groups/new/page";
import EditGroupPage from "@/app/app/org/[organizationId]/groups/[groupId]/edit/page";

const orgId = "cmg00000000000000000000001";
const organization = { id: orgId, name: "School", type: "SCHOOL", slug: "school" };
const group = { id: "g1", name: "Class 6", section: "A", status: "ACTIVE" };
const params = () => Promise.resolve({ organizationId: orgId, groupId: "g1" });
function form(overrides: Record<string, string | undefined> = {}) {
  const data = new FormData();
  Object.entries({ name: "  Class   6 ", section: " A ", status: "ACTIVE", organizationId: "forged", role: "OWNER", ...overrides }).forEach(([key, value]) => { if (value !== undefined) data.set(key, value); });
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user-1" });
  mocks.membership.mockResolvedValue({ organization, role: "ADMIN" });
  mocks.count.mockResolvedValue(21);
  mocks.findMany.mockResolvedValue([group]);
  mocks.findFirst.mockResolvedValue(group);
  mocks.create.mockResolvedValue(group);
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("groups permissions and queries with mocked database", () => {
  it.each(["OWNER", "ADMIN", "STAFF"])("lets %s list with tenant-scoped count/fetch and stable pagination", async role => {
    mocks.membership.mockResolvedValue({ organization, role });
    expect(await listOrganizationGroups(orgId, "2")).toMatchObject({ total: 21, page: 2, totalPages: 2 });
    expect(mocks.count).toHaveBeenCalledWith({ where: { organizationId: orgId } });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: orgId }, skip: 20, take: 20, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
  });
  it.each(["OWNER", "ADMIN"])("allows %s create and unchanged-name edit using verified ownership", async role => {
    mocks.membership.mockResolvedValue({ organization, role });
    await expect(createGroup(orgId, { error: null }, form())).rejects.toThrow("REDIRECT:");
    expect(mocks.create).toHaveBeenCalledWith({ data: { organizationId: orgId, name: "Class 6", section: "A", status: "ACTIVE" } });
    await expect(updateGroup(orgId, "g1", { error: null }, form({ status: "INACTIVE" }))).rejects.toThrow("REDIRECT:");
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: "g1", organizationId: orgId }, data: { name: "Class 6", section: "A", status: "INACTIVE" } });
    expect(mocks.membership).toHaveBeenCalledTimes(2);
    expect(mocks.revalidate).toHaveBeenCalledWith(`/app/org/${orgId}/groups`);
  });
  it("denies STAFF on both actions and edit lookup, and hides forms/controls", async () => {
    mocks.membership.mockResolvedValue({ organization, role: "STAFF" });
    expect(await createGroup(orgId, { error: null }, form())).toMatchObject({ error: expect.stringContaining("Only owners") });
    expect(await updateGroup(orgId, "g1", { error: null }, form())).toMatchObject({ error: expect.stringContaining("Only owners") });
    await expect(getEditableGroup(orgId, "g1")).rejects.toThrow("NOT_FOUND");
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    const html = renderToStaticMarkup(await GroupsPage({ params: params(), searchParams: Promise.resolve({}) }));
    expect(html).not.toContain("/new");
    expect(html).not.toContain("/edit");
    expect(renderToStaticMarkup(await NewGroupPage({ params: params() }))).toContain("View-only access");
  });
  it("denies non-members at each boundary without queries or writes", async () => {
    mocks.membership.mockResolvedValue(null);
    await expect(listOrganizationGroups(orgId)).rejects.toThrow("NOT_FOUND");
    await expect(getEditableGroup(orgId, "g1")).rejects.toThrow("NOT_FOUND");
    await expect(createGroup(orgId, { error: null }, form())).rejects.toThrow("NOT_FOUND");
    await expect(updateGroup(orgId, "g1", { error: null }, form())).rejects.toThrow("NOT_FOUND");
    await expect(NewGroupPage({ params: params() })).rejects.toThrow("NOT_FOUND");
    [mocks.count, mocks.findMany, mocks.findFirst, mocks.create, mocks.updateMany].forEach(mock => expect(mock).not.toHaveBeenCalled());
  });
  it("does not disclose or update another organization's group", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(EditGroupPage({ params: params() })).rejects.toThrow("NOT_FOUND");
    expect(await updateGroup(orgId, "other-group", { error: null }, form())).toEqual({ error: "Class unavailable in this organization." });
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "g1", organizationId: orgId } }));
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "other-group", organizationId: orgId } }));
  });
  it.each(["STAFF", null])("rechecks stale create/edit submissions after membership becomes %s", async role => {
    await NewGroupPage({ params: params() });
    await getEditableGroup(orgId, "g1");
    const create = createGroup.bind(null, orgId);
    const update = updateGroup.bind(null, orgId, "g1");
    mocks.membership.mockResolvedValue(role ? { organization, role } : null);
    for (const submit of [create, update]) {
      if (role) expect(await submit({ error: null }, form())).toMatchObject({ error: expect.stringContaining("Only owners") });
      else await expect(submit({ error: null }, form())).rejects.toThrow("NOT_FOUND");
    }
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it.each([undefined, "0", "-1", "NaN", ["1", "2"], "9007199254740992"])("handles invalid page %j", async page => {
    expect((await listOrganizationGroups(orgId, page)).page).toBe(1);
  });
  it("clamps beyond the end and handles an empty list", async () => {
    expect((await listOrganizationGroups(orgId, "99")).page).toBe(2);
    mocks.count.mockResolvedValue(0); mocks.findMany.mockResolvedValue([]);
    expect(await listOrganizationGroups(orgId, "99")).toMatchObject({ page: 1, totalPages: 1 });
    expect(renderToStaticMarkup(await GroupsPage({ params: params(), searchParams: Promise.resolve({}) }))).toContain("No classes yet");
  });
});

describe("group normalization and duplicates (mocked constraint responses)", () => {
  it("collapses whitespace, trims, and consistently represents empty sections", () => {
    expect(groupSchema.parse({ name: " Class\t 6 ", section: " \n ", status: "ACTIVE" })).toEqual({ name: "Class 6", section: "", status: "ACTIVE" });
  });
  it.each([{ name: " " }, { name: "x".repeat(101) }, { section: "x".repeat(61) }, { status: "DELETED" }])("rejects invalid input %j", async override => {
    expect(await createGroup(orgId, { error: null }, form(override))).toMatchObject({ error: expect.any(String) });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("reports case/whitespace-equivalent duplicates on create and edit", async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" });
    mocks.create.mockRejectedValue(duplicate); mocks.updateMany.mockRejectedValue(duplicate);
    for (const submit of [createGroup.bind(null, orgId), updateGroup.bind(null, orgId, "g1")]) {
      expect(await submit({ error: null }, form({ name: " class  6 ", section: " a " }))).toEqual({ error: "A class with this name and section already exists." });
    }
  });
  it("allows separate sections and blank sections without an application-level name-only precheck", async () => {
    for (const section of ["A", "Morning", ""]) await expect(createGroup(orgId, { error: null }, form({ section }))).rejects.toThrow("REDIRECT:");
    expect(mocks.create.mock.calls.map(call => call[0].data.section)).toEqual(["A", "Morning", ""]);
  });
  it("renders Classes/Batches and prefills edits from verified organization type", async () => {
    mocks.membership.mockResolvedValue({ organization: { ...organization, type: "COACHING" }, role: "ADMIN" });
    expect(renderToStaticMarkup(await GroupsPage({ params: params(), searchParams: Promise.resolve({}) }))).toContain("Batches");
    expect(renderToStaticMarkup(await NewGroupPage({ params: params() }))).toContain("Add batch");
    const html = renderToStaticMarkup(await EditGroupPage({ params: params() }));
    expect(html).toContain("Edit batch");
    expect(html).toContain('value="Class 6"');
    expect(html).toContain('value="A"');
  });
});

