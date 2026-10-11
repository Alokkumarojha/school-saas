"use client";
import { useActionState } from "react";
import { createOrganization } from "@/app/app/actions";
import type { CreateOrganizationState } from "@/lib/organization-validation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function OrganizationForm() {
  const [state, action, pending] = useActionState<
    CreateOrganizationState,
    FormData
  >(createOrganization, {});
  return (
    <form action={action} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <div>
          <label htmlFor="org-name" className="mb-2 block text-sm font-medium">
            Organization name
          </label>
          <Input
            id="org-name"
            name="name"
            required
            minLength={2}
            maxLength={100}
            placeholder="e.g. Saraswati School"
            aria-invalid={!!state.fieldErrors?.name}
            aria-describedby="name-error"
          />
          <p
            id="name-error"
            className="mt-1 text-sm text-red-700 dark:text-red-300"
          >
            {state.fieldErrors?.name?.join(" ")}
          </p>
        </div>
        <div>
          <label htmlFor="org-type" className="mb-2 block text-sm font-medium">
            Organization type
          </label>
          <select
            id="org-type"
            name="type"
            required
            defaultValue="SCHOOL"
            className="min-h-12 w-full rounded-xl border border-border bg-background px-4"
            aria-invalid={!!state.fieldErrors?.type}
            aria-describedby="type-error"
          >
            <option value="SCHOOL">School</option>
            <option value="COACHING">Coaching</option>
          </select>
          <p
            id="type-error"
            className="mt-1 text-sm text-red-700 dark:text-red-300"
          >
            {state.fieldErrors?.type?.join(" ")}
          </p>
        </div>
        <div>
          <label htmlFor="org-slug" className="mb-2 block text-sm font-medium">
            Unique slug
          </label>
          <Input
            id="org-slug"
            name="slug"
            required
            minLength={3}
            maxLength={60}
            pattern="[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*"
            placeholder="e.g. saraswati-kota"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={!!state.fieldErrors?.slug}
            aria-describedby="slug-help slug-error"
          />
          <p id="slug-help" className="mt-2 text-xs text-muted-foreground">
            Letters, numbers and hyphens. Must be unique across organizations.
          </p>
          <p
            id="slug-error"
            className="mt-1 text-sm text-red-700 dark:text-red-300"
          >
            {state.fieldErrors?.slug?.join(" ")}
          </p>
        </div>
      </fieldset>
      <div
        aria-live="polite"
        role="status"
        className="text-sm text-red-700 dark:text-red-300"
      >
        {state.error}
        {state.fieldErrors && "Please check the highlighted fields."}
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating organization…" : "Create organization"}
      </Button>
      <p className="text-xs leading-6 text-muted-foreground">
        You will be the owner of this organization. No student or fee records
        will be created.
      </p>
    </form>
  );
}
