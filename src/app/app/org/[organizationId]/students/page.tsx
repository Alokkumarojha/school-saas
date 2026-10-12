import { studentListQuery } from "@/lib/student-list-context";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { listOrganizationStudents, STUDENTS_PER_PAGE } from "@/lib/students";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Organization students" };

export default async function StudentsPage({ params, searchParams }: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ page?: string | string[]; q?: string | string[]; status?: string | string[]; groupId?: string | string[] }>;
}) {
  const { organizationId } = await params;
  const query = await searchParams;
  const { organization, role, students, total, page, totalPages, q, status, filtered, groupId, groups } =
    await listOrganizationStudents(organizationId, query.page, query);
  const basePath = `/app/org/${organization.id}/students`;
  const pageHref = (target: number) => `${basePath}?${new URLSearchParams({ ...(q ? { q } : {}), ...(status !== "ALL" ? { status } : {}), ...(groupId ? { groupId } : {}), page: String(target) })}`;
  const groupLabel = organization.type === "SCHOOL" ? "Class" : "Batch";
  const canCreate = role === "OWNER" || role === "ADMIN";

  return <>
    <PageHeading title="Students" description={`${organization.name} · ${total} student${total === 1 ? "" : "s"}`} action={canCreate ? <Button asChild><Link href={`${basePath}/new`}>Add student</Link></Button> : undefined} />
    {!canCreate && <p className="mb-5 text-sm text-muted-foreground">You can view students. Only owners and admins can add or edit students.</p>}
    <form key={`${q}:${status}:${groupId}`} action={basePath} method="get" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_auto] sm:items-end">
      <input type="hidden" name="page" value="1" />
      <div><label htmlFor="student-search" className="text-sm font-medium">Search students</label><input id="student-search" name="q" type="search" defaultValue={q} maxLength={100} placeholder="Name or admission number" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4" /></div>
      <div><label htmlFor="student-status" className="text-sm font-medium">Status</label><select id="student-status" name="status" defaultValue={status} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4"><option value="ALL">All</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>
      <div className="min-w-0"><label htmlFor="student-group-filter" className="text-sm font-medium">{groupLabel}</label><select id="student-group-filter" name="groupId" defaultValue={groupId} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4"><option value="">All {groupLabel === "Class" ? "classes" : "batches"}</option><option value="unassigned">Unassigned</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}{group.section ? ` · ${group.section}` : ""}{group.status === "INACTIVE" ? " (Inactive)" : ""}</option>)}</select></div>
      <Button type="submit">Search</Button>
      <Button asChild variant="outline"><Link href={basePath}>Clear filters</Link></Button>
    </form>
    {filtered && <p className="mb-4 text-sm text-muted-foreground">{total} matching student{total === 1 ? "" : "s"}</p>}
    {students.length ? <>
      <p className="mb-4 text-sm text-muted-foreground">Showing {(page - 1) * STUDENTS_PER_PAGE + 1}–{(page - 1) * STUDENTS_PER_PAGE + students.length} of {total}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{students.map(student => <Card key={student.id} className="min-w-0 p-4">
        <div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UsersRound className="size-5" /></span><div className="min-w-0"><h2 className="break-words font-semibold">{student.name}</h2><p className="mt-1 break-all text-xs text-muted-foreground">Admission: {student.admissionNumber}</p></div></div>
        <dl className="mt-3 space-y-2 text-sm"><div><dt className="text-muted-foreground">{groupLabel}</dt><dd className="break-words">{student.group ? `${student.group.name}${student.group.section ? " · " + student.group.section : ""}${student.group.status === "INACTIVE" ? " (Inactive)" : ""}` : "Unassigned"}</dd></div><div><dt className="text-muted-foreground">Guardian</dt><dd className="break-words">{student.guardianName}</dd></div><div><dt className="text-muted-foreground">Guardian phone</dt><dd className="number">{student.guardianPhone || "Not provided"}</dd></div><div><dt className="text-muted-foreground">Status</dt><dd className="mt-1"><span className={student.status === "ACTIVE" ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200"}>{student.status === "ACTIVE" ? "Active" : "Inactive"}</span></dd></div></dl>
        {canCreate && <Button asChild variant="outline" className="mt-3 w-full"><Link href={`${basePath}/${student.id}/edit?${studentListQuery({ page: String(page), q, status, groupId })}`} aria-label={`Edit ${student.name}`}>Edit</Link></Button>}
      </Card>)}</div>
    </> : <Card className="p-8 text-center"><UsersRound className="mx-auto mb-4 size-8 text-primary" /><h2 className="text-lg font-semibold">{filtered ? "No matching students" : "No students yet"}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{filtered ? "Try another search or clear the filters." : canCreate ? "Add the first student to this organization." : "An owner or admin can add students to this organization."}</p>{canCreate && !filtered && <Button asChild className="mt-5"><Link href={`${basePath}/new`}>Add first student</Link></Button>}</Card>}
    <nav aria-label="Student pagination" className="mt-6 flex flex-wrap items-center justify-between gap-3">
      {page > 1 ? <Button asChild variant="outline"><Link href={pageHref(page - 1)}>Previous</Link></Button> : <Button variant="outline" disabled>Previous</Button>}
      <span className="text-sm text-muted-foreground" aria-live="polite">Page {page} of {totalPages}</span>
      {page < totalPages ? <Button asChild variant="outline"><Link href={pageHref(page + 1)}>Next</Link></Button> : <Button variant="outline" disabled>Next</Button>}
    </nav>
  </>;
}
