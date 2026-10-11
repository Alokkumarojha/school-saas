"use client";
import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { type Student, sampleDate } from "@/lib/sample-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
type Status = "present" | "absent";
export function AttendanceRegister({ records }: { records: Student[] }) {
  const groups = [...new Set(records.map((s) => s.group))];
  const [group, setGroup] = useState(groups[0] ?? "");
  const [date, setDate] = useState(sampleDate);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const visible = records.filter((s) => s.group === group);
  const key = (id: string) => `${date}:${id}`;
  const present = visible.filter((s) => marks[key(s.id)] === "present").length;
  const absent = visible.filter((s) => marks[key(s.id)] === "absent").length;
  if (!records.length) {
    return (
      <EmptyState message="There are no students in this institute yet. Attendance will appear here once students are added." />
    );
  }
  return (
    <>
      <Card className="mb-6 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Batch
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-3"
            >
              {groups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Date
            <Input
              type="date"
              required
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
              className="mt-2"
            />
          </label>
        </div>
      </Card>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div aria-live="polite" className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-lg bg-primary/10 px-3 py-2 text-primary">
            {present} present
          </span>
          <span className="rounded-lg bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-300">
            {absent} absent
          </span>
          <span className="rounded-lg bg-muted px-3 py-2 text-muted-foreground">
            {visible.length - present - absent} unmarked
          </span>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            setMarks((previous) => {
              const next = { ...previous };
              visible.forEach((s) => {
                next[key(s.id)] = "present";
              });
              return next;
            })
          }
        >
          <Check className="size-4" />
          Mark all present
        </Button>
      </div>
      <div className="space-y-3">
        {visible.map((s) => (
          <Card
            key={s.id}
            className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-muted text-primary">
                {s.initials}
              </span>
              <div>
                <h2 className="font-semibold">{s.name}</h2>
                <p className="number mt-1 text-xs text-muted-foreground">
                  {s.id}
                </p>
              </div>
            </div>
            <div
              className="grid grid-cols-2 gap-2"
              role="group"
              aria-label={`Attendance for ${s.name}`}
            >
              <Button
                variant="outline"
                aria-pressed={marks[key(s.id)] === "present"}
                className={cn(
                  "min-w-28",
                  marks[key(s.id)] === "present" &&
                    "border-primary bg-primary/10 text-primary",
                )}
                onClick={() =>
                  setMarks((previous) => ({
                    ...previous,
                    [key(s.id)]: "present",
                  }))
                }
              >
                Present
              </Button>
              <Button
                variant="outline"
                aria-pressed={marks[key(s.id)] === "absent"}
                className={cn(
                  "min-w-28",
                  marks[key(s.id)] === "absent" &&
                    "border-red-500 bg-red-500/10 text-red-700 dark:text-red-300",
                )}
                onClick={() =>
                  setMarks((previous) => ({
                    ...previous,
                    [key(s.id)]: "absent",
                  }))
                }
              >
                Absent
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          Demo changes are temporary. They are cleared when you leave or refresh
          this page and are not saved to a server.
        </p>
        <Button
          variant="ghost"
          onClick={() =>
            setMarks((previous) => {
              const next = { ...previous };
              visible.forEach((s) => {
                delete next[key(s.id)];
              });
              return next;
            })
          }
        >
          <RotateCcw className="size-4" />
          Reset this batch
        </Button>
      </div>
    </>
  );
}
