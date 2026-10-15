"use server";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { acceptTeamInvitation, TeamError } from "@/lib/team";
import { INVITATION_COOKIE, INVITATION_COOKIE_SECONDS, INVALID_INVITATION, readInvitationSeal, sealInvitation } from "@/lib/team-invitation-security";
import type { TeamState } from "@/lib/team-validation";

// This exchanges possession of a raw fragment token for a signed, HttpOnly,
// short-lived cookie. It does not read organization details or join anything.
export async function prepareInvitation(token: string): Promise<TeamState> {
  try {
    if (typeof token !== "string") return { error: INVALID_INVITATION };
    const seal = sealInvitation(token);
    (await cookies()).set(INVITATION_COOKIE, seal, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/join", maxAge: INVITATION_COOKIE_SECONDS });
    return { success: "Invitation ready." };
  } catch { return { error: "Could not open this invitation. Check the link or ask the owner to check invitation configuration." }; }
}

export async function joinOrganization(invitationId: string, _state: TeamState, _form: FormData): Promise<TeamState> {
  void _state; void _form;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=%2Fjoin%2Faccept");
  let organizationId;
  try {
    const hash = readInvitationSeal((await cookies()).get(INVITATION_COOKIE)?.value);
    if (!hash) return { error: "Invitation session expired. Reopen the original invitation link." };
    organizationId = await acceptTeamInvitation(hash, invitationId);
  } catch (error) { return { error: error instanceof TeamError ? error.message : "Could not join. Please retry or ask the owner for help." }; }
  revalidatePath("/app", "layout");
  // Redirect remains outside catch. The retained seal supports safe repeat
  // submissions; consumed invitations cannot recreate removed memberships.
  redirect(`/app/org/${organizationId}`);
}
