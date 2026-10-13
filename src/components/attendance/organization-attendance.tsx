"use client";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveAttendance } from "@/app/app/org/[organizationId]/attendance/actions";
import { attendanceCounts, type AttendanceRow, type AttendanceState, type AttendanceStatus } from "@/lib/attendance-validation";

type Group = { id: string; name: string; section: string; status: "ACTIVE" | "INACTIVE" };
const labels = { PRESENT: "Present", ABSENT: "Absent", LATE: "Late", UNMARKED: "Unmarked" };
const selectClass = "min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
export function OrganizationAttendance({ organizationId, label, groups, date, today, selected, canWrite, error }: {
  organizationId: string; label: string; groups: Group[]; date: string; today: string; canWrite: boolean; error?: string;
  selected: { group: Group; rows: AttendanceRow[]; page: number; pages: number; total: number } | null;
}) {
  const [rows, setRows] = useState(selected?.rows ?? []);
  const [baseline, setBaseline] = useState(selected?.rows ?? []);
  const [feedback, setFeedback] = useState<AttendanceState>({ error: error ?? null });
  const [pending, startTransition] = useTransition();
  const dirty = rows.some((row, i) => row.status !== baseline[i].status);
  useEffect(() => {
    if (!dirty && !pending) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("a[href]")) return;
      if (pending || !window.confirm("You have unsaved attendance changes. Leave without saving?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [dirty, pending]);
  const counts = attendanceCounts(rows);
  const base = `/app/org/${organizationId}/attendance`;
  function pageLink(page: number) {
    return `${base}?${new URLSearchParams({ groupId: selected!.group.id, date, page: String(page) })}`;
  }
  return <div className="space-y-5">
    <form action={base} onSubmit={event => { if (pending || (dirty && !window.confirm("Discard unsaved attendance changes and load another register?"))) event.preventDefault(); }} className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="min-w-0 text-sm font-medium">{label}<select name="groupId" required defaultValue={selected?.group.id ?? ""} className={selectClass} disabled={pending}><option value="">Choose {label.toLowerCase()}</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}{group.section ? ` · ${group.section}` : ""}{group.status === "INACTIVE" ? " (Inactive — saved records only)" : ""}</option>)}</select></label>
      <label className="min-w-0 text-sm font-medium">Date<Input name="date" type="date" required defaultValue={date} max={today} disabled={pending} /></label>
      <Button type="submit" disabled={pending || groups.length === 0}>Load attendance</Button>
    </form>
    <p className="text-sm text-muted-foreground">New registers use current active student assignments, including for past dates. Historical enrollment tracking is not implemented. Saved attendance stays with its original {label.toLowerCase()}.</p>
    {!canWrite && <p className="text-sm text-muted-foreground">View-only access. Only owners and admins can record attendance.</p>}
    {feedback.error && <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{feedback.error}</p>}
    {feedback.success && <p role="status" className="rounded-xl border border-border bg-muted p-3 text-sm">{feedback.success}</p>}
    {groups.length === 0 ? <p>No {label.toLowerCase()} options yet. {canWrite && <a href={`/app/org/${organizationId}/groups/new`} className="font-semibold text-primary underline">Create a {label.toLowerCase()}</a>}</p> : !selected ? <p>Select a {label.toLowerCase()} and date to load attendance.</p> : <>
      <div><h2 className="text-lg font-bold break-words">{selected.group.name}{selected.group.section ? ` · ${selected.group.section}` : ""}</h2><p className="text-sm text-muted-foreground">{date} · {selected.total} students · Counts below cover this displayed page, including students already marked elsewhere.</p></div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(counts).map(([status, count]) => <div key={status} className="rounded-xl border border-border bg-card p-3"><dt className="text-sm text-muted-foreground">{labels[status as keyof typeof labels]}</dt><dd className="text-xl font-bold tabular-nums">{count}</dd></div>)}</dl>
      {rows.length === 0 && <p className="rounded-xl border border-border p-5">No students to display. Active groups show currently active assigned students and saved records; inactive groups show saved records only.</p>}
      <form onSubmit={event => {
        event.preventDefault();
        startTransition(async () => {
          try {
            const result = await saveAttendance(organizationId, { groupId: selected.group.id, date, entries: rows.filter((row, i) => row.editable && row.status !== null && row.status !== baseline[i].status).map(row => ({ studentId: row.id, status: row.status, version: row.version })) });
            setFeedback(result);
            if (!result.error && result.saved) {
              const next = rows.map(row => { const saved = result.saved!.find(item => item.studentId === row.id); return saved ? { ...row, status: saved.status, version: saved.version } : row; });
              setRows(next); setBaseline(next);
            }
          } catch { setFeedback({ error: "Unable to save. Check your access and connection, then reload. Your selections have been kept." }); }
        });
      }} className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-2">{rows.map((row, index) => <article key={row.id} className="min-w-0 rounded-2xl border border-border bg-card p-4">
          <h3 className="break-words font-semibold">{row.name}</h3><p className="mb-2 text-sm text-muted-foreground">{row.admissionNumber}</p>
          {row.explanation && <p className="mb-2 text-sm text-muted-foreground">{row.explanation}</p>}
          <label className="text-sm font-medium">Attendance for {row.name}<select aria-label={`Attendance for ${row.name} (${row.admissionNumber})`} value={row.status ?? "UNMARKED"} disabled={!row.editable || pending} className={selectClass} onChange={event => {
            const status = event.target.value === "UNMARKED" ? null : event.target.value as AttendanceStatus;
            setRows(current => current.map((item, i) => i === index ? { ...item, status } : item)); setFeedback({ error: null });
          }}><option value="UNMARKED" disabled={baseline[index].version > 0}>Unmarked</option><option value="PRESENT">Present</option><option value="ABSENT">Absent</option><option value="LATE">Late</option></select></label>
        </article>)}</div>
        {canWrite && rows.some(row => row.editable) && <div className="space-y-2"><p className="text-sm text-muted-foreground">Only explicitly marked changes are saved. Saved marks can be corrected, but not cleared in this step.</p><Button type="submit" disabled={pending || !dirty} className="w-full sm:w-auto">{pending ? "Saving attendance…" : "Save attendance"}</Button>{dirty && <p className="text-sm" role="status">Unsaved changes</p>}</div>}
      </form>
      <nav aria-label="Attendance roster pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">{selected.page > 1 ? <a className="inline-flex min-h-11 items-center font-semibold text-primary" href={pageLink(selected.page - 1)}>Previous</a> : <span />}<span>Page {selected.page} of {selected.pages}</span>{selected.page < selected.pages ? <a className="inline-flex min-h-11 items-center font-semibold text-primary" href={pageLink(selected.page + 1)}>Next</a> : <span />}</nav>
    </>}
  </div>;
}
