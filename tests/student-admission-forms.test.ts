import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/app/org/[organizationId]/students/actions", () => ({ createStudent: vi.fn(), updateStudent: vi.fn() }));
import { CreateStudentForm } from "@/components/students/create-student-form";
import { EditStudentForm } from "@/components/students/edit-student-form";
import { createStudentSchema, updateStudentSchema } from "@/lib/student-validation";

describe("admission form and validation contracts (static render, not browser)", () => {
  it("does not request or promise an admission number on create", () => {
    const html = renderToStaticMarkup(createElement(CreateStudentForm, { organizationId: "A" }));
    expect(html).not.toContain('name="admissionNumber"');
    expect(html).toContain("assigned automatically");
    expect(html).toContain("successfully saved");
    expect(html).not.toContain("ST001");
  });
  it("displays a preserved legacy admission number read-only and does not submit it", () => {
    const html = renderToStaticMarkup(createElement(EditStudentForm, { organizationId: "A", studentId: "s1", initialValues: { admissionNumber: "LEGACY/001", name: "Aarav", guardianName: "Sanjay", guardianPhone: "", status: "INACTIVE" } }));
    const input = html.match(/<input[^>]*id="edit-admission"[^>]*>/)?.[0];
    expect(input).toContain('value="LEGACY/001"');
    expect(input).toContain('readOnly=""');
    expect(input).not.toContain('name="admissionNumber"');
  });
  it("validates details without admissionNumber and strips tampered fields", () => {
    const details = { name: "Aarav", guardianName: "Sanjay", guardianPhone: "" };
    expect(createStudentSchema.parse(details)).toEqual(details);
    expect(createStudentSchema.parse({ ...details, admissionNumber: "ST999", role: "OWNER" })).toEqual(details);
    expect(updateStudentSchema.parse({ ...details, status: "ACTIVE", admissionNumber: "ST999" })).toEqual({ ...details, status: "ACTIVE" });
    expect(updateStudentSchema.safeParse({ ...details, status: "DELETED" }).success).toBe(false);
  });
});
