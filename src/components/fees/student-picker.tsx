"use client";
import { useState, useTransition } from "react";
import { searchFeeStudents } from "@/app/app/org/[organizationId]/fees/actions";
import type { FeeStudentOption } from "@/lib/fee-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FeeStudentPicker({ organizationId, selected, onSelect, activeOnly = true, disabled = false, allowAll = false }: {
  organizationId: string; selected: FeeStudentOption | null; onSelect: (student: FeeStudentOption | null) => void;
  activeOnly?: boolean; disabled?: boolean; allowAll?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [rows, setRows] = useState<FeeStudentOption[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function search(target = 1, text = query) {
    startTransition(async () => {
      try {
        const result = await searchFeeStudents(organizationId, text, target, activeOnly);
        setRows(result.students); setHasMore(result.hasMore); setPage(target); setSearched(text);
        setMessage(result.students.length ? "" : text.trim() ? "No matching students." : "Enter a name or admission number.");
      } catch { setRows([]); setHasMore(false); setMessage("Could not search students. Please try again."); }
    });
  }
  return <fieldset disabled={disabled} className="min-w-0 space-y-2">
    <legend className="text-sm font-medium">Student{allowAll ? " filter" : ""}</legend>
    <input type="hidden" name="studentId" value={selected?.id ?? ""} />
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input aria-label="Search student name or admission number" placeholder="Name or admission number" value={query} maxLength={100} readOnly={pending} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (!pending && !disabled) search(); } }} />
      <Button type="button" variant="outline" disabled={pending || disabled} onClick={() => search()}>{pending ? "Searching…" : "Find student"}</Button>
    </div>
    <p className="break-words text-sm" aria-live="polite">{selected ? `Selected: ${selected.name} · ${selected.admissionNumber}` : allowAll ? "All students" : "No student selected"}</p>
    {selected && <Button type="button" variant="outline" disabled={pending || disabled} onClick={() => onSelect(null)}>{allowAll ? "All students" : "Clear selection"}</Button>}
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    {rows.length > 0 && <ul aria-label="Student search results" className="max-h-64 overflow-y-auto rounded-xl border border-border">{rows.map(student => <li key={student.id}><button type="button" disabled={pending || disabled} onClick={() => { onSelect(student); setRows([]); setHasMore(false); }} className="min-h-12 w-full break-words px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted">{student.name} · {student.admissionNumber}</button></li>)}</ul>}
    {rows.length > 0 && <div className="flex items-center gap-2"><Button type="button" variant="outline" disabled={pending || page === 1} onClick={() => search(page - 1, searched)}>Previous results</Button><Button type="button" variant="outline" disabled={pending || !hasMore} onClick={() => search(page + 1, searched)}>More results</Button></div>}
  </fieldset>;
}
