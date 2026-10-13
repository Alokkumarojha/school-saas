import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ membership: vi.fn(), user: vi.fn(), raw: vi.fn(), transaction: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), groups: vi.fn(), count: vi.fn(), students: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/organizations", () => ({ requireOrganizationMembership: mocks.membership }));
vi.mock("@/lib/auth", () => ({ requireUserId: mocks.user }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ $transaction: mocks.transaction, group: { findMany: mocks.groups } }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import { saveAttendance } from "@/app/app/org/[organizationId]/attendance/actions";
import { getAttendance } from "@/lib/attendance";
import { attendanceSaveSchema, attendanceSelectionSchema, attendanceCounts, type AttendanceRow } from "@/lib/attendance-validation";
import { kolkataToday } from "@/lib/fee-validation";
import { OrganizationAttendance } from "@/components/attendance/organization-attendance";
const org = "cmg00000000000000000000001", groupId = "cmg00000000000000000000002", studentId = "cmg00000000000000000000003", other = "cmg00000000000000000000004";
const organization = { id: org, name: "School", type: "SCHOOL", slug: "school" };
const group = { id: groupId, name: "Class 6", section: "A", status: "ACTIVE" as const };
const date = "2026-01-02";
const tx = { $queryRaw: mocks.raw, attendance: { findUnique: mocks.findUnique, create: mocks.create, update: mocks.update }, student: { count: mocks.count, findMany: mocks.students } };
function input(status = "PRESENT", version = 0) { return { groupId, date, entries: [{ studentId, status, version }] }; }
function record(status = "PRESENT", version = 1) { return { id: "attendance-1", organizationId: org, studentId, groupId, date: new Date(date), status, version }; }
beforeEach(() => {
  vi.resetAllMocks();
  mocks.membership.mockResolvedValue({ organization, role: "ADMIN" }); mocks.user.mockResolvedValue("user-1");
  mocks.raw.mockImplementation(async (strings: TemplateStringsArray) => {
    const sql = strings.join("?");
    if (sql.includes('FROM "Membership"')) return [{ role: "ADMIN" }];
    if (sql.includes('FROM "Group"')) return [{ status: "ACTIVE" }];
    if (sql.includes('FROM "Student"')) return [{ status: "ACTIVE", groupId }];
    return [{ id: org }];
  });
  mocks.transaction.mockImplementation(async fn => fn(tx));
  mocks.findUnique.mockResolvedValue(null); mocks.create.mockResolvedValue(record()); mocks.update.mockResolvedValue(record("ABSENT", 2));
  mocks.groups.mockResolvedValue([group]); mocks.count.mockResolvedValue(1);
  mocks.students.mockResolvedValue([{ id: studentId, name: "Asha Singh", admissionNumber: "ST001", status: "ACTIVE", groupId, attendance: [] }]);
});
describe("attendance validation", () => {
  it.each(["2026-02-30", "2025-02-29", "0000-01-01", "2026-1-1", "bad", "9999-12-31"])("rejects invalid/future %s", value => {
    expect(attendanceSelectionSchema().safeParse({ groupId, date: value }).success).toBe(false);
  });
  it("uses Kolkata date across UTC midnight and allows valid leap days", () => {
    expect(kolkataToday(new Date("2026-10-12T18:30:00Z"))).toBe("2026-10-13");
    expect(kolkataToday(new Date("2026-10-12T18:29:59Z"))).toBe("2026-10-12");
    expect(attendanceSelectionSchema().safeParse({ groupId, date: "2024-02-29" }).success).toBe(true);
  });
  it("rejects unmarked persistence, duplicates, oversized batches and bad revisions", () => {
    expect(attendanceSaveSchema().safeParse(input("UNMARKED")).success).toBe(false);
    expect(attendanceSaveSchema().safeParse(input("PRESENT", -1)).success).toBe(false);
    expect(attendanceSaveSchema().safeParse({ ...input(), entries: [input().entries[0], input().entries[0]] }).success).toBe(false);
    expect(attendanceSaveSchema().safeParse({ ...input(), entries: Array(51).fill(input().entries[0]) }).success).toBe(false);
  });
  it("counts unmarked explicitly", () => {
    expect(attendanceCounts([{ status: null }, { status: "PRESENT" }, { status: "ABSENT" }, { status: "LATE" }])).toEqual({ PRESENT: 1, ABSENT: 1, LATE: 1, UNMARKED: 1 });
  });
});
describe("attendance writes with mocked transactions", () => {
  it.each(["OWNER", "ADMIN"])("allows %s; derives organization and actor, scopes writes, acquires locks", async role => {
    mocks.membership.mockResolvedValue({ organization, role });
    expect(await saveAttendance(org, { ...input(), organizationId: other, role: "OWNER" })).toMatchObject({ error: null });
    expect(mocks.create).toHaveBeenCalledWith({ data: { organizationId: org, groupId, studentId, date: new Date(date + "T00:00:00.000Z"), status: "PRESENT", recordedByClerkUserId: "user-1", lastUpdatedByClerkUserId: "user-1" } });
    const sql = mocks.raw.mock.calls.map(call => call[0].join("?"));
    expect(sql[0]).toContain('"Organization"'); expect(sql[0]).toContain("FOR UPDATE");
    expect(sql.slice(1).every(text => text.includes('"organizationId"') && text.includes("FOR SHARE"))).toBe(true);
    expect(mocks.revalidate).toHaveBeenCalledWith(`/app/org/${org}/attendance`);
  });
  it("denies STAFF and non-members before any transaction", async () => {
    mocks.membership.mockResolvedValue({ organization, role: "STAFF" });
    expect((await saveAttendance(org, input())).error).toContain("Only owners");
    mocks.membership.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(saveAttendance(org, input())).rejects.toThrow("NOT_FOUND");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each(["STAFF", null])("rechecks stale-form authorization inside transaction: %s", async role => {
    const original = mocks.raw.getMockImplementation()!;
    mocks.raw.mockImplementation((strings, ...values) => strings.join("").includes('FROM "Membership"') ? Promise.resolve(role ? [{ role }] : []) : original(strings, ...values));
    expect((await saveAttendance(org, input())).error).toContain("access changed");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(["Group", "Student"])("rejects foreign/missing %s without disclosure", async table => {
    const original = mocks.raw.getMockImplementation()!;
    mocks.raw.mockImplementation((strings, ...values) => strings.join("").includes(`FROM "${table}"`) ? Promise.resolve([]) : original(strings, ...values));
    expect((await saveAttendance(org, input())).error).toContain("unavailable");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(["Group", "Student", "Transfer"])("rejects changed eligibility on a new mark: %s", async change => {
    const original = mocks.raw.getMockImplementation()!;
    mocks.raw.mockImplementation((strings, ...values) => {
      const sql = strings.join("");
      if (change === "Group" && sql.includes('FROM "Group"')) return Promise.resolve([{ status: "INACTIVE" }]);
      if (change !== "Group" && sql.includes('FROM "Student"')) return Promise.resolve([{ status: change === "Student" ? "INACTIVE" : "ACTIVE", groupId: change === "Transfer" ? other : groupId }]);
      return original(strings, ...values);
    });
    expect((await saveAttendance(org, input())).error).toContain("no longer eligible");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("never persists unmarked students or deletes omitted records", async () => {
    expect(await saveAttendance(org, { groupId, date, entries: [] })).toMatchObject({ error: null, saved: [] });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("identical repeated saves are no-ops even after the original increment", async () => {
    await saveAttendance(org, input());
    mocks.findUnique.mockResolvedValue(record());
    expect(await saveAttendance(org, input())).toMatchObject({ error: null, saved: [{ studentId, status: "PRESENT", version: 1 }] });
    expect(mocks.create).toHaveBeenCalledTimes(1); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects a stale different mark rather than overwriting", async () => {
    mocks.findUnique.mockResolvedValue(record("LATE", 2));
    expect((await saveAttendance(org, input("ABSENT", 1))).error).toContain("Reload before saving");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("updates a matching revision without changing historical group/creator", async () => {
    mocks.findUnique.mockResolvedValue(record());
    expect((await saveAttendance(org, input("ABSENT", 1))).error).toBeNull();
    expect(mocks.update).toHaveBeenCalledWith({ where: { organizationId_studentId_date: { organizationId: org, studentId, date: new Date(date + "T00:00:00.000Z") } }, data: { status: "ABSENT", version: { increment: 1 }, lastUpdatedByClerkUserId: "user-1" } });
  });
  it("allows correcting retained history after both group/student inactivation and transfer", async () => {
    mocks.findUnique.mockResolvedValue(record());
    const original = mocks.raw.getMockImplementation()!;
    mocks.raw.mockImplementation((strings, ...values) => strings.join("").includes('FROM "Student"') ? Promise.resolve([{ status: "INACTIVE", groupId: other }]) : strings.join("").includes('FROM "Group"') ? Promise.resolve([{ status: "INACTIVE" }]) : original(strings, ...values));
    expect((await saveAttendance(org, input("ABSENT", 1))).error).toBeNull();
  });
  it("does not move another group's existing daily record", async () => {
    mocks.findUnique.mockResolvedValue({ ...record(), groupId: other });
    expect((await saveAttendance(org, input())).error).toContain("another class/batch");
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("aborts the entire transaction on a later student's conflict (simulated rollback)", async () => {
    let committed = 0;
    mocks.transaction.mockImplementation(async fn => { const result = await fn(tx); committed = mocks.create.mock.calls.length; return result; });
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(record("LATE", 2));
    const result = await saveAttendance(org, { ...input(), entries: [...input().entries, { studentId: other, status: "ABSENT", version: 1 }] });
    expect(result.error).toContain("Reload"); expect(committed).toBe(0); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("rejects future and tampered submissions before querying", async () => {
    expect((await saveAttendance(org, { ...input(), date: "9999-01-01" })).error).toContain("future");
    expect((await saveAttendance(org, { ...input(), groupId: [groupId] })).error).toBeTruthy();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
describe("attendance roster with mocked database", () => {
  it.each(["OWNER", "ADMIN", "STAFF"])("lets %s read a bounded, tenant-scoped roster", async role => {
    mocks.membership.mockResolvedValue({ organization, role });
    const data = await getAttendance(org, { groupId, date });
    expect(data.selected?.rows[0]).toMatchObject({ status: null, version: 0, editable: role !== "STAFF" });
    const request = mocks.students.mock.calls[0][0];
    expect(request.where.organizationId).toBe(org); expect(request.take).toBe(50);
    expect(request.where).toEqual(mocks.count.mock.calls[0][0].where);
    expect(request.where.OR[1]).toEqual({ attendance: { some: { organizationId: org, groupId, date: new Date(date + "T00:00:00.000Z") } } });
  });
  it("denies non-member reads and foreign group selection", async () => {
    await expect(getAttendance(org, { groupId: other, date })).rejects.toThrow("NOT_FOUND");
    expect(mocks.students).not.toHaveBeenCalled();
    mocks.membership.mockRejectedValue(new Error("NOT_FOUND")); mocks.groups.mockClear();
    await expect(getAttendance(org, {})).rejects.toThrow("NOT_FOUND"); expect(mocks.groups).not.toHaveBeenCalled();
  });
  it("retains inactive/transferred students in inactive groups from saved history", async () => {
    mocks.groups.mockResolvedValue([{ ...group, status: "INACTIVE" }]);
    mocks.students.mockResolvedValue([{ id: studentId, name: "Asha", admissionNumber: "ST001", status: "INACTIVE", groupId: other, attendance: [record()] }]);
    const data = await getAttendance(org, { groupId, date });
    expect(mocks.students.mock.calls[0][0].where.OR).toHaveLength(1);
    expect(data.selected?.rows[0]).toMatchObject({ status: "PRESENT", editable: true, explanation: expect.stringContaining("historical") });
  });
  it("shows an already-marked student without allowing movement between groups", async () => {
    mocks.students.mockResolvedValue([{ id: studentId, name: "Asha", admissionNumber: "ST001", status: "ACTIVE", groupId, attendance: [{ ...record(), groupId: other }] }]);
    expect((await getAttendance(org, { groupId, date })).selected?.rows[0]).toMatchObject({ editable: false, explanation: expect.stringContaining("another") });
  });
  it("clamps pages, preserves deterministic ordering, and rejects repeated parameters", async () => {
    mocks.count.mockResolvedValue(51);
    expect((await getAttendance(org, { groupId, date, page: "999" })).selected?.page).toBe(2);
    expect(mocks.students.mock.calls[0][0]).toMatchObject({ skip: 50, take: 50, orderBy: [{ admissionNumber: "asc" }, { id: "asc" }] });
    expect((await getAttendance(org, { groupId: [groupId, other], date })).selected).toBeNull();
    expect((await getAttendance(org, { groupId, date: [date, date] })).selected).toBeNull();
  });
  it("defaults the date to Kolkata today without loading an organization-wide roster", async () => {
    expect(await getAttendance(org, {})).toMatchObject({ date: kolkataToday(), selected: null });
    expect(mocks.students).not.toHaveBeenCalled();
  });
});
describe("static UI verification (not browser interaction)", () => {
  it("renders explicit unmarked status, scoped pagination and view-only controls", () => {
    const row: AttendanceRow = { id: studentId, name: "Asha", admissionNumber: "ST001", status: null, version: 0, editable: false, explanation: null };
    const html = renderToStaticMarkup(createElement(OrganizationAttendance, { organizationId: org, label: "Class", groups: [group], date, today: kolkataToday(), canWrite: false, selected: { group, rows: [row], page: 1, pages: 2, total: 51 } }));
    expect(html).toContain("Unmarked"); expect(html).toContain("View-only access"); expect(html).not.toContain("Save attendance");
    expect(html).toContain(`groupId=${groupId}&amp;date=${date}&amp;page=2`);
    expect(html).toContain("Historical enrollment tracking is not implemented");
  });
});

it("competing saves conflict under a simulated transaction mutex (not PostgreSQL locking)", async () => {
  let current: ReturnType<typeof record> | null = null;
  let queue = Promise.resolve();
  mocks.transaction.mockImplementation(fn => {
    const result = queue.then(() => fn(tx));
    queue = result.then(() => undefined, () => undefined);
    return result;
  });
  mocks.findUnique.mockImplementation(async () => current);
  mocks.create.mockImplementation(async ({ data }) => { current = { ...record(data.status), ...data, version: 1 }; return current; });
  const results = await Promise.all([saveAttendance(org, input("PRESENT")), saveAttendance(org, input("ABSENT"))]);
  expect(results[0].error).toBeNull();
  expect(results[1].error).toContain("Reload before saving");
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(mocks.update).not.toHaveBeenCalled();
});
