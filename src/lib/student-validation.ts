import { z } from 'zod';

export const createStudentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Student name must contain at least 2 characters.')
    .max(100, 'Use at most 100 characters.'),

  guardianName: z
    .string()
    .trim()
    .min(2, 'Guardian name must contain at least 2 characters.')
    .max(100, 'Use at most 100 characters.'),

  guardianPhone: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^[6-9]\d{9}$/.test(value),
      'Enter a valid 10-digit Indian mobile number.'
    ),
});

export const updateStudentSchema = createStudentSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE'], { error: 'Choose Active or Inactive.' }),
});

export type StudentEditValues = z.input<typeof updateStudentSchema> & { admissionNumber: string };
export type UpdateStudentState = { error: string | null };
