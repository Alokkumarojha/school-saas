import { z } from "zod";
const normalize = (value: string) => value.trim().replace(/\s+/g, " ");
export const groupSchema = z.object({
  name: z.string().transform(normalize).pipe(z.string().min(1, "Enter a name.").max(100, "Use at most 100 characters for the name.")),
  section: z.string().transform(normalize).pipe(z.string().max(60, "Use at most 60 characters for the section.")),
  status: z.enum(["ACTIVE", "INACTIVE"], { error: "Choose Active or Inactive." }),
});
export type GroupValues = z.input<typeof groupSchema>;
export type GroupState = { error: string | null };
export function groupLabels(type: string) {
  return type === "SCHOOL" ? { singular: "Class", plural: "Classes" } : { singular: "Batch", plural: "Batches" };
}
