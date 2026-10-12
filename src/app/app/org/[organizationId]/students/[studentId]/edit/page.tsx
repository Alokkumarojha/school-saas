import { validateStudentReturn } from "@/lib/student-return";
import { studentListDestination } from "@/lib/student-list-context";
import { activeStudentGroups } from "@/lib/student-groups";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganizationMembership } from "@/lib/organizations";
import { getDb } from "@/lib/db";
import { EditStudentForm } from "@/components/students/edit-student-form";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Edit student" };

export default async function EditStudentPage({ params, searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<{ organizationId: string; studentId: string }>;
}) {
  const { organizationId, studentId } = await params;
  const { organization, role } = await requireOrganizationMembership(organizationId);
  const returnContext = await validateStudentReturn(organization.id, await searchParams ?? {});
  const back = <Link href={studentListDestination(organization.id, returnContext)} className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary">Back to students</Link>;
  if (role !== "OWNER" && role !== "ADMIN") {
    return <div className="mx-auto max-w-xl">{back}<Card className="p-6"><h1 className="text-xl font-semibold">View-only access</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">Only organization owners and admins can edit students.</p></Card></div>;
  }
  const student = await getDb().student.findFirst({
    where: { id: studentId, organizationId: organization.id },
    select: { id: true, admissionNumber: true, name: true, guardianName: true, guardianPhone: true, status: true, groupId: true, group: { select: { id: true, name: true, section: true, status: true } } },
  });
  if (!student) notFound();
  const groups = await activeStudentGroups(organization.id);
  if (student.group && !groups.some(group => group.id === student.group!.id)) groups.push(student.group);
  return <div className="mx-auto max-w-xl">{back}<PageHeading title="Edit student" description={organization.name} /><Card className="p-5 sm:p-7"><EditStudentForm returnContext={returnContext} groups={groups} groupLabel={organization.type === "SCHOOL" ? "Class" : "Batch"} organizationId={organization.id} studentId={student.id} initialValues={{ groupId: student.groupId ?? "", admissionNumber: student.admissionNumber, name: student.name, guardianName: student.guardianName, guardianPhone: student.guardianPhone ?? "", status: student.status }} /></Card></div>;
}
