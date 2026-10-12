import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  membership: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/student-admissions", () => ({ createStudentWithAdmissionNumber: (organizationId: string, details: { name: string; guardianName: string; guardianPhone: string }) => mocks.create({ data: { organizationId, admissionNumber: "ST001", ...details, guardianPhone: details.guardianPhone || null } }) }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({
  getDb: () => ({ group: { findMany: async () => [] },
    membership: { findUnique: mocks.membership },
    student: { count: mocks.count, findMany: mocks.findMany, create: mocks.create },
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND"); },
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
// Exercise the real server pages; replace only the client form with an SSR marker.
// This verifies whether a form is exposed, not client hydration/browser behavior.
vi.mock("@/components/students/create-student-form", () => ({
  CreateStudentForm: ({ organizationId }: { organizationId: string }) =>
    createElement("form", { "data-create-student": organizationId }),
}));

import StudentsPage from "@/app/app/org/[organizationId]/students/page";
import NewStudentPage from "@/app/app/org/[organizationId]/students/new/page";
import { createStudent } from "@/app/app/org/[organizationId]/students/actions";

const organizationId = "cmg00000000000000000000001";
const organization = { id: organizationId, name: "Test School", slug: "test-school", type: "SCHOOL" };
const params = () => Promise.resolve({ organizationId });
const record = { id: "student-1", name: "Aarav Sharma", admissionNumber: "ST001", guardianName: "Sanjay Sharma", guardianPhone: null, status: "ACTIVE" };

function validForm() {
  const data = new FormData();
  Object.entries({ admissionNumber: "ST999999", name: record.name, guardianName: record.guardianName, guardianPhone: "", role: "OWNER", organizationId: "forged-organization", clerkUserId: "forged-user" })
    .forEach(([key, value]) => data.set(key, value));
  return data;
}

async function renderList() {
  return renderToStaticMarkup(await StudentsPage({ params: params(), searchParams: Promise.resolve({ page: "1" }) }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_current", redirectToSignIn: () => { throw new Error("SIGN_IN"); } });
  mocks.membership.mockResolvedValue({ organization, role: "ADMIN" });
  mocks.count.mockResolvedValue(1);
  mocks.findMany.mockResolvedValue([record]);
  mocks.create.mockResolvedValue({ id: record.id });
});

describe("Student permissions through real server pages and membership checks", () => {
  it.each(["OWNER", "ADMIN", "STAFF"])("allows %s to list only verified organization students", async role => {
    mocks.membership.mockResolvedValue({ organization, role });
    const html = await renderList();
    expect(html).toContain(record.name);
    expect(mocks.membership).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId_clerkUserId: { organizationId, clerkUserId: "user_current" } },
    }));
    expect(mocks.count).toHaveBeenCalledWith({ where: { organizationId } });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId }, take: 20, skip: 0 }));
  });

  it.each(["OWNER", "ADMIN"])("exposes creation UI and independently accepts %s submissions", async role => {
    mocks.membership.mockResolvedValue({ organization, role });
    expect(await renderList()).toContain("Add student");
    expect(renderToStaticMarkup(await NewStudentPage({ params: params() }))).toContain(`data-create-student="${organizationId}"`);
    await expect(createStudent(organizationId, { error: null }, validForm())).rejects.toThrow(`REDIRECT:/app/org/${organizationId}/students`);
    expect(mocks.auth).toHaveBeenCalledTimes(4);
    expect(mocks.membership).toHaveBeenCalledTimes(4);
    expect(mocks.create).toHaveBeenCalledWith({ data: {
      organizationId, admissionNumber: "ST001", name: record.name,
      guardianName: record.guardianName, guardianPhone: null,
    } });
  });

  it.each([true, false])("omits every create link for STAFF (empty list: %s)", async empty => {
    mocks.membership.mockResolvedValue({ organization, role: "STAFF" });
    mocks.count.mockResolvedValue(empty ? 0 : 1);
    mocks.findMany.mockResolvedValue(empty ? [] : [record]);
    const html = await renderList();
    expect(html).not.toMatch(/Add (first )?student/);
    expect(html).not.toContain(`/students/new`);
  });

  it("denies a direct STAFF new-page request and a direct action submission", async () => {
    mocks.membership.mockResolvedValue({ organization, role: "STAFF" });
    const html = renderToStaticMarkup(await NewStudentPage({ params: params() }));
    expect(html).toContain("View-only access");
    expect(html).not.toContain("data-create-student");
    expect(await createStudent(organizationId, { error: null }, validForm())).toEqual({ error: "You do not have permission to add students." });
    expect(mocks.membership).toHaveBeenCalledTimes(2);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("rejects an already-open ADMIN form after demotion to STAFF, on every submission", async () => {
    expect(renderToStaticMarkup(await NewStudentPage({ params: params() }))).toContain("data-create-student");
    // Membership changes after the page was rendered; the bound action retains only the ID.
    const boundAction = createStudent.bind(null, organizationId);
    mocks.membership.mockResolvedValue({ organization, role: "STAFF" });
    for (let submission = 0; submission < 2; submission++) {
      expect(await boundAction({ error: null }, validForm())).toEqual({ error: "You do not have permission to add students." });
    }
    expect(mocks.auth).toHaveBeenCalledTimes(4);
    expect(mocks.membership).toHaveBeenCalledTimes(4);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("rejects an already-open ADMIN form after membership revocation", async () => {
    expect(renderToStaticMarkup(await NewStudentPage({ params: params() }))).toContain("data-create-student");
    const boundAction = createStudent.bind(null, organizationId);
    mocks.membership.mockResolvedValue(null);
    await expect(boundAction({ error: null }, validForm())).rejects.toThrow("NOT_FOUND");
    await expect(renderList()).rejects.toThrow("NOT_FOUND");
    expect(mocks.auth).toHaveBeenCalledTimes(4);
    expect(mocks.membership).toHaveBeenCalledTimes(4);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("denies non-members list, new-page and create requests before any student access", async () => {
    mocks.membership.mockResolvedValue(null);
    await expect(renderList()).rejects.toThrow("NOT_FOUND");
    await expect(NewStudentPage({ params: params() })).rejects.toThrow("NOT_FOUND");
    await expect(createStudent(organizationId, { error: null }, validForm())).rejects.toThrow("NOT_FOUND");
    expect(mocks.membership).toHaveBeenCalledTimes(3);
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("denies signed-out requests without querying memberships or students", async () => {
    mocks.auth.mockResolvedValue({ userId: null, redirectToSignIn: () => { throw new Error("SIGN_IN"); } });
    await expect(renderList()).rejects.toThrow("SIGN_IN");
    await expect(NewStudentPage({ params: params() })).rejects.toThrow("SIGN_IN");
    await expect(createStudent(organizationId, { error: null }, validForm())).rejects.toThrow("SIGN_IN");
    expect(mocks.membership).not.toHaveBeenCalled();
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
