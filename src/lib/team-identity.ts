import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { TEAM_PAGE_SIZE } from "@/lib/team-validation";

export async function verifiedTeamEmails(userId: string) {
  // Identity verification must fail closed, unlike optional display lookups.
  const user = await (await clerkClient()).users.getUser(userId);
  if (user.id !== userId) throw new Error("Identity unavailable.");
  return user.emailAddresses.filter((email) => email.verification?.status === "verified")
    .map((email) => email.emailAddress.trim().toLowerCase());
}

export async function teamProfiles(userIds: string[]) {
  const profiles = new Map<string, { name: string; email: string | null }>();
  if (!userIds.length) return profiles;
  try {
    const { data } = await (await clerkClient()).users.getUserList({ userId: userIds.slice(0, TEAM_PAGE_SIZE), limit: TEAM_PAGE_SIZE });
    for (const user of data) {
      if (!userIds.includes(user.id)) continue;
      const email = user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId && item.verification?.status === "verified");
      profiles.set(user.id, { name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "Team member", email: email?.emailAddress ?? null });
    }
  } catch {
    // Clerk outages or deleted profiles do not change Prisma authorization.
  }
  return profiles;
}
