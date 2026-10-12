"use client";
import { useActionState, useState } from "react";
import { createFeeCharge } from "@/app/app/org/[organizationId]/fees/actions";
import { type FeeStudentOption } from "@/lib/fee-validation";
import { FeeStudentPicker } from "./student-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function FeeChargeForm({ organizationId, submissionKey }: { organizationId: string; submissionKey: string }) {
  const [student, setStudent] = useState<FeeStudentOption | null>(null);
  const [values, setValues] = useState({ title: "", amount: "", dueDate: "" });
  const [state, action, pending] = useActionState(createFeeCharge.bind(null, organizationId), { error: null });
  return <form action={action} aria-busy={pending} className="space-y-5">
    <input type="hidden" name="submissionKey" value={submissionKey} />
    <FeeStudentPicker organizationId={organizationId} selected={student} onSelect={setStudent} disabled={pending} />
    <div><label htmlFor="charge-title" className="text-sm font-medium">Title</label><Input id="charge-title" name="title" required maxLength={150} placeholder="Tuition — October 2026" value={values.title} onChange={e => setValues({ ...values, title: e.target.value })} readOnly={pending} className="mt-2" /></div>
    <div><label htmlFor="charge-amount" className="text-sm font-medium">Charged amount (₹)</label><Input id="charge-amount" name="amount" required inputMode="decimal" maxLength={11} placeholder="1500.00" value={values.amount} onChange={e => setValues({ ...values, amount: e.target.value })} readOnly={pending} aria-describedby="amount-help" className="mt-2" /><p id="amount-help" className="mt-2 text-xs text-muted-foreground">₹0.01 to ₹2,14,74,836.47. Up to two decimal places; no commas.</p></div>
    <div><label htmlFor="charge-due" className="text-sm font-medium">Due date</label><Input id="charge-due" name="dueDate" type="date" required min="0001-01-01" max="9999-12-31" value={values.dueDate} onChange={e => setValues({ ...values, dueDate: e.target.value })} readOnly={pending} className="mt-2" /></div>
    <p className="text-sm text-muted-foreground">Charges cannot be edited or deleted. Check the details before saving. Payment tracking is not available yet.</p>
    {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</p>}
    <Button type="submit" disabled={pending || !student} className="w-full">{pending ? "Saving…" : "Create charge"}</Button>
  </form>;
}
