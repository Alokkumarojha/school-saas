import Link from "next/link";
import { getOrganizationDashboard } from "@/lib/organization-dashboard";
import { formatAggregateINR } from "@/lib/dashboard-format";
import { feeDateLabel } from "@/lib/fee-validation";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export const metadata = { title: "Organization overview" };
export const dynamic = "force-dynamic";

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <Card className="min-w-0 p-4 sm:p-5"><dt className="text-sm font-medium text-muted-foreground">{label}</dt><dd><p className="my-3 text-2xl font-semibold tabular-nums tracking-tight [overflow-wrap:anywhere] sm:text-3xl">{value}</p><p className="text-xs leading-5 text-muted-foreground">{detail}</p></dd></Card>;
}
export default async function OrganizationPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const data = await getOrganizationDashboard(organizationId);
  const { organization, role, fees, attendance } = data;
  const groupsLabel = organization.type === "SCHOOL" ? "Classes" : "Batches";
  const canWrite = role === "OWNER" || role === "ADMIN";
  const base = `/app/org/${organization.id}`;
  const count = (value: number) => value.toLocaleString("en-IN");
  return <div className="min-w-0 space-y-7">
    <div className="[overflow-wrap:anywhere]"><PageHeading title="Organization overview" description={`${organization.name} · ${feeDateLabel(new Date(data.today + "T00:00:00.000Z"))} (Asia/Kolkata)`} /></div>
    <nav aria-label="Workspace modules" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[['students', 'View students'], ['groups', `View ${groupsLabel.toLowerCase()}`], ['fees', 'View fees'], ['attendance', 'View attendance']].map(([path, label]) => <Button key={path} asChild variant="outline" className="min-h-12"><Link href={`${base}/${path}`}>{label}</Link></Button>)}
    </nav>
    <section aria-labelledby="people-heading" className="space-y-3">
      <h2 id="people-heading" className="text-lg font-semibold">Students and {groupsLabel.toLowerCase()}</h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Metric label="Active students" value={count(data.activeStudents)} detail={data.activeStudents === 0 ? "No active students yet. Open Students to add or review records." : "Students currently marked Active, including unassigned students."} />
        <Metric label={`Active ${groupsLabel.toLowerCase()}`} value={count(data.activeGroups)} detail={data.activeGroups === 0 ? `No active ${groupsLabel.toLowerCase()} yet. Open ${groupsLabel} to get started.` : `${groupsLabel} currently marked Active, including those without students.`} />
      </dl>
    </section>
    <section aria-labelledby="fees-heading" className="space-y-3">
      <h2 id="fees-heading" className="text-lg font-semibold">Fees · All-time</h2>
      <p className="text-sm leading-6 text-muted-foreground">Collections reflect manually recorded payments, including manual UPI and bank transfer entries. These are not gateway-verified payments. Figures include charges and payments for inactive students.</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Metric label="Total charged" value={formatAggregateINR(fees.charged)} detail="All fee charges recorded for this organization." />
        <Metric label="Total collected" value={formatAggregateINR(fees.collected)} detail="All manually recorded fee payments." />
        <Metric label="Outstanding" value={formatAggregateINR(fees.outstanding)} detail="Remaining unpaid balances across all charges." />
        <Metric label="Overdue" value={formatAggregateINR(fees.overdue)} detail="Remaining balances due before today in Asia/Kolkata. Today-due charges are excluded." />
      </dl>
      {fees.charged === BigInt(0) && <p className="rounded-xl border border-border p-3 text-sm text-muted-foreground">No fee charges yet. Open Fees to {canWrite ? "create the first charge" : "view charges when they are recorded"}.</p>}
    </section>
    <section aria-labelledby="attendance-heading" className="space-y-3">
      <h2 id="attendance-heading" className="text-lg font-semibold">Today&apos;s recorded attendance</h2>
      <p className="text-sm leading-6 text-muted-foreground">Saved records for {feeDateLabel(new Date(data.today + "T00:00:00.000Z"))} in Asia/Kolkata, including students whose assignment or active status changed. Missing records do not imply absence.</p>
      <dl className="grid gap-3 sm:grid-cols-3">
        <Metric label="Present" value={count(attendance.PRESENT)} detail="Explicitly recorded Present today." />
        <Metric label="Absent" value={count(attendance.ABSENT)} detail="Explicitly recorded Absent today." />
        <Metric label="Late" value={count(attendance.LATE)} detail="Explicitly recorded Late today." />
      </dl>
      {Object.values(attendance).every(value => value === 0) && <p className="rounded-xl border border-border p-3 text-sm text-muted-foreground">No attendance recorded today. Open Attendance to {canWrite ? "choose a class or batch and mark students" : "view saved registers"}.</p>}
    </section>
    {canWrite && <section aria-labelledby="actions-heading" className="space-y-3"><h2 id="actions-heading" className="text-lg font-semibold">Quick actions</h2><div className="flex flex-wrap gap-3">
      <Button asChild><Link href={`${base}/students/new`}>Add student</Link></Button>
      <Button asChild variant="outline"><Link href={`${base}/groups/new`}>Add {organization.type === "SCHOOL" ? "class" : "batch"}</Link></Button>
      <Button asChild variant="outline"><Link href={`${base}/fees/new`}>Create fee charge</Link></Button>
      <Button asChild variant="outline"><Link href={`${base}/attendance?date=${data.today}`}>Record attendance</Link></Button>
    </div></section>}
    <p className="text-sm text-muted-foreground">Your role: <span className="capitalize">{role.toLowerCase()}</span>{!canWrite && " · View-only access"}</p>
  </div>;
}
