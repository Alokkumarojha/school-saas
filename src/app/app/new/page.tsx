import { requireUserId } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { OrganizationForm } from "@/components/organization-form";
export const metadata = { title: "Create organization" };
export default async function NewOrganizationPage() {
  await requireUserId();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeading
        title="Create an organization"
        description="Set up a school or coaching workspace. You will become its owner."
      />
      <Card className="p-5 sm:p-7">
        <OrganizationForm />
      </Card>
    </div>
  );
}
