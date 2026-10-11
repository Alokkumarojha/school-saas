import { Wallet, IndianRupee, UsersRound } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatCard } from "@/components/stat-card";
import { StudentDirectory } from "@/components/student-directory";
import { students, money } from "@/lib/sample-data";
export const metadata = { title: "Fees" };
export default function FeesPage() {
  return (
    <>
      <PageHeading
        title="Fee overview"
        description="A clear view of collected and outstanding fees. All amounts are sample data."
      />
      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total collected"
          value={money(students.reduce((a, s) => a + s.paid, 0))}
          detail="Total from sample records"
          icon={Wallet}
        />
        <StatCard
          label="Total outstanding"
          value={money(students.reduce((a, s) => a + s.due, 0))}
          detail="Upcoming fees due"
          icon={IndianRupee}
        />
        <StatCard
          label="Fees pending"
          value={`${students.filter((s) => s.due > 0).length} students`}
          detail={`Out of ${students.length} students`}
          icon={UsersRound}
        />
      </div>
      <StudentDirectory records={students} mode="fees" />
      <p className="mt-6 text-xs text-muted-foreground">
        Payments are not accepted here. Receipt and payment services are not
        connected yet.
      </p>
    </>
  );
}
