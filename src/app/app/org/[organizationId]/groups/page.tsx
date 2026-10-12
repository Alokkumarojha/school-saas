import Link from "next/link";
import { listOrganizationGroups } from "@/lib/groups";
import { groupLabels } from "@/lib/group-validation";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function GroupsPage({ params, searchParams }: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { organizationId } = await params;
  const { organization, role, groups, total, page, totalPages } = await listOrganizationGroups(organizationId, (await searchParams).page);
  const { singular, plural } = groupLabels(organization.type);
  const canEdit = role === "OWNER" || role === "ADMIN";
  const base = `/app/org/${organization.id}/groups`;
  return <>
    <PageHeading title={plural} description={`${organization.name} · ${total} ${plural.toLowerCase()}`} action={canEdit ? <Button asChild><Link href={`${base}/new`}>Add {singular.toLowerCase()}</Link></Button> : undefined} />
    {!canEdit && <p className="mb-4 text-sm text-muted-foreground">You can view {plural.toLowerCase()}. Only owners and admins can add or edit them.</p>}
    {groups.length ? <>
      <p className="mb-4 text-sm text-muted-foreground">Showing {(page - 1) * 20 + 1}–{(page - 1) * 20 + groups.length} of {total}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{groups.map(group => <Card key={group.id} className="min-w-0 p-4">
        <h2 className="break-words font-semibold">{group.name}</h2>
        <p className="mt-1 break-words text-sm text-muted-foreground">Section: {group.section || "Not provided"}</p>
        <p className="mt-3"><span className="sr-only">Status: </span><span className={group.status === "ACTIVE" ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200"}>{group.status === "ACTIVE" ? "Active" : "Inactive"}</span></p>
        {canEdit && <Button asChild variant="outline" className="mt-3 w-full"><Link href={`${base}/${group.id}/edit`} aria-label={`Edit ${group.name}${group.section ? " · " + group.section : ""}`}>Edit</Link></Button>}
      </Card>)}</div>
    </> : <Card className="p-8 text-center"><h2 className="text-lg font-semibold">No {plural.toLowerCase()} yet</h2><p className="mt-2 text-sm text-muted-foreground">{canEdit ? `Add your first ${singular.toLowerCase()} to get started.` : `An owner or admin can add ${plural.toLowerCase()}.`}</p></Card>}
    <nav aria-label={`${plural} pagination`} className="mt-6 flex flex-wrap items-center justify-between gap-3">
      {page > 1 ? <Button asChild variant="outline"><Link href={`${base}?page=${page - 1}`}>Previous</Link></Button> : <Button variant="outline" disabled>Previous</Button>}
      <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
      {page < totalPages ? <Button asChild variant="outline"><Link href={`${base}?page=${page + 1}`}>Next</Link></Button> : <Button variant="outline" disabled>Next</Button>}
    </nav>
  </>;
}
