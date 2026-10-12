"use client";
import { useActionState, useState } from "react";
import { recordFeePayment } from "@/app/app/org/[organizationId]/fees/payment-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FeePaymentForm({ organizationId, feeChargeId, submissionKey, today, context }: {
  organizationId: string; feeChargeId: string; submissionKey: string; today: string;
  context: { page: number; due: string; studentId: string };
}) {
  const [values, setValues] = useState({ amount: "", paymentDate: today, method: "CASH", reference: "", note: "" });
  const [state, action, pending] = useActionState(recordFeePayment.bind(null, organizationId, feeChargeId), { error: null });
  return <form action={action} aria-busy={pending} className="space-y-4">
    <input type="hidden" name="submissionKey" value={submissionKey} />
    {Object.entries(context).map(([key, value]) => <input key={key} type="hidden" name={`return.${key}`} value={value} />)}
    <p className="text-sm text-muted-foreground">Manual payment record. UPI and bank transfers are recorded by your organization and are not gateway-verified. Records cannot be edited or deleted.</p>
    <div><label htmlFor="payment-amount" className="text-sm font-medium">Payment amount (₹)</label><Input id="payment-amount" name="amount" required inputMode="decimal" maxLength={11} value={values.amount} readOnly={pending} onChange={e => setValues({ ...values, amount: e.target.value })} className="mt-2" /></div>
    <div><label htmlFor="payment-date" className="text-sm font-medium">Payment date (Asia/Kolkata)</label><Input id="payment-date" name="paymentDate" type="date" required min="0001-01-01" max={today} value={values.paymentDate} readOnly={pending} onChange={e => setValues({ ...values, paymentDate: e.target.value })} className="mt-2" /></div>
    <div><label htmlFor="payment-method" className="text-sm font-medium">Method</label><select id="payment-method" name="method" value={values.method} disabled={pending} onChange={e => setValues({ ...values, method: e.target.value })} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4"><option value="CASH">Cash</option><option value="UPI">UPI — manually recorded</option><option value="BANK_TRANSFER">Bank transfer — manually recorded</option></select></div>
    <div><label htmlFor="payment-reference" className="text-sm font-medium">Reference (optional)</label><Input id="payment-reference" name="reference" maxLength={100} value={values.reference} readOnly={pending} onChange={e => setValues({ ...values, reference: e.target.value })} className="mt-2" /></div>
    <div><label htmlFor="payment-note" className="text-sm font-medium">Note (optional)</label><textarea id="payment-note" name="note" maxLength={500} value={values.note} readOnly={pending} onChange={e => setValues({ ...values, note: e.target.value })} className="mt-2 min-h-24 w-full rounded-xl border border-border bg-background p-3" /></div>
    {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</p>}
    <Button type="submit" disabled={pending} className="w-full">{pending ? "Recording…" : "Record payment"}</Button>
  </form>;
}
