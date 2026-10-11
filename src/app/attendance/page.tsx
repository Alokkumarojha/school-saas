import { PageHeading } from "@/components/page-heading";
import { AttendanceRegister } from "@/components/attendance-register";
import { students } from "@/lib/sample-data";
export const metadata = { title: "Attendance" };
export default function AttendancePage() {
  return (
    <>
      <PageHeading
        title="Attendance"
        description="Choose a batch and date, then mark attendance with a tap."
      />
      <AttendanceRegister records={students} />
    </>
  );
}
