import Link from "next/link";
import { requireOrganizationMembership } from "@/lib/organizations";
import { CreateStudentForm } from "@/components/students/create-student-form";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Add student" };

export default async function NewStudentPage({ params }: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const { organization, role } = await requireOrganizationMembership(organizationId);
  const canCreate = role === "OWNER" || role === "ADMIN";
  return <div className="mx-auto max-w-xl">
    <Link href={`/app/org/${organization.id}/students`} className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary">Back to students</Link>
    {canCreate ? <><PageHeading title="Add student" description={organization.name} /><Card className="p-5 sm:p-7"><CreateStudentForm organizationId={organization.id} /></Card></> : <Card className="p-6"><h1 className="text-xl font-semibold">View-only access</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">Only organization owners and admins can add students. You can still view the student list.</p></Card>}
  </div>;
}
