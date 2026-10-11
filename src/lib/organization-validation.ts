import { z } from "zod";

export const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters.")
    .max(100, "Use no more than 100 characters."),
  type: z.enum(["SCHOOL", "COACHING"], { error: "Choose School or Coaching." }),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Use at least 3 characters.")
    .max(60, "Use no more than 60 characters.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use letters, numbers and single hyphens; no spaces.",
    ),
});

export type CreateOrganizationState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "type" | "slug", string[]>>;
};
