import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), membership: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), count: vi.fn(), findMany: vi.fn(), revalidate: vi.fn(), form: vi.fn(), transaction: vi.fn(), queryRaw: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ $transaction: mocks.transaction, group: { findMany: async () => [] }, membership: { findUnique: mocks.membership }, student: { findFirst: mocks.findFirst, updateMany: mocks.updateMany, count: mocks.count, findMany: mocks.findMany } }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/components/students/edit-student-form", () => ({ EditStudentForm: (props: unknown) => { mocks.form(props); return createElement("form", { "data-edit-student": true }); } }));

import EditStudentPage from "@/app/app/org/[organizationId]/students/[studentId]/edit/page";
import StudentsPage from "@/app/app/org/[organizationId]/students/page";
import { updateStudent } from "@/app/app/org/[organizationId]/students/actions";

const organizationId = "cmg00000000000000000000001";
const studentId = "student-1";
const organization = { id: organizationId, name: "School" };
const student = { id: studentId, admissionNumber: "ST001", name: "Aarav Sharma", guardianName: "Sanjay Sharma", guardianPhone: null, status: "ACTIVE" };
const params = () => Promise.resolve({ organizationId, studentId });
function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({ admissionNumber: "st001", name: student.name, guardianName: student.guardianName, guardianPhone: "", status: "INACTIVE", organizationId: "forged-org", role: "OWNER", studentId: "forged-student", ...overrides }).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user-current", redirectToSignIn: () => { throw new Error("SIGN_IN"); } });
  mocks.membership.mockResolvedValue({ organization, role: "ADMIN" });
  mocks.findFirst.mockResolvedValue(student);
  mocks.queryRaw.mockResolvedValue([{ groupId: null }]);
  mocks.transaction.mockImplementation(async work => work({ $queryRaw: mocks.queryRaw, student: { updateMany: mocks.updateMany } }));
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.count.mockResolvedValue(2);
  mocks.findMany.mockResolvedValue([student, { ...student, id: "student-2", name: "Siya Singh", status: "INACTIVE" }]);
});

describe("student edit authorization and behavior", () => {
  it.each(["OWNER", "ADMIN"])("prefills the edit page and independently permits %s updates", async role => {
    mocks.membership.mockResolvedValue({ organization, role });
    const html = renderToStaticMarkup(await EditStudentPage({ params: params() }));
    expect(html).toContain("data-edit-student");
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: studentId, organizationId } }));
    expect(mocks.form).toHaveBeenCalledWith({ organizationId, studentId, returnContext: {}, groups: [], groupLabel: "Batch", initialValues: { groupId: "", admissionNumber: "ST001", name: student.name, guardianName: student.guardianName, guardianPhone: "", status: "ACTIVE" } });
    await expect(updateStudent(organizationId, studentId, { error: null }, form())).rejects.toThrow(`REDIRECT:/app/org/${organizationId}/students`);
    expect(mocks.membership).toHaveBeenCalledTimes(3);
    expect(mocks.auth).toHaveBeenCalledTimes(3);
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: studentId, organizationId }, data: { groupId: null, name: student.name, guardianName: student.guardianName, guardianPhone: null, status: "INACTIVE" } });
    expect(mocks.revalidate).toHaveBeenCalledWith(`/app/org/${organizationId}/students`);
  });
  it.each(["OWNER", "ADMIN", "STAFF"])("shows both statuses and restricts edit links for %s", async role => {
    mocks.membership.mockResolvedValue({ organization, role });
    const html = renderToStaticMarkup(await StudentsPage({ params: params(), searchParams: Promise.resolve({}) }));
    expect(html).toContain("Active");
    expect(html).toContain("Inactive");
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId } }));
    if (role === "STAFF") expect(html).not.toContain("/edit");
    else expect(html).toContain(`/students/${studentId}/edit`);
  });
  it("denies STAFF page access before lookup and rejects forged-role submissions", async () => {
    mocks.membership.mockResolvedValue({ organization, role: "STAFF" });
    expect(renderToStaticMarkup(await EditStudentPage({ params: params() }))).toContain("View-only access");
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.form).not.toHaveBeenCalled();
    expect(await updateStudent(organizationId, studentId, { error: null }, form())).toEqual({ error: "You do not have permission to edit students." });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("denies non-members at both boundaries", async () => {
    mocks.membership.mockResolvedValue(null);
    await expect(EditStudentPage({ params: params() })).rejects.toThrow("NOT_FOUND");
    await expect(updateStudent(organizationId, studentId, { error: null }, form())).rejects.toThrow("NOT_FOUND");
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("does not disclose or modify a student outside the verified organization", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(EditStudentPage({ params: params() })).rejects.toThrow("NOT_FOUND");
    expect(await updateStudent(organizationId, studentId, { error: null }, form())).toEqual({ error: "Student unavailable in this organization." });
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: studentId, organizationId } }));
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: studentId, organizationId } }));
    expect(mocks.form).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("uses the returned verified organization ID rather than form ownership", async () => {
    mocks.membership.mockResolvedValue({ organization: { ...organization, id: "cmg00000000000000000000009" }, role: "OWNER" });
    await EditStudentPage({ params: params() });
    await expect(updateStudent(organizationId, studentId, { error: null }, form())).rejects.toThrow("REDIRECT:/app/org/cmg00000000000000000000009/students");
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: studentId, organizationId: "cmg00000000000000000000009" } }));
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: studentId, organizationId: "cmg00000000000000000000009" } }));
  });
  it("ignores a tampered admission number even when it names another student", async () => {
    await expect(updateStudent(organizationId, studentId, { error: null }, form({ admissionNumber: "ST002" }))).rejects.toThrow("REDIRECT:");
    expect(mocks.updateMany.mock.calls[0][0].data).not.toHaveProperty("admissionNumber");
  });
  it("allows keeping the existing admission number without a self-duplicate precheck", async () => {
    await expect(updateStudent(organizationId, studentId, { error: null }, form({ admissionNumber: student.admissionNumber, status: "ACTIVE" }))).rejects.toThrow("REDIRECT:");
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE" }) }));
    expect(mocks.updateMany.mock.calls[0][0].data).not.toHaveProperty("admissionNumber");
  });
  it.each(["demoted", "revoked"])("rejects a previously opened form when membership is %s", async change => {
    expect(renderToStaticMarkup(await EditStudentPage({ params: params() }))).toContain("data-edit-student");
    const submit = updateStudent.bind(null, organizationId, studentId);
    mocks.membership.mockResolvedValue(change === "revoked" ? null : { organization, role: "STAFF" });
    for (let attempt = 0; attempt < 2; attempt++) {
      if (change === "revoked") await expect(submit({ error: null }, form())).rejects.toThrow("NOT_FOUND");
      else expect((await submit({ error: null }, form())).error).toContain("permission");
    }
    expect(mocks.auth).toHaveBeenCalledTimes(4);
    expect(mocks.membership).toHaveBeenCalledTimes(4);
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it.each(["status", "name", "guardianName", "guardianPhone"])("validates %s before writing", async field => {
    const invalid = field === "guardianPhone" ? "123" : field === "status" ? "DELETED" : "";
    expect((await updateStudent(organizationId, studentId, { error: null }, form({ [field]: invalid }))).error).toBeTruthy();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("sanitizes unexpected errors", async () => {
    mocks.updateMany.mockRejectedValue(new Error("private database information"));
    expect(await updateStudent(organizationId, studentId, { error: null }, form())).toEqual({ error: "Could not update the student. Please try again." });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
