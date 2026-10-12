import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ membership: vi.fn(), group: vi.fn(), transaction: vi.fn(), update: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/organizations", () => ({ requireOrganizationMembership: mocks.membership }));
vi.mock("@/lib/db", () => ({ getDb: () => ({
  $transaction: mocks.transaction,
  group: { findFirst: mocks.group, findMany: async () => [] },
  student: { findFirst: async () => ({ id: "s1", name: "Aarav", admissionNumber: "ST001", guardianName: "Sanjay", guardianPhone: "", status: "ACTIVE", groupId: null }), count: async () => 45, findMany: async () => [{ id: "s1", name: "Aarav", admissionNumber: "ST001", guardianName: "Sanjay", status: "ACTIVE" }] },
}) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
import EditPage from "@/app/app/org/[organizationId]/students/[studentId]/edit/page";
import ListPage from "@/app/app/org/[organizationId]/students/page";
import { updateStudent } from "@/app/app/org/[organizationId]/students/actions";
import { validateStudentReturn } from "@/lib/student-return";
import { studentListDestination } from "@/lib/student-list-context";
const org = { id: "verified-org", name: "School", type: "SCHOOL" };
const groupId = "cmg00000000000000000000001";
function form() {
  const data = new FormData();
  Object.entries({ name: "Aarav", guardianName: "Sanjay", guardianPhone: "", status: "INACTIVE", "return.page": "2", "return.q": " Aar ", "return.status": "ACTIVE", "return.groupId": groupId, returnUrl: "https://evil.example", organizationId: "foreign" }).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.membership.mockResolvedValue({ organization: org, role: "ADMIN" });
  mocks.group.mockResolvedValue({ id: groupId });
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async work => work({ $queryRaw: async () => [{ groupId: null }], student: { updateMany: mocks.update } }));
});
describe("student edit return navigation (mocks/static rendering)", () => {
  it("carries normalized clamped page and filters in list edit links", async () => {
    const html = renderToStaticMarkup(await ListPage({ params: Promise.resolve({ organizationId: "requested" }), searchParams: Promise.resolve({ page: "99", q: " Aar ", status: "ACTIVE", groupId: "unassigned" }) }));
    expect(html).toContain("/s1/edit?q=Aar&amp;status=ACTIVE&amp;groupId=unassigned&amp;page=3");
  });
  it("preserves combined filters in Back and hidden submission fields", async () => {
    const html = renderToStaticMarkup(await EditPage({ params: Promise.resolve({ organizationId: "requested", studentId: "s1" }), searchParams: Promise.resolve({ page: "2", q: " Aar ", status: "ACTIVE", groupId }) }));
    expect(html).toContain(`href="/app/org/verified-org/students?q=Aar&amp;status=ACTIVE&amp;groupId=${groupId}&amp;page=2"`);
    for (const [key, value] of Object.entries({ page: "2", q: "Aar", status: "ACTIVE", groupId })) {
      expect(html).toContain(`name="return.${key}" value="${value}"`);
    }
    expect(mocks.group).toHaveBeenCalledWith({ where: { id: groupId, organizationId: org.id }, select: { id: true } });
  });
  it("returns to page 2 even when an edit no longer matches the original status", async () => {
    await expect(updateStudent("requested", "s1", { error: null }, form())).rejects.toThrow(`REDIRECT:/app/org/verified-org/students?q=Aar&status=ACTIVE&groupId=${groupId}&page=2`);
    expect(mocks.update.mock.calls[0][0].data.status).toBe("INACTIVE");
  });
  it("retains return fields through validation failure and resubmission", async () => {
    const data = form(); data.set("name", "");
    expect(await updateStudent("requested", "s1", { error: null }, data)).toMatchObject({ error: expect.any(String) });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(data.get("return.page")).toBe("2");
    data.set("name", "Aarav");
    await expect(updateStudent("requested", "s1", { error: "previous error" }, data)).rejects.toThrow("page=2");
  });
  it("defaults direct edit Back and save to the plain list", async () => {
    const html = renderToStaticMarkup(await EditPage({ params: Promise.resolve({ organizationId: "requested", studentId: "s1" }) }));
    expect(html).toContain('href="/app/org/verified-org/students"');
    const data = form();
    ["page", "q", "status", "groupId"].forEach(key => data.delete("return." + key));
    await expect(updateStudent("requested", "s1", { error: null }, data)).rejects.toThrow("REDIRECT:/app/org/verified-org/students");
  });
  it("ignores arbitrary destinations and normalizes malformed scalar parameters", async () => {
    const context = await validateStudentReturn(org.id, { page: ["2", "3"], q: ["x", "y"], status: "bad", returnUrl: "//evil.example", organizationId: "foreign" });
    expect(studentListDestination(org.id, context)).toBe("/app/org/verified-org/students?page=1");
    const long = await validateStudentReturn(org.id, { page: "9007199254740992", q: " " + "x".repeat(101), status: "INACTIVE" });
    expect(long.page).toBe("1"); expect(long.q).toHaveLength(100);
  });
  it.each(["https://evil.example", ["unassigned", groupId]])("denies malformed return group %j before writing", async value => {
    await expect(validateStudentReturn(org.id, { groupId: value })).rejects.toThrow("NOT_FOUND");
  });
  it("denies foreign groups and repeated hidden group parameters before saving", async () => {
    mocks.group.mockResolvedValue(null);
    await expect(updateStudent("requested", "s1", { error: null }, form())).rejects.toThrow("NOT_FOUND");
    const data = form(); data.append("return.groupId", "unassigned");
    await expect(updateStudent("requested", "s1", { error: null }, data)).rejects.toThrow("NOT_FOUND");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
