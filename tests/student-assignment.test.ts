import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({
  membership: vi.fn(), raw: vi.fn(), transaction: vi.fn(), create: vi.fn(), update: vi.fn(),
  groupList: vi.fn(), studentList: vi.fn(), count: vi.fn(), findStudent: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/organizations", () => ({ requireOrganizationMembership: mocks.membership }));
vi.mock("@/lib/db", () => ({ getDb: () => ({
  $transaction: mocks.transaction, group: { findMany: mocks.groupList },
  student: { findMany: mocks.studentList, count: mocks.count, findFirst: mocks.findStudent },
}) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
import { createStudent, updateStudent } from "@/app/app/org/[organizationId]/students/actions";
import { listOrganizationStudents } from "@/lib/students";
import EditPage from "@/app/app/org/[organizationId]/students/[studentId]/edit/page";
import NewPage from "@/app/app/org/[organizationId]/students/new/page";
import ListPage from "@/app/app/org/[organizationId]/students/page";

const org = { id: "cmg00000000000000000000001", name: "School", type: "SCHOOL" };
const active = { id: "cmg00000000000000000000002", name: "Class 6", section: "A", status: "ACTIVE" };
const inactive = { id: "cmg00000000000000000000003", name: "Class 5", section: "B", status: "INACTIVE" };
let currentGroupId: string | null;
let available: typeof active[];
let studentExists: boolean;
const params = () => Promise.resolve({ organizationId: org.id, studentId: "student-1" });
function form(groupId: string) {
  const data = new FormData();
  Object.entries({ name: "Aarav Sharma", guardianName: "Sanjay", guardianPhone: "", status: "ACTIVE", groupId, admissionNumber: "FORGED", organizationId: "foreign", role: "OWNER" }).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  currentGroupId = null; available = [active, inactive]; studentExists = true;
  mocks.membership.mockResolvedValue({ organization: org, role: "ADMIN" });
  mocks.groupList.mockImplementation(async ({ where }) => available.filter(group => !where.status || group.status === where.status));
  mocks.count.mockResolvedValue(41);
  mocks.studentList.mockResolvedValue([{ id: "student-1", name: "Aarav", admissionNumber: "ST003", guardianName: "Sanjay", status: "ACTIVE", group: active }]);
  mocks.findStudent.mockResolvedValue({ id: "student-1", name: "Aarav", admissionNumber: "LEGACY/9", guardianName: "Sanjay", guardianPhone: null, status: "ACTIVE", groupId: inactive.id, group: inactive });
  mocks.raw.mockImplementation(async (parts: TemplateStringsArray, ...values: string[]) => {
    const sql = parts.join("?");
    if (sql.includes('FROM "Organization"')) {
      expect(values).toEqual([org.id]); expect(sql).toContain("FOR UPDATE");
      return [{ id: org.id }];
    }
    if (sql.includes('FROM "Group"')) {
      expect(sql).toContain('"organizationId" = ? FOR SHARE');
      expect(values[1]).toBe(org.id);
      return available.filter(group => group.id === values[0]);
    }
    if (sql.includes('SELECT "groupId" FROM "Student"')) {
      expect(values).toEqual(["student-1", org.id]); expect(sql).toContain("FOR UPDATE");
      return studentExists ? [{ groupId: currentGroupId }] : [];
    }
    expect(sql).toContain('INSERT INTO "StudentAdmissionCounter"');
    return [{ number: "3" }];
  });
  mocks.create.mockResolvedValue({ id: "student-1" }); mocks.update.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async work => work({ $queryRaw: mocks.raw, student: { create: mocks.create, updateMany: mocks.update } }));
});

describe("assignment transactions (mocked SQL responses, not PostgreSQL)", () => {
  it.each(["OWNER", "ADMIN"])("allows %s to assign on create while preserving automatic numbering", async role => {
    mocks.membership.mockResolvedValue({ organization: org, role });
    await expect(createStudent(org.id, { error: null }, form(active.id))).rejects.toThrow("REDIRECT:");
    expect(mocks.create).toHaveBeenCalledWith({ data: { organizationId: org.id, admissionNumber: "ST003", groupId: active.id, name: "Aarav Sharma", guardianName: "Sanjay", guardianPhone: null } });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
  it("supports unassigned creates without a group lookup", async () => {
    await expect(createStudent(org.id, { error: null }, form(""))).rejects.toThrow("REDIRECT:");
    expect(mocks.create.mock.calls[0][0].data.groupId).toBeNull();
    expect(mocks.raw.mock.calls.some(call => call[0].join("").includes('FROM "Group"'))).toBe(false);
  });
  it.each(["active", "unassigned", "retained inactive"])("edits assignment: %s", async mode => {
    currentGroupId = inactive.id;
    const selected = mode === "active" ? active.id : mode === "unassigned" ? "" : inactive.id;
    await expect(updateStudent(org.id, "student-1", { error: null }, form(selected))).rejects.toThrow("REDIRECT:");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "student-1", organizationId: org.id }, data: expect.objectContaining({ groupId: selected || null }) }));
    expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty("admissionNumber");
  });
  it("preserves assignment if an older form omits the group field", async () => {
    currentGroupId = inactive.id;
    const data = form(""); data.delete("groupId");
    await expect(updateStudent(org.id, "student-1", { error: null }, data)).rejects.toThrow("REDIRECT:");
    expect(mocks.update.mock.calls[0][0].data.groupId).toBe(inactive.id);
  });
  it.each(["inactive", "foreign", "deactivated after opening"])("rejects a new %s group on both actions", async scenario => {
    const selected = scenario === "inactive" ? inactive.id : active.id;
    await NewPage({ params: params() });
    if (scenario === "foreign") available = [inactive];
    if (scenario === "deactivated after opening") available = [{ ...active, status: "INACTIVE" }, inactive];
    expect(await createStudent(org.id, { error: null }, form(selected))).toMatchObject({ error: expect.stringContaining("unavailable") });
    expect(await updateStudent(org.id, "student-1", { error: null }, form(selected))).toMatchObject({ error: expect.stringContaining("unavailable") });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.raw.mock.calls.some(call => call[0].join("").includes('INSERT INTO "StudentAdmissionCounter"'))).toBe(false);
  });
  it("checks current student scope before validating its group", async () => {
    studentExists = false;
    expect(await updateStudent(org.id, "student-1", { error: null }, form(active.id))).toMatchObject({ error: "Student unavailable in this organization." });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.raw).toHaveBeenCalledTimes(1);
  });
  it.each(["STAFF", "revoked"])("denies stale assignment forms after %s", async role => {
    await NewPage({ params: params() }); await EditPage({ params: params() });
    if (role === "STAFF") mocks.membership.mockResolvedValue({ organization: org, role });
    else mocks.membership.mockRejectedValue(new Error("NOT_FOUND"));
    for (const submit of [createStudent.bind(null, org.id), updateStudent.bind(null, org.id, "student-1")]) {
      if (role === "STAFF") expect(await submit({ error: null }, form(active.id))).toMatchObject({ error: expect.stringContaining("permission") });
      else await expect(submit({ error: null }, form(active.id))).rejects.toThrow("NOT_FOUND");
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects malformed group values before writing", async () => {
    expect(await createStudent(org.id, { error: null }, form("bad"))).toMatchObject({ error: expect.any(String) });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("assignment options and filters (mock database and static render)", () => {
  it("offers active groups and the current inactive assignment on edit only", async () => {
    const newHtml = renderToStaticMarkup(await NewPage({ params: params() }));
    expect(newHtml).toContain(active.id); expect(newHtml).not.toContain(inactive.id);
    const editHtml = renderToStaticMarkup(await EditPage({ params: params() }));
    expect(editHtml).toContain("Class 5 · B (Inactive)");
    expect(editHtml).toContain(`value="${inactive.id}" selected=""`);
    expect(editHtml).toContain("LEGACY/9");
  });
  it("offers a management link when no active options exist", async () => {
    available = [];
    const html = renderToStaticMarkup(await NewPage({ params: params() }));
    expect(html).toContain("No active classes");
    expect(html).toContain(`/app/org/${org.id}/groups/new`);
    expect(html).toContain("Unassigned");
  });
  it("combines group/search/status before count and pagination, including STAFF", async () => {
    mocks.membership.mockResolvedValue({ organization: org, role: "STAFF" });
    const result = await listOrganizationStudents(org.id, "2", { q: " Aar ", status: "ACTIVE", groupId: inactive.id });
    const where = mocks.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ organizationId: org.id, groupId: inactive.id, status: "ACTIVE", OR: expect.any(Array) });
    expect(mocks.studentList).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 20, take: 20 }));
    expect(result).toMatchObject({ groupId: inactive.id, page: 2, totalPages: 3, total: 41 });
    const html = renderToStaticMarkup(await ListPage({ params: params(), searchParams: Promise.resolve({ q: "Aar", status: "ACTIVE", groupId: inactive.id, page: "2" }) }));
    expect(html).toContain(`groupId=${inactive.id}&amp;page=3`);
    expect(html).toContain('name="page" value="1"');
    expect(html).toContain("Class 5 · B (Inactive)");
    expect(html).toContain("Class 6 · A");
    expect(html).toContain("Clear filters");
    expect(html).not.toContain(">Edit</a>");
  });
  it("filters Unassigned with null and clamps filtered pagination", async () => {
    mocks.count.mockResolvedValue(1);
    expect(await listOrganizationStudents(org.id, "9", { groupId: "unassigned" })).toMatchObject({ totalPages: 1, page: 1 });
    expect(mocks.count).toHaveBeenCalledWith({ where: { organizationId: org.id, groupId: null } });
  });
  it.each(["bad", ["", active.id], "cmg00000000000000000000009"])("rejects invalid/repeated/foreign filter %j without querying students", async groupId => {
    await expect(listOrganizationStudents(org.id, "1", { groupId })).rejects.toThrow("NOT_FOUND");
    expect(mocks.count).not.toHaveBeenCalled(); expect(mocks.studentList).not.toHaveBeenCalled();
  });
});
