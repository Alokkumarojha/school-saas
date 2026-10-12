import Link from "next/link";
import { requireOrganizationMembership } from "@/lib/organizations";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export const metadata = { title: "Organization workspace" };
export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const { organization, role } =
    await requireOrganizationMembership(organizationId);
  return (
    <>
      <PageHeading
        title={organization.name}
        description={`${organization.type === "SCHOOL" ? "School" : "Coaching"} workspace`}
      />
      <Card className="max-w-2xl p-6">
        <h2 className="text-lg font-semibold">Your membership</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Role</dt>
            <dd className="mt-1 font-semibold capitalize">
              {role.toLowerCase()}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Organization slug</dt>
            <dd className="mt-1 break-all font-semibold">
              {organization.slug}
            </dd>
          </div>
        </dl>
        <p className="mt-6 text-sm leading-7 text-muted-foreground">
          Manage this organization’s students. Individual fee charges are available. Payment and attendance services
          have not been added yet.
        </p>
        <Button asChild className="mt-5 mr-3">
          <Link href={`/app/org/${organization.id}/students`}>Manage students</Link>
        </Button>
        <Button asChild className="mt-5">
          <Link href="/">View sample dashboard</Link>
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          The sample dashboard does not show this organization’s real records.
        </p>
      </Card>
    </>
  );
}
