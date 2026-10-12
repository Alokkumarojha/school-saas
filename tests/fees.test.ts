import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ membership: vi.fn(), user: vi.fn(), transaction: vi.fn(), raw: vi.fn(), findUnique: vi.fn(), create: vi.fn(), count: vi.fn(), findMany: vi.fn(), student: vi.fn(), search: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/organizations", () => ({ requireOrganizationMembership: mocks.membership }));
vi.mock("@/lib/auth", () => ({ requireUserId: mocks.user }));
vi.mock("@/lib/db", () => ({ getDb: () => ({
  $transaction: mocks.transaction,
  feeCharge: { count: mocks.count, findMany: mocks.findMany },
  student: { findFirst: mocks.student, findMany: mocks.search },
}) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (path: string) => { throw new Error("REDIRECT:" + path); } }));
import { parseRupees, validDateOnly, kolkataToday, chargedAmount, feeDateLabel } from "@/lib/fee-validation";
import { createFeeCharge, searchFeeStudents } from "@/app/app/org/[organizationId]/fees/actions";
import { listFeeCharges } from "@/lib/fees";
import FeesPage from "@/app/app/org/[organizationId]/fees/page";
import NewFeePage from "@/app/app/org/[organizationId]/fees/new/page";

const organization = { id: "cmg00000000000000000000001", name: "School", type: "SCHOOL" };
const student = { id: "cmg00000000000000000000002", name: "Aarav", admissionNumber: "ST003" };
const submissionKey = "00000000-0000-4000-8000-000000000001";
const params = () => Promise.resolve({ organizationId: organization.id });
function form(overrides: Record<string, string | undefined> = {}) {
  const data = new FormData();
  Object.entries({ studentId: student.id, title: " Tuition ", amount: "1200.10", dueDate: "2026-10-12", submissionKey, organizationId: "foreign", createdByClerkUserId: "forged", role: "OWNER", ...overrides }).forEach(([key, value]) => { if (value !== undefined) data.set(key, value); });
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.membership.mockResolvedValue({ organization, role: "ADMIN" });
  mocks.user.mockResolvedValue("current-user");
  mocks.student.mockResolvedValue(student);
  mocks.search.mockResolvedValue([student]);
  mocks.count.mockResolvedValue(41);
  mocks.findMany.mockResolvedValue([{ id: "charge", title: "Tuition", student, amountPaise: 120010, dueDate: new Date("2026-10-12T00:00:00Z") }]);
  mocks.raw.mockImplementation(async (parts: TemplateStringsArray, ...values: string[]) => {
    if (parts.join("").includes('FROM "Student"')) {
      expect(values).toEqual([student.id, organization.id]);
      expect(parts.join("?")).toContain('AND "organizationId" = ? FOR SHARE');
      return [{ status: "ACTIVE" }];
    }
    expect(values).toEqual([organization.id]); expect(parts.join("")).toContain("FOR UPDATE");
    return [{ id: organization.id }];
  });
  mocks.findUnique.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ id: "charge" });
  mocks.transaction.mockImplementation(async work => work({ $queryRaw: mocks.raw, feeCharge: { findUnique: mocks.findUnique, create: mocks.create } }));
});
describe("exact money and date-only validation", () => {
  it.each([["0.01", 1], ["1", 100], ["1.2", 120], ["1200.10", 120010], [" 99.99 ", 9999], ["21474836.47", 2147483647]])("parses %s exactly", (value, expected) => expect(parseRupees(value as string)).toBe(expected));
  it.each(["0", "0.00", "-1", "+1", "1.001", ".5", "1.", "01", "1,000", "1e3", "NaN", "Infinity", "21474836.48", "999999999999999", ""])("rejects %s", value => expect(parseRupees(value)).toBeNull());
  it.each(["2026-02-29", "2024-02-30", "2026-04-31", "2026-13-01", "2026-00-01", "2026-1-01", "0000-01-01", "2026-10-12T00:00:00Z"])("rejects invalid date %s", value => expect(validDateOnly(value)).toBe(false));
  it("accepts leap day and preserves dates in display", () => {
    expect(validDateOnly("2024-02-29")).toBe(true);
    expect(validDateOnly("0001-01-01")).toBe(true);
    expect(feeDateLabel(new Date("2026-10-12T00:00:00Z"))).toBe("12 Oct 2026");
    expect(chargedAmount(120010)).toBe("₹1,200.10");
    expect(chargedAmount(2147483647)).toBe("₹2,14,74,836.47");
  });
  it("changes Kolkata's date at 18:30 UTC, including year boundaries", () => {
    expect(kolkataToday(new Date("2026-12-31T18:29:59Z"))).toBe("2026-12-31");
    expect(kolkataToday(new Date("2026-12-31T18:30:00Z"))).toBe("2027-01-01");
  });
});
describe("charge action boundaries and idempotency (mock database)", () => {
  it.each(["OWNER", "ADMIN"])("permits %s and writes server-derived organization and creator", async role => {
    mocks.membership.mockResolvedValue({ organization, role });
    await expect(createFeeCharge("requested", { error: null }, form())).rejects.toThrow("REDIRECT:/app/org/" + organization.id + "/fees");
    expect(mocks.create).toHaveBeenCalledWith({ data: { organizationId: organization.id, createdByClerkUserId: "current-user", studentId: student.id, title: "Tuition", amountPaise: 120010, dueDate: new Date("2026-10-12T00:00:00Z"), submissionKey } });
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { organizationId_submissionKey: { organizationId: organization.id, submissionKey } } });
  });
  it.each(["STAFF", "revoked"])("denies an open form after %s", async role => {
    await NewFeePage({ params: params() });
    if (role === "STAFF") mocks.membership.mockResolvedValue({ organization, role });
    else mocks.membership.mockRejectedValue(new Error("NOT_FOUND"));
    if (role === "STAFF") expect(await createFeeCharge(organization.id, { error: null }, form())).toMatchObject({ error: expect.stringContaining("Only owners") });
    else await expect(createFeeCharge(organization.id, { error: null }, form())).rejects.toThrow("NOT_FOUND");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([{ rows: [] }, { rows: [{ status: "INACTIVE" }] }])("rejects foreign/missing/inactive students without creating", async ({ rows }) => {
    mocks.raw.mockResolvedValueOnce([{ id: organization.id }]).mockResolvedValueOnce(rows);
    expect(await createFeeCharge(organization.id, { error: null }, form())).toEqual({ error: "Selected student is unavailable. Choose an active student." });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("replays identical data without a second insert", async () => {
    await expect(createFeeCharge(organization.id, { error: null }, form())).rejects.toThrow("REDIRECT:");
    mocks.findUnique.mockResolvedValue(mocks.create.mock.calls[0][0].data);
    await expect(createFeeCharge(organization.id, { error: null }, form())).rejects.toThrow("REDIRECT:");
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it.each([{ title: "Other" }, { amount: "1200.11" }, { dueDate: "2026-10-13" }])("rejects changed replay payload %j", async override => {
    await expect(createFeeCharge(organization.id, { error: null }, form())).rejects.toThrow("REDIRECT:");
    mocks.findUnique.mockResolvedValue(mocks.create.mock.calls[0][0].data);
    expect(await createFeeCharge(organization.id, { error: null }, form(override))).toMatchObject({ error: expect.stringContaining("different details") });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("rejects replay with a different stored student or creator", async () => {
    await expect(createFeeCharge(organization.id, { error: null }, form())).rejects.toThrow("REDIRECT:");
    const saved = mocks.create.mock.calls[0][0].data;
    for (const changed of [{ ...saved, studentId: "other-student" }, { ...saved, createdByClerkUserId: "other-user" }]) {
      mocks.findUnique.mockResolvedValue(changed);
      expect(await createFeeCharge(organization.id, { error: null }, form())).toMatchObject({ error: expect.stringContaining("different details") });
    }
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("permits identical charges with distinct submission keys", async () => {
    await expect(createFeeCharge(organization.id, { error: null }, form())).rejects.toThrow("REDIRECT:");
    await expect(createFeeCharge(organization.id, { error: null }, form({ submissionKey: "00000000-0000-4000-8000-000000000002" }))).rejects.toThrow("REDIRECT:");
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });
  it("validates before writing and returns errors instead of consuming the key", async () => {
    expect(await createFeeCharge(organization.id, { error: null }, form({ amount: "1.001" }))).toMatchObject({ error: expect.any(String) });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
describe("scoped charge listing and bounded picker", () => {
  it.each(["overdue", "upcoming"])("combines student with %s and identical count/fetch predicates", async due => {
    const result = await listFeeCharges(organization.id, { studentId: student.id, due, page: "2" }, new Date("2026-10-11T18:30:00Z"));
    const where = { organizationId: organization.id, studentId: student.id, dueDate: { [due === "overdue" ? "lt" : "gte"]: new Date("2026-10-12T00:00:00Z") } };
    expect(mocks.count).toHaveBeenCalledWith({ where });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 20, take: 20, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
    expect(result).toMatchObject({ page: 2, totalPages: 3, total: 41 });
  });
  it.each(["bad", ["", student.id]])("rejects malformed student filter %j", async studentId => {
    await expect(listFeeCharges(organization.id, { studentId })).rejects.toThrow("NOT_FOUND");
    expect(mocks.count).not.toHaveBeenCalled();
  });
  it("denies foreign student filters before querying charges", async () => {
    mocks.student.mockResolvedValue(null);
    await expect(listFeeCharges(organization.id, { studentId: student.id })).rejects.toThrow("NOT_FOUND");
    expect(mocks.student).toHaveBeenCalledWith(expect.objectContaining({ where: { id: student.id, organizationId: organization.id } }));
    expect(mocks.count).not.toHaveBeenCalled();
  });
  it("denies non-members list and picker requests", async () => {
    mocks.membership.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(listFeeCharges(organization.id, {})).rejects.toThrow("NOT_FOUND");
    await expect(searchFeeStudents(organization.id, "A", 1)).rejects.toThrow("NOT_FOUND");
    expect(mocks.count).not.toHaveBeenCalled(); expect(mocks.search).not.toHaveBeenCalled();
  });
  it("bounds active student search and scopes OR branches under organization", async () => {
    mocks.search.mockResolvedValue(Array.from({ length: 21 }, () => student));
    expect(await searchFeeStudents("requested", " Aar ", 2)).toMatchObject({ hasMore: true, students: expect.any(Array) });
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: organization.id, status: "ACTIVE", OR: [{ name: { contains: "Aar", mode: "insensitive" } }, { admissionNumber: { contains: "Aar", mode: "insensitive" } }] }, skip: 20, take: 21 }));
    expect((await searchFeeStudents("requested", "Aar", 2)).students).toHaveLength(20);
  });
  it("does not load the directory for an empty search and permits historical filtering", async () => {
    await searchFeeStudents(organization.id, "", 1);
    expect(mocks.search).not.toHaveBeenCalled();
    await searchFeeStudents(organization.id, "ST", 1, false);
    expect(mocks.search.mock.calls[0][0].where).not.toHaveProperty("status");
  });
  it("normalizes invalid pages, clamps pages, and falls back to All for invalid due filters", async () => {
    expect(await listFeeCharges(organization.id, { page: ["2", "3"], due: ["overdue", "upcoming"] })).toMatchObject({ page: 1, due: "all" });
    expect((await listFeeCharges(organization.id, { page: "99" })).page).toBe(3);
    mocks.count.mockResolvedValue(0); mocks.findMany.mockResolvedValue([]);
    expect((await listFeeCharges(organization.id, { page: "99" })).page).toBe(1);
  });
  it("renders filter-preserving pagination and hides create controls for STAFF", async () => {
    mocks.membership.mockResolvedValue({ organization, role: "STAFF" });
    const html = renderToStaticMarkup(await FeesPage({ params: params(), searchParams: Promise.resolve({ studentId: student.id, due: "overdue", page: "2" }) }));
    expect(html).toContain(`studentId=${student.id}&amp;due=overdue&amp;page=3`);
    expect(html).toContain('name="page" value="1"');
    expect(html).toContain("Charged amount"); expect(html).toContain("₹1,200.10");
    expect(html).not.toContain(">Create charge</a>");
    expect(renderToStaticMarkup(await NewFeePage({ params: params() }))).toContain("View-only access");
  });
});
