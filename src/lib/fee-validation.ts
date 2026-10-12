import { z } from "zod";
// PostgreSQL signed INTEGER maximum: ₹2,14,74,836.47.
export const MAX_AMOUNT_PAISE = 2147483647;
export function parseRupees(input: string): number | null {
  const match = /^(0|[1-9]\d{0,7})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const paise = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
  return paise > BigInt(0) && paise <= BigInt(MAX_AMOUNT_PAISE) ? Number(paise) : null;
}
export function validDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function kolkataToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export const feeChargeSchema = z.object({
  studentId: z.string().cuid("Choose a student."),
  title: z.string().trim().min(1, "Enter a title.").max(150, "Use at most 150 characters."),
  amount: z.string().refine(value => parseRupees(value) !== null, "Enter ₹0.01 to ₹2,14,74,836.47, with at most two decimal places.").transform(value => parseRupees(value)!),
  dueDate: z.string().refine(validDateOnly, "Enter a valid date in YYYY-MM-DD format."),
  submissionKey: z.string().uuid("Invalid submission. Reload the form."),
});
export function chargedAmount(paise: number) {
  // Integer grouping and remainder avoid floating-point money calculations.
  return `₹${Math.floor(paise / 100).toLocaleString("en-IN")}.${String(paise % 100).padStart(2, "0")}`;
}
export function feeDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
export type FeeState = { error: string | null };
export type FeeStudentOption = { id: string; name: string; admissionNumber: string };
