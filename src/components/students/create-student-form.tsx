'use client';

import { createStudent } from '@/app/app/org/[organizationId]/students/actions';
import { useActionState, useState } from 'react';

export function CreateStudentForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const action = createStudent.bind(null, organizationId);
  const [values, setValues] = useState({ name: '', guardianName: '', guardianPhone: '' });
  const [state, formAction, pending] = useActionState(action, {
    error: null,
  });

  const inputClass =
    'mt-2 min-h-11 w-full rounded-lg border bg-background px-3 text-sm';

  return (
    <form action={formAction} className="space-y-5">
      <p className="text-sm leading-6 text-muted-foreground">An admission number is assigned automatically when the student is successfully saved.</p>

      <div>
        <label htmlFor="name" className="text-sm font-medium">
          Student name
        </label>
        <input
          id="name"
          name="name"
          value={values.name}
          onChange={event => setValues(previous => ({ ...previous, name: event.target.value }))}
          readOnly={pending}
          required
          minLength={2}
          maxLength={100}
          autoComplete="off"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="guardianName" className="text-sm font-medium">
          Guardian name
        </label>
        <input
          id="guardianName"
          name="guardianName"
          value={values.guardianName}
          onChange={event => setValues(previous => ({ ...previous, guardianName: event.target.value }))}
          readOnly={pending}
          required
          minLength={2}
          maxLength={100}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="guardianPhone" className="text-sm font-medium">
          Guardian phone (optional)
        </label>
        <input
          id="guardianPhone"
          name="guardianPhone"
          value={values.guardianPhone}
          onChange={event => setValues(previous => ({ ...previous, guardianPhone: event.target.value }))}
          readOnly={pending}
          type="tel"
          inputMode="numeric"
          maxLength={10}
          pattern="[6-9][0-9]{9}"
          placeholder="10-digit mobile number"
          className={inputClass}
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-lg bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? 'Saving...' : 'Save student'}
      </button>
    </form>
  );
}
