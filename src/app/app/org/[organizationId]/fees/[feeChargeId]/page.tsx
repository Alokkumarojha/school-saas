import Link from "next/link";
import { randomUUID } from "node:crypto";
import { getFeeChargeDetail } from "@/lib/fee-payments";
import { feeListContext, feeContextQuery, type FeeQuery } from "@/lib/fee-context";
import { chargedAmount, feeDateLabel, kolkataToday } from "@/lib/fee-validation";
import { paymentMethodLabel } from "@/lib/fee-payment-validation";
import { FeePaymentForm } from "@/components/fees/payment-form";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export const metadata = { title: "Fee charge detail" };
export default async function FeeChargePage({ params, searchParams }: {
  params: Promise<{ organizationId: string; feeChargeId: string }>;
  searchParams: Promise<FeeQuery & { paymentPage?: string | string[] }>;
}) {
  const { organizationId, feeChargeId } = await params;
  const query = await searchParams;
  const detail = await getFeeChargeDetail(organizationId, feeChargeId, query.paymentPage);
  const { organization, role, charge, paidPaise, remainingPaise, paymentStatus, payments, page, totalPages, total } = detail;
  const { studentId, due, page: listPage } = await feeListContext(organization.id, query);
  const context = { studentId, due, page: listPage };
  const contextQuery = feeContextQuery(context);
  const base = `/app/org/${organization.id}/fees`;
  return <>
    <Link href={`${base}?${contextQuery}`} className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary">Back to fee charges</Link>
    <PageHeading title={charge.title} description={`${charge.student.name} · ${charge.student.admissionNumber}`} />
    <Card className="p-4"><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div><dt className="text-sm text-muted-foreground">Charged amount</dt><dd className="font-semibold">{chargedAmount(charge.amountPaise)}</dd></div>
      <div><dt className="text-sm text-muted-foreground">Paid amount</dt><dd className="font-semibold">{chargedAmount(paidPaise)}</dd></div>
      <div><dt className="text-sm text-muted-foreground">Remaining balance</dt><dd className="font-semibold">{chargedAmount(remainingPaise)}</dd></div>
      <div><dt className="text-sm text-muted-foreground">Payment status</dt><dd>{paymentStatus}</dd></div>
      <div><dt className="text-sm text-muted-foreground">Due date</dt><dd>{feeDateLabel(charge.dueDate)}</dd></div>
      <div><dt className="text-sm text-muted-foreground">Due-date state</dt><dd>{charge.dueDate.toISOString().slice(0, 10) < kolkataToday() ? "Past due date" : "Today or upcoming"}</dd></div>
    </dl></Card>
    {(role === "OWNER" || role === "ADMIN") && remainingPaise > 0 && <Card className="mt-6 max-w-xl p-5"><h2 className="mb-4 text-lg font-semibold">Record payment</h2><FeePaymentForm organizationId={organization.id} feeChargeId={charge.id} submissionKey={randomUUID()} today={kolkataToday()} context={context} /></Card>}
    <h2 className="mb-3 mt-8 text-lg font-semibold">Manual payment history ({total})</h2>
    <p className="mb-4 text-sm text-muted-foreground">Recorded by your organization. UPI and bank entries are not gateway-verified.</p>
    {payments.length ? <div className="grid gap-4 sm:grid-cols-2">{payments.map(payment => <Card key={payment.id} className="min-w-0 p-4"><p className="font-semibold">{chargedAmount(payment.amountPaise)}</p><p className="mt-1 text-sm">{feeDateLabel(payment.paymentDate)} · {paymentMethodLabel[payment.method]}</p><p className="mt-2 break-words text-sm">Reference: {payment.reference || "Not provided"}</p>{payment.note && <p className="mt-2 break-words text-sm text-muted-foreground">{payment.note}</p>}</Card>)}</div> : <Card className="p-5 text-sm text-muted-foreground">No payments recorded yet.</Card>}
    <nav aria-label="Payment history pagination" className="mt-6 flex flex-wrap items-center justify-between gap-3">
      {page > 1 ? <Button asChild variant="outline"><Link href={`${base}/${charge.id}?${contextQuery}&paymentPage=${page - 1}`}>Previous</Link></Button> : <Button variant="outline" disabled>Previous</Button>}
      <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
      {page < totalPages ? <Button asChild variant="outline"><Link href={`${base}/${charge.id}?${contextQuery}&paymentPage=${page + 1}`}>Next</Link></Button> : <Button variant="outline" disabled>Next</Button>}
    </nav>
  </>;
}
