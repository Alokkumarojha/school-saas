'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@/generated/prisma/client';
import { getDb } from '@/lib/db';
import { createStudentWithAdmissionNumber } from '@/lib/student-admissions';
import { requireOrganizationMembership } from '@/lib/organizations';
import { createStudentSchema, updateStudentSchema, type UpdateStudentState } from '@/lib/student-validation';

export type CreateStudentState = {
  error: string | null;
};

export async function createStudent(
  organizationId: string,
  _previousState: CreateStudentState,
  formData: FormData
): Promise<CreateStudentState> {
  const { organization, role } =
    await requireOrganizationMembership(organizationId);

  if (role !== 'OWNER' && role !== 'ADMIN') {
    return { error: 'You do not have permission to add students.' };
  }

  const result = createStudentSchema.safeParse({
    name: formData.get('name'),
    guardianName: formData.get('guardianName'),
    guardianPhone: formData.get('guardianPhone') ?? '',
  });

  if (!result.success) {
    return {
      error: result.error.issues[0]?.message ?? 'Check the form fields.',
    };
  }

  try {
    await createStudentWithAdmissionNumber(organization.id, result.data);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return {
        error: 'Could not assign an admission number. Please try again.',
      };
    }

    return { error: 'Could not save the student. Please try again.' };
  }

  const studentsPath = `/app/org/${organization.id}/students`;
  revalidatePath(studentsPath);
  redirect(studentsPath);
}

export async function updateStudent(
  organizationId: string,
  studentId: string,
  _previousState: UpdateStudentState,
  formData: FormData,
): Promise<UpdateStudentState> {
  const { organization, role } = await requireOrganizationMembership(organizationId);
  if (role !== 'OWNER' && role !== 'ADMIN') {
    return { error: 'You do not have permission to edit students.' };
  }
  const result = updateStudentSchema.safeParse({
    name: formData.get('name'),
    guardianName: formData.get('guardianName'),
    guardianPhone: formData.get('guardianPhone') ?? '',
    status: formData.get('status'),
  });
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Check the form fields.' };
  }
  try {
    // A single scoped write cannot modify another organization's student.
    // Admission numbers are immutable here; never spread browser fields.
    const updated = await getDb().student.updateMany({
      where: { id: studentId, organizationId: organization.id },
      data: {
        name: result.data.name,
        guardianName: result.data.guardianName,
        guardianPhone: result.data.guardianPhone || null,
        status: result.data.status,
      },
    });
    if (updated.count === 0) return { error: 'Student unavailable in this organization.' };
  } catch {
    return { error: 'Could not update the student. Please try again.' };
  }
  const studentsPath = `/app/org/${organization.id}/students`;
  revalidatePath(studentsPath);
  redirect(studentsPath);
}

