import Link from "next/link";
import { listFeeCharges } from "@/lib/fees";
import { chargedAmount, feeDateLabel } from "@/lib/fee-validation";
import { FeeFilters } from "@/components/fees/fee-filters";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
export const metadata = { title: "Fee charges" };
export default async function FeesPage({ params, searchParams }: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ page?: string | string[]; studentId?: string | string[]; due?: string | string[] }>;
}) {
  const { organizationId } = await params;
  const { organization, role, charges, student, studentId, due, page, total, totalPages } = await listFeeCharges(organizationId, await searchParams);
  const base = `/app/org/${organization.id}/fees`;
  const href = (target: number) => `${base}?${new URLSearchParams({ ...(studentId ? { studentId } : {}), ...(due !== "all" ? { due } : {}), page: String(target) })}`;
  return <>
    <PageHeading title="Fee charges" description={organization.name} action={role === "OWNER" || role === "ADMIN" ? <Button asChild><Link href={`${base}/new`}>Create charge</Link></Button> : undefined} />
    <p className="mb-4 text-sm text-muted-foreground">Charged amounts only. Payment tracking is not available yet. Overdue means due before today in Asia/Kolkata; Upcoming includes today.</p>
    <FeeFilters key={`${studentId}:${due}`} organizationId={organization.id} student={student} due={due} />
    <p className="mb-4 text-sm text-muted-foreground">{total} charge{total === 1 ? "" : "s"}</p>
    {charges.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{charges.map(charge => <Card key={charge.id} className="min-w-0 p-4">
      <h2 className="break-words font-semibold">{charge.title}</h2>
      <p className="mt-2 break-words text-sm">{charge.student.name} · {charge.student.admissionNumber}</p>
      <dl className="mt-3 space-y-2 text-sm"><div><dt className="text-muted-foreground">Charged amount</dt><dd className="font-semibold">{chargedAmount(charge.amountPaise)}</dd></div><div><dt className="text-muted-foreground">Due date</dt><dd>{feeDateLabel(charge.dueDate)}</dd></div></dl>
    </Card>)}</div> : <Card className="p-6 text-center"><h2 className="font-semibold">{studentId || due !== "all" ? "No matching charges" : "No fee charges yet"}</h2><p className="mt-2 text-sm text-muted-foreground">{studentId || due !== "all" ? "Try different filters." : "An owner or admin can create a student's first charge."}</p></Card>}
    <nav aria-label="Fee charge pagination" className="mt-6 flex flex-wrap items-center justify-between gap-3">
      {page > 1 ? <Button asChild variant="outline"><Link href={href(page - 1)}>Previous</Link></Button> : <Button variant="outline" disabled>Previous</Button>}
      <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
      {page < totalPages ? <Button asChild variant="outline"><Link href={href(page + 1)}>Next</Link></Button> : <Button variant="outline" disabled>Next</Button>}
    </nav>
  </>;
}
