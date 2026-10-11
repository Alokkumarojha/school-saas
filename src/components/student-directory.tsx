"use client";
import { useState } from "react";
import { Search, UsersRound, Check, Clock3 } from "lucide-react";
import { type Student, money, dateLabel } from "@/lib/sample-data";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
export function StudentDirectory({
  records,
  mode = "students",
}: {
  records: Student[];
  mode?: "students" | "fees";
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const fees = mode === "fees";
  const groups = [...new Set(records.map((s) => s.group))];
  const filtered = records.filter(
    (s) =>
      `${s.name} ${s.guardian} ${s.id}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()) &&
      (filter === "all" ||
        (fees
          ? filter === "due"
            ? s.due > 0
            : s.due === 0
          : s.group === filter)),
  );
  function reset() {
    setQuery("");
    setFilter("all");
  }
  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-4 size-4 text-muted-foreground" />
          <Input
            aria-label="Search by student name, guardian or ID"
            placeholder="Search name, guardian or ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-card pl-11"
          />
        </div>
        <select
          aria-label={fees ? "Fee status" : "Choose a batch"}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="min-h-12 rounded-xl border border-border bg-card px-4 text-sm sm:w-56"
        >
          <option value="all">
            {fees ? "All fee statuses" : "All batches"}
          </option>
          {fees ? (
            <>
              <option value="due">Fees outstanding</option>
              <option value="paid">Fully paid</option>
            </>
          ) : (
            groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))
          )}
        </select>
      </div>
      <p className="mb-4 text-xs text-muted-foreground" aria-live="polite">
        {filtered.length} of {records.length} students
      </p>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {filtered.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
                {s.initials}
              </span>
              <div>
                <h2 className="font-semibold">{s.name}</h2>
                <p className="number mt-1 text-xs text-muted-foreground">
                  {s.id}
                </p>
              </div>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm">
              <UsersRound className="size-4 text-muted-foreground" />
              {s.group}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Guardian: {s.guardian}
            </p>
            {fees && (
              <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-muted p-3">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Collected fees
                  </dt>
                  <dd className="number mt-1 font-semibold">{money(s.paid)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Outstanding</dt>
                  <dd className="number mt-1 font-semibold">{money(s.due)}</dd>
                </div>
              </dl>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              <span
                className={
                  s.due
                    ? "flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-800 dark:text-amber-300"
                    : "flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary"
                }
              >
                {s.due ? (
                  <Clock3 className="size-3" />
                ) : (
                  <Check className="size-3" />
                )}
                {s.due ? `${money(s.due)} outstanding` : "Fully paid"}
              </span>
              {fees && s.due > 0 && (
                <span className="text-xs text-muted-foreground">
                  Due: {dateLabel(s.dueDate)}
                </span>
              )}
            </div>
          </Card>
        ))}
        {!filtered.length && (
          <EmptyState
            message="Try a different search or filter."
            action={
              <Button variant="outline" onClick={reset}>
                View all students
              </Button>
            }
          />
        )}
      </div>
    </>
  );
}
