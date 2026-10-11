import Link from "next/link";
export default function OrganizationNotFound() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">Workspace unavailable</h1>
      <p className="my-4 text-sm text-muted-foreground">
        This workspace does not exist or you do not have access to it.
      </p>
      <Link
        href="/app"
        className="inline-flex min-h-11 items-center font-semibold text-primary"
      >
        Back to your organizations
      </Link>
    </div>
  );
}
