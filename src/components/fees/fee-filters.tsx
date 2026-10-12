"use client";
import { useState } from "react";
import Link from "next/link";
import { FeeStudentPicker } from "./student-picker";
import type { FeeStudentOption } from "@/lib/fee-validation";
import { Button } from "@/components/ui/button";

export function FeeFilters({ organizationId, student, due }: { organizationId: string; student: FeeStudentOption | null; due: string }) {
  const [selected, setSelected] = useState(student);
  const base = `/app/org/${organizationId}/fees`;
  return <form action={base} method="get" className="mb-6 space-y-3 rounded-2xl border border-border bg-card p-4">
    <input type="hidden" name="page" value="1" />
    <FeeStudentPicker organizationId={organizationId} selected={selected} onSelect={setSelected} activeOnly={false} allowAll />
    <div><label htmlFor="fee-due-filter" className="text-sm font-medium">Due date</label><select id="fee-due-filter" name="due" defaultValue={due} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4"><option value="all">All</option><option value="overdue">Overdue</option><option value="upcoming">Upcoming</option></select></div>
    <div className="flex flex-wrap gap-2"><Button type="submit">Apply filters</Button><Button asChild variant="outline"><Link href={base}>Clear filters</Link></Button></div>
  </form>;
}
