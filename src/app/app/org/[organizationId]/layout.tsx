import { requireOrganizationMembership } from "@/lib/organizations";
import { OrganizationShell } from "@/components/organization-shell";

export default async function OrganizationLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const { organization } = await requireOrganizationMembership(organizationId);
  // Pages, queries and actions retain their own fresh authorization checks.
  return <OrganizationShell organization={{ id: organization.id, name: organization.name, type: organization.type }}>{children}</OrganizationShell>;
}
