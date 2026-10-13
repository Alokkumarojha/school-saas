import { getAttendance } from "@/lib/attendance";
import { kolkataToday } from "@/lib/fee-validation";
import { OrganizationAttendance } from "@/components/attendance/organization-attendance";
export default async function AttendancePage({ params, searchParams }: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId } = await params;
  const data = await getAttendance(organizationId, await searchParams);
  return <div className="space-y-5"><h1 className="text-2xl font-bold">Attendance</h1><OrganizationAttendance
    key={`${data.organization.id}:${data.date}:${data.selected?.group.id ?? ""}:${data.selected?.page ?? 1}`}
    organizationId={data.organization.id} label={data.organization.type === "SCHOOL" ? "Class" : "Batch"}
    groups={data.groups} date={data.date} today={kolkataToday()} selected={data.selected} canWrite={data.role === "OWNER" || data.role === "ADMIN"} error={"error" in data ? data.error : undefined}
  /></div>;
}
