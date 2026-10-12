import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ membership: vi.fn(), count: vi.fn(), findMany: vi.fn(), create: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/student-admissions", () => ({ createStudentWithAdmissionNumber: (organizationId: string, details: { name: string; guardianName: string; guardianPhone: string }) => mocks.create({ data: { organizationId, admissionNumber: "ST001", ...details, guardianPhone: details.guardianPhone || null } }) }));
vi.mock("@/lib/organizations", () => ({ requireOrganizationMembership: mocks.membership }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ group: { findMany: async () => [] }, student: { count: mocks.count, findMany: mocks.findMany, create: mocks.create } }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));

import { listOrganizationStudents } from "@/lib/students";
import { createStudent } from "@/app/app/org/[organizationId]/students/actions";

function form() {
  const data = new FormData();
  Object.entries({ name: "Aarav Sharma", guardianName: "Sanjay Sharma", guardianPhone: "", organizationId: "forged-org", role: "OWNER" }).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.membership.mockResolvedValue({ organization: { id: "verified-org", name: "School" }, role: "STAFF" });
  mocks.count.mockResolvedValue(45);
  mocks.findMany.mockResolvedValue([]);
});

describe("student data boundaries", () => {
  it("allows staff to view and scopes count and page to the verified organization", async () => {
    const result = await listOrganizationStudents("requested-org", "2");
    expect(mocks.membership).toHaveBeenCalledWith("requested-org");
    expect(mocks.count).toHaveBeenCalledWith({ where: { organizationId: "verified-org" } });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "verified-org" }, take: 20, skip: 20, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
    expect(result).toMatchObject({ role: "STAFF", page: 2, totalPages: 3 });
  });
  it.each([undefined, "0", "-1", "1.5", "bad", "9007199254740992", ["2", "3"]])("normalizes invalid page %j", async page => {
    const result = await listOrganizationStudents("requested-org", page);
    expect(result.page).toBe(1);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }));
  });
  it("clamps pages beyond the end", async () => {
    expect((await listOrganizationStudents("requested-org", "99")).page).toBe(3);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40 }));
  });
  it("keeps the empty list on page one", async () => {
    mocks.count.mockResolvedValue(0);
    expect(await listOrganizationStudents("requested-org", "2")).toMatchObject({ page: 1, totalPages: 1, total: 0 });
  });
  it("does not query or write students when membership is denied", async () => {
    mocks.membership.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(listOrganizationStudents("other-org", "1")).rejects.toThrow("NOT_FOUND");
    await expect(createStudent("other-org", { error: null }, form())).rejects.toThrow("NOT_FOUND");
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects a staff creation request even with a forged role", async () => {
    expect(await createStudent("requested-org", { error: null }, form())).toEqual({ error: "You do not have permission to add students." });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(["OWNER", "ADMIN"])("allows %s to create only in the verified organization", async role => {
    mocks.membership.mockResolvedValue({ organization: { id: "verified-org" }, role });
    mocks.create.mockResolvedValue({ id: "student-1" });
    await expect(createStudent("requested-org", { error: null }, form())).rejects.toThrow("REDIRECT:/app/org/verified-org/students");
    expect(mocks.create).toHaveBeenCalledWith({ data: { organizationId: "verified-org", admissionNumber: "ST001", name: "Aarav Sharma", guardianName: "Sanjay Sharma", guardianPhone: null } });
    expect(mocks.revalidate).toHaveBeenCalledWith("/app/org/verified-org/students");
  });
});
