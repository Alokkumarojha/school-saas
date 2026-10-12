import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requireOrganizationMembership } from "@/lib/organizations";
import { FeeChargeForm } from "@/components/fees/charge-form";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
export const metadata = { title: "Create fee charge" };
export default async function NewFeePage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const { organization, role } = await requireOrganizationMembership(organizationId);
  return <div className="mx-auto max-w-xl">
    <Link href={`/app/org/${organization.id}/fees`} className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary">Back to fee charges</Link>
    {role === "OWNER" || role === "ADMIN" ? <><PageHeading title="Create fee charge" description={organization.name} /><Card className="p-5 sm:p-7"><FeeChargeForm organizationId={organization.id} submissionKey={randomUUID()} /></Card></> : <Card className="p-6"><h1 className="text-xl font-semibold">View-only access</h1><p className="mt-3 text-sm text-muted-foreground">Only owners and admins can create fee charges.</p></Card>}
  </div>;
}
