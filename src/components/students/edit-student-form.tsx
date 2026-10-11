"use client";

import { useActionState, useState } from "react";
import { updateStudent } from "@/app/app/org/[organizationId]/students/actions";
import type { StudentEditValues } from "@/lib/student-validation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function EditStudentForm({ organizationId, studentId, initialValues }: {
  organizationId: string;
  studentId: string;
  initialValues: StudentEditValues;
}) {
  const [values, setValues] = useState(initialValues);
  const [state, action, pending] = useActionState(
    updateStudent.bind(null, organizationId, studentId), { error: null },
  );
  // Controlled values survive React's form reset when an action returns errors.
  function change(field: keyof StudentEditValues, value: string) {
    setValues(previous => ({ ...previous, [field]: value }));
  }
  return <form action={action} className="space-y-5" aria-busy={pending}>
    <div><label htmlFor="edit-admission" className="text-sm font-medium">Admission number</label><Input id="edit-admission" value={initialValues.admissionNumber} readOnly aria-describedby="admission-help" className="mt-2" /><p id="admission-help" className="mt-2 text-xs text-muted-foreground">Admission numbers cannot be changed.</p></div>
    <div><label htmlFor="edit-name" className="text-sm font-medium">Student name</label><Input id="edit-name" name="name" required minLength={2} maxLength={100} value={values.name} onChange={e => change("name", e.target.value)} readOnly={pending} className="mt-2" /></div>
    <div><label htmlFor="edit-guardian" className="text-sm font-medium">Guardian name</label><Input id="edit-guardian" name="guardianName" required minLength={2} maxLength={100} value={values.guardianName} onChange={e => change("guardianName", e.target.value)} readOnly={pending} className="mt-2" /></div>
    <div><label htmlFor="edit-phone" className="text-sm font-medium">Guardian phone (optional)</label><Input id="edit-phone" name="guardianPhone" type="tel" inputMode="numeric" maxLength={10} pattern="[6-9][0-9]{9}" placeholder="10-digit mobile number" value={values.guardianPhone} onChange={e => change("guardianPhone", e.target.value)} readOnly={pending} className="mt-2" /></div>
    <div><label htmlFor="edit-status" className="text-sm font-medium">Status</label><select id="edit-status" name="status" value={values.status} onChange={e => change("status", e.target.value)} disabled={pending} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>
    {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</p>}
    <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving changes…" : "Save changes"}</Button>
  </form>;
}

