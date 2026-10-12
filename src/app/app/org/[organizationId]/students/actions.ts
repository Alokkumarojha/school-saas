'use server';

import { studentReturnFields, validateStudentReturn } from "@/lib/student-return";
import { studentListDestination } from "@/lib/student-list-context";
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@/generated/prisma/client';
import { StudentAssignmentError, validateStudentGroup } from '@/lib/student-groups';
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
    groupId: formData.get('groupId') ?? undefined,
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
    if (error instanceof StudentAssignmentError) return { error: error.message };
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
  const returnContext = await validateStudentReturn(organization.id, studentReturnFields(formData));
  const result = updateStudentSchema.safeParse({
    groupId: formData.get('groupId') ?? undefined,
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
    const updated = await getDb().$transaction(async tx => {
      const [student] = await tx.$queryRaw<{ groupId: string | null }[]>`
        SELECT "groupId" FROM "Student"
        WHERE "id" = ${studentId} AND "organizationId" = ${organization.id} FOR UPDATE
      `;
      if (!student) throw new StudentAssignmentError("Student unavailable in this organization.");
      // Missing field from an older form preserves the current assignment.
      const groupId = result.data.groupId === undefined ? student.groupId : result.data.groupId || null;
      await validateStudentGroup(tx, organization.id, groupId, student.groupId);
      return tx.student.updateMany({
      where: { id: studentId, organizationId: organization.id },
      data: {
        groupId,
        name: result.data.name,
        guardianName: result.data.guardianName,
        guardianPhone: result.data.guardianPhone || null,
        status: result.data.status,
      },
    });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    if (updated.count === 0) return { error: 'Student unavailable in this organization.' };
  } catch (error) {
    if (error instanceof StudentAssignmentError) return { error: error.message };
    return { error: 'Could not update the student. Please try again.' };
  }
  const studentsPath = `/app/org/${organization.id}/students`;
  revalidatePath(studentsPath);
  redirect(studentListDestination(organization.id, returnContext));
}
