import Link from "next/link";
import { requireOrganizationMembership } from "@/lib/organizations";
import { groupLabels } from "@/lib/group-validation";
import { GroupForm } from "@/components/groups/group-form";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";

export default async function NewGroupPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const { organization, role } = await requireOrganizationMembership(organizationId);
  const { singular, plural } = groupLabels(organization.type);
  return <div className="mx-auto max-w-xl">
    <Link href={`/app/org/${organization.id}/groups`} className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary">Back to {plural.toLowerCase()}</Link>
    {role === "OWNER" || role === "ADMIN" ? <><PageHeading title={`Add ${singular.toLowerCase()}`} description={organization.name} /><Card className="p-5 sm:p-7"><GroupForm organizationId={organization.id} organizationType={organization.type} /></Card></> : <Card className="p-6"><h1 className="text-xl font-semibold">View-only access</h1><p className="mt-3 text-sm text-muted-foreground">Only owners and admins can add {plural.toLowerCase()}.</p></Card>}
  </div>;
}
