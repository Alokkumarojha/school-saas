import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  UsersRound,
  Wallet,
  Clock3,
  BookOpen,
  CalendarCheck,
  IndianRupee,
} from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  batches,
  students,
  money,
  dateLabel,
  sampleDate,
} from "@/lib/sample-data";
export default function Home() {
  const due = students.reduce((sum, s) => sum + s.due, 0);
  const paid = students.reduce((sum, s) => sum + s.paid, 0);
  const collected = Math.round((paid / (paid + due)) * 100);
  return (
    <>
      <PageHeading
        title="Hello, Principal 👋"
        description="A clear view of your institute. Get ready for the day ahead."
        action={
          <span className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
            <CalendarDays className="size-4 text-primary" />
            {dateLabel(sampleDate)}
          </span>
        }
      />
      <section className="relative mb-6 overflow-hidden rounded-2xl bg-[#215b4b] p-6 text-white sm:p-8">
        <div
          aria-hidden="true"
          className="absolute -right-14 -top-20 size-72 rounded-full border-[40px] border-white/5"
        />
        <div className="relative max-w-lg">
          <p className="mb-3 text-xs font-medium tracking-widest text-emerald-100">
            SMALL STEPS, BETTER MANAGEMENT
          </p>
          <h2 className="text-xl font-semibold leading-relaxed sm:text-2xl">
            Every student matters.
            <br />
            Every day, made simpler.
          </h2>
          <p className="mb-5 mt-3 text-sm leading-6 text-emerald-100">
            This sample workspace has 3 batches. Start with attendance.
          </p>
          <Button
            asChild
            className="bg-white text-[#215b4b] hover:bg-emerald-50"
          >
            <Link href="/attendance">
              <CalendarCheck className="size-4" />
              Mark attendance
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
      <section
        aria-label="Institute summary"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-5"
      >
        <StatCard
          label="Total students"
          value={String(students.length).padStart(2, "0")}
          detail="Enrolled across 3 batches"
          icon={UsersRound}
        />
        <StatCard
          label="Collected fees"
          value={money(paid)}
          detail="Sample fee records"
          icon={Wallet}
        />
        <StatCard
          label="Outstanding fees"
          value={money(due)}
          detail="Pending for 3 students"
          icon={IndianRupee}
        />
        <StatCard
          label="Batches today"
          value="03"
          detail="From 4 PM to 7 PM"
          icon={BookOpen}
        />
      </section>
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-border p-5">
            <h2 className="font-bold">Daily timetable</h2>
            <span className="rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              Sample day
            </span>
          </div>
          <div className="divide-y divide-border">
            {batches.map((batch, i) => (
              <div key={batch.name} className="flex items-start gap-4 p-5">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                  0{i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{batch.name}</h3>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {batch.teacher} · {batch.room} · Students: {batch.count}
                  </p>
                  <p className="number mt-3 flex items-center gap-1.5 text-xs text-primary">
                    <Clock3 className="size-3.5" />
                    {batch.time}
                  </p>
                </div>
                <Link
                  href="/attendance"
                  aria-label="Open attendance"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted"
                >
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-bold">Fees at a glance</h2>
            <Wallet className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Collection against total assigned fees
          </p>
          <div className="my-3 flex items-end gap-2">
            <span className="number text-4xl font-semibold">{collected}%</span>
            <span className="pb-1 text-xs text-muted-foreground">
              collected
            </span>
          </div>
          <div
            className="mb-5 h-2.5 overflow-hidden rounded-full bg-muted"
            role="meter"
            aria-label="Fee collection percentage"
            aria-valuenow={collected}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${collected}%` }}
            />
          </div>
          <div className="space-y-4">
            {students
              .filter((s) => s.due > 0)
              .map((s) => (
                <div key={s.id} className="flex justify-between gap-3 text-sm">
                  <span>{s.name}</span>
                  <span className="number font-semibold">{money(s.due)}</span>
                </div>
              ))}
          </div>
          <Button asChild variant="outline" className="mt-6 w-full">
            <Link href="/fees">
              View fee details
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </Card>
      </div>
      <p className="mt-6 text-center text-xs leading-6 text-muted-foreground">
        UI preview only. No payments or real student data are connected.
      </p>
    </>
  );
}
