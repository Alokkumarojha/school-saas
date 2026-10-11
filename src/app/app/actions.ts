"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  organizationSchema,
  type CreateOrganizationState,
} from "@/lib/organization-validation";

export async function createOrganization(
  _previous: CreateOrganizationState,
  formData: FormData,
): Promise<CreateOrganizationState> {
  const clerkUserId = await requireUserId();
  const parsed = organizationSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    slug: formData.get("slug"),
  });
  if (!parsed.success)
    return { fieldErrors: parsed.error.flatten().fieldErrors };

  let organizationId: string;
  try {
    // A nested write is atomic. Identity and OWNER role are server-assigned,
    // never read from form fields, cookies, Clerk organization claims or localStorage.
    const organization = await getDb().organization.create({
      data: {
        ...parsed.data,
        memberships: { create: { clerkUserId, role: "OWNER" } },
      },
      select: { id: true },
    });
    organizationId = organization.id;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        fieldErrors: { slug: ["This slug is already in use. Choose another."] },
      };
    }
    // Do not expose database errors or connection details to the browser.
    return {
      error: "We could not create your organization. Please try again later.",
    };
  }
  revalidatePath("/app");
  redirect(`/app/org/${organizationId}`);
}
