import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

const organizationSelect = {
  id: true,
  name: true,
  type: true,
  slug: true,
} as const;

export async function listMyOrganizations() {
  const clerkUserId = await requireUserId();
  return getDb().membership.findMany({
    where: { clerkUserId },
    select: { role: true, organization: { select: organizationSelect } },
    orderBy: { createdAt: "asc" },
  });
}

// Call at each data boundary, including future actions/handlers. A layout or
// browser-selected organization alone is not an authorization boundary.
export async function requireOrganizationMembership(untrustedId: string) {
  const clerkUserId = await requireUserId();
  const result = z.string().cuid().safeParse(untrustedId);
  if (!result.success) notFound();
  const membership = await getDb().membership.findUnique({
    where: {
      organizationId_clerkUserId: { organizationId: result.data, clerkUserId },
    },
    select: { role: true, organization: { select: organizationSelect } },
  });
  // Same response for missing organizations and non-members; never disclose existence.
  if (!membership) notFound();
  return membership;
}
