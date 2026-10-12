"use client";
import { useActionState, useState } from "react";
import { createGroup, updateGroup } from "@/app/app/org/[organizationId]/groups/actions";
import { type GroupValues, groupLabels } from "@/lib/group-validation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function GroupForm({ organizationId, organizationType, groupId, initialValues = { name: "", section: "", status: "ACTIVE" } }: {
  organizationId: string; organizationType: string; groupId?: string; initialValues?: GroupValues;
}) {
  const [values, setValues] = useState(initialValues);
  const submit = groupId ? updateGroup.bind(null, organizationId, groupId) : createGroup.bind(null, organizationId);
  const [state, action, pending] = useActionState(submit, { error: null });
  const { singular } = groupLabels(organizationType);
  return <form action={action} aria-busy={pending} className="space-y-5">
    <div><label htmlFor="group-name" className="text-sm font-medium">{singular} name</label><Input id="group-name" name="name" required maxLength={100} value={values.name} onChange={e => setValues({ ...values, name: e.target.value })} readOnly={pending} className="mt-2" /></div>
    <div><label htmlFor="group-section" className="text-sm font-medium">Section (optional)</label><Input id="group-section" name="section" maxLength={60} value={values.section} onChange={e => setValues({ ...values, section: e.target.value })} readOnly={pending} className="mt-2" /></div>
    <div><label htmlFor="group-status" className="text-sm font-medium">Status</label><select id="group-status" name="status" value={values.status} onChange={e => setValues({ ...values, status: e.target.value as GroupValues["status"] })} disabled={pending} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>
    {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</p>}
    <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : groupId ? "Save changes" : `Save ${singular.toLowerCase()}`}</Button>
  </form>;
}
