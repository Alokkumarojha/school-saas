import { PageHeading } from "@/components/page-heading";
import { StudentDirectory } from "@/components/student-directory";
import { students } from "@/lib/sample-data";
export const metadata = { title: "Students" };
export default function StudentsPage() {
  return (
    <>
      <PageHeading
        title="Your students"
        description="Every student in one place. Search by name or filter by batch."
      />
      <StudentDirectory records={students} />
    </>
  );
}
