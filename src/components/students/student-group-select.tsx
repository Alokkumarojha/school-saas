"use client";
import Link from "next/link";
export type StudentGroupOption = { id: string; name: string; section: string; status: string };
export function StudentGroupSelect({ groups, label, organizationId, value, onChange, pending }: {
  groups: StudentGroupOption[]; label: string; organizationId: string;
  value: string; onChange: (value: string) => void; pending: boolean;
}) {
  return <div>
    <label htmlFor="student-group" className="text-sm font-medium">{label} (optional)</label>
    <select id="student-group" name="groupId" value={value} onChange={e => onChange(e.target.value)} disabled={pending} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4">
      <option value="">Unassigned</option>
      {groups.map(group => <option key={group.id} value={group.id}>{group.name}{group.section ? ` · ${group.section}` : ""}{group.status === "INACTIVE" ? " (Inactive)" : ""}</option>)}
    </select>
    {!groups.some(group => group.status === "ACTIVE") && <p className="mt-2 text-sm text-muted-foreground">No active {label.toLowerCase() === "class" ? "classes" : "batches"} available. You can save as Unassigned{groups.length ? " or keep the current assignment" : ""}. <Link href={`/app/org/${organizationId}/groups/new`} className="inline-flex min-h-11 items-center font-semibold text-primary underline">Add {label.toLowerCase()}</Link></p>}
  </div>;
}
