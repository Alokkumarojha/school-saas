import { z } from "zod";
import { kolkataToday, validDateOnly } from "./fee-validation";
export const ATTENDANCE_PAGE_SIZE = 50;
export const attendanceStatus = z.enum(["PRESENT", "ABSENT", "LATE"]);
export type AttendanceStatus = z.infer<typeof attendanceStatus>;
export const attendanceSelectionSchema = () => z.object({
  groupId: z.string().cuid("Choose a valid class or batch."),
  date: z.string().refine(validDateOnly, "Choose a valid calendar date.").refine(value => value <= kolkataToday(), "Attendance cannot be recorded for a future date."),
});
export const attendanceSaveSchema = () => attendanceSelectionSchema().extend({
  entries: z.array(z.object({
    studentId: z.string().cuid(), status: attendanceStatus,
    version: z.number().int().min(0).max(2147483646),
  }).strict()).max(ATTENDANCE_PAGE_SIZE).refine(entries => new Set(entries.map(entry => entry.studentId)).size === entries.length, "Duplicate students in submission."),
});
export type AttendanceRow = {
  id: string; name: string; admissionNumber: string;
  status: AttendanceStatus | null; version: number; editable: boolean; explanation: string | null;
};
export type AttendanceState = { error: string | null; success?: string; saved?: { studentId: string; status: AttendanceStatus; version: number }[] };
export function attendanceCounts(rows: { status: AttendanceStatus | null }[]) {
  return rows.reduce((counts, row) => { counts[row.status ?? "UNMARKED"]++; return counts; }, { PRESENT: 0, ABSENT: 0, LATE: 0, UNMARKED: 0 });
}
