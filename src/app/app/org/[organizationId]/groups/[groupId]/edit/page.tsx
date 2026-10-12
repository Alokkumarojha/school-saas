import Link from "next/link";
import { getEditableGroup } from "@/lib/groups";
import { groupLabels } from "@/lib/group-validation";
import { GroupForm } from "@/components/groups/group-form";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";

export default async function EditGroupPage({ params }: { params: Promise<{ organizationId: string; groupId: string }> }) {
  const { organizationId, groupId } = await params;
  const { organization, group } = await getEditableGroup(organizationId, groupId);
  const { singular, plural } = groupLabels(organization.type);
  return <div className="mx-auto max-w-xl">
    <Link href={`/app/org/${organization.id}/groups`} className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary">Back to {plural.toLowerCase()}</Link>
    <PageHeading title={`Edit ${singular.toLowerCase()}`} description={organization.name} />
    <Card className="p-5 sm:p-7"><GroupForm organizationId={organization.id} organizationType={organization.type} groupId={group.id} initialValues={{ name: group.name, section: group.section, status: group.status }} /></Card>
  </div>;
}
