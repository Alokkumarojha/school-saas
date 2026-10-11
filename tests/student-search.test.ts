import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ membership: vi.fn(), count: vi.fn(), findMany: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/organizations", () => ({ requireOrganizationMembership: mocks.membership }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ student: { count: mocks.count, findMany: mocks.findMany } }) }));
import { listOrganizationStudents } from "@/lib/students";
import StudentsPage from "@/app/app/org/[organizationId]/students/page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.membership.mockResolvedValue({ organization: { id: "verified-org", name: "School" }, role: "STAFF" });
  mocks.count.mockResolvedValue(45);
  mocks.findMany.mockResolvedValue([{ id: "s1", name: "Aarav Sharma", admissionNumber: "ST001", guardianName: "Sanjay", status: "ACTIVE" }]);
});

describe("student search query boundaries (mock database)", () => {
  it.each(["aar", "st00"])("searches both name and admission number case-insensitively for %s before pagination", async q => {
    const result = await listOrganizationStudents("requested", "2", { q: "  " + q + "  " });
    const where = { organizationId: "verified-org", OR: [
      { name: { contains: q, mode: "insensitive" } },
      { admissionNumber: { contains: q, mode: "insensitive" } },
    ] };
    expect(mocks.count).toHaveBeenCalledWith({ where });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 20, take: 20, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
    expect(result).toMatchObject({ q, total: 45, totalPages: 3, page: 2 });
    // organizationId is outside OR, so neither search branch escapes tenant scope.
    expect(mocks.findMany.mock.calls[0][0].where).toEqual(where);
  });
  it.each(["ACTIVE", "INACTIVE"])("combines %s with search and uses identical count/fetch conditions", async status => {
    await listOrganizationStudents("requested", "1", { q: "ST", status });
    const where = mocks.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ organizationId: "verified-org", status, OR: expect.any(Array) });
    expect(mocks.findMany.mock.calls[0][0].where).toEqual(where);
    await listOrganizationStudents("requested", "1", { status });
    expect(mocks.count).toHaveBeenLastCalledWith({ where: { organizationId: "verified-org", status } });
  });
  it.each(["OWNER", "ADMIN", "STAFF"])("permits %s searching only the verified organization", async role => {
    mocks.membership.mockResolvedValue({ organization: { id: "verified-org" }, role });
    await listOrganizationStudents("forged-org", "1", { q: "A", status: "ACTIVE" });
    expect(mocks.membership).toHaveBeenCalledWith("forged-org");
    expect(mocks.count.mock.calls[0][0].where.organizationId).toBe("verified-org");
  });
  it("does not query when membership is denied", async () => {
    mocks.membership.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(listOrganizationStudents("other", "1", { q: "A" })).rejects.toThrow("NOT_FOUND");
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it.each([
    { q: ["a", "b"], status: ["ACTIVE", "INACTIVE"] },
    { q: "  ", status: "invalid" },
    { status: "active" },
  ])("normalizes malformed/repeated query %j", async query => {
    expect(await listOrganizationStudents("requested", ["2", "3"], query)).toMatchObject({ q: "", status: "ALL", filtered: false, page: 1 });
    expect(mocks.count).toHaveBeenCalledWith({ where: { organizationId: "verified-org" } });
  });
  it("trims and caps q at 100 characters", async () => {
    const result = await listOrganizationStudents("requested", "1", { q: "  " + "x".repeat(101) + " " });
    expect(result.q).toBe("x".repeat(100));
    expect(mocks.count.mock.calls[0][0].where.OR[0].name.contains).toHaveLength(100);
  });
  it("uses filtered counts to clamp pagination, including zero results", async () => {
    mocks.count.mockResolvedValue(21);
    expect(await listOrganizationStudents("requested", "99", { q: "A" })).toMatchObject({ total: 21, totalPages: 2, page: 2 });
    expect(mocks.findMany.mock.calls[0][0].skip).toBe(20);
    mocks.count.mockResolvedValue(0);
    mocks.findMany.mockResolvedValue([]);
    expect(await listOrganizationStudents("requested", "99", { status: "INACTIVE" })).toMatchObject({ total: 0, totalPages: 1, page: 1 });
    expect(mocks.findMany.mock.calls[1][0].skip).toBe(0);
  });
});

async function render(query: { q?: string; status?: string; page?: string } = {}) {
  return renderToStaticMarkup(await StudentsPage({ params: Promise.resolve({ organizationId: "requested" }), searchParams: Promise.resolve(query) }));
}
describe("search UI (static render, not browser)", () => {
  it("preserves URL values and pagination, resets submitted page, and clears filters", async () => {
    const html = await render({ q: "A & B", status: "INACTIVE", page: "2" });
    expect(html).toContain('name="q"');
    expect(html).toContain('value="A &amp; B"');
    expect(html).toContain('value="INACTIVE" selected=""');
    expect(html).toContain('name="page" value="1"');
    expect(html).toContain('action="/app/org/verified-org/students"');
    expect(html).toContain('method="get"');
    expect(html).toContain('?q=A+%26+B&amp;status=INACTIVE&amp;page=1');
    expect(html).toContain('?q=A+%26+B&amp;status=INACTIVE&amp;page=3');
    expect(html).toMatch(/href="\/app\/org\/verified-org\/students"[^>]*>Clear filters/);
    expect(html).toContain("45 matching students");
    expect(html).not.toContain("Add student");
  });
  it("distinguishes a new list from a filtered empty result", async () => {
    mocks.count.mockResolvedValue(0);
    mocks.findMany.mockResolvedValue([]);
    expect(await render()).toContain("No students yet");
    const html = await render({ q: "missing" });
    expect(html).toContain("No matching students");
    expect(html).toContain("0 matching students");
    expect(html).not.toContain("No students yet");
  });
});
