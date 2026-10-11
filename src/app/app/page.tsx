import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import { listMyOrganizations } from "@/lib/organizations";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export const metadata = { title: "Your organizations" };
export default async function OrganizationsPage() {
  const memberships = await listMyOrganizations();
  return (
    <>
      <PageHeading
        title="Your organizations"
        description="Choose a workspace you belong to, or create a new one."
        action={
          <Button asChild>
            <Link href="/app/new">Create organization</Link>
          </Button>
        }
      />
      {memberships.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {memberships.map(({ organization, role }) => (
            <Link
              key={organization.id}
              href={`/app/org/${organization.id}`}
              className="rounded-2xl focus-visible:ring-2"
            >
              <Card className="h-full p-5 transition-colors hover:bg-muted">
                <Building2 className="mb-4 size-6 text-primary" />
                <h2 className="break-words text-lg font-bold">
                  {organization.name}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {organization.type === "SCHOOL" ? "School" : "Coaching"} ·{" "}
                  {role.toLowerCase()}
                </p>
                <p className="mt-4 flex items-center gap-2 text-sm text-primary">
                  Open workspace <ArrowRight className="size-4" />
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Building2 className="mx-auto mb-4 size-10 text-primary" />
          <h2 className="text-xl font-semibold">No organizations yet</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">
            Create your first school or coaching organization to get started.
            Organizations appear here only after you become a member.
          </p>
          <Button asChild className="mt-6">
            <Link href="/app/new">Create your first organization</Link>
          </Button>
        </Card>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/" className="underline underline-offset-4">
          Explore the sample dashboard
        </Link>{" "}
        — sample records are separate from your organizations.
      </p>
    </>
  );
}
