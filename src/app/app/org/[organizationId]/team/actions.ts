"use server";
import { revalidatePath } from "next/cache";
import { changeTeamMember, inviteTeamMember, revokeTeamInvitation, TeamError } from "@/lib/team";
import type { TeamState } from "@/lib/team-validation";

function failure(error: unknown): TeamState {
  return { error: error instanceof TeamError ? error.message : "Could not save this team change. Check your access or ask your administrator to check the invitation configuration." };
}
export async function createInvitation(organizationId: string, _state: TeamState, form: FormData): Promise<TeamState> {
  let result;
  try { result = await inviteTeamMember(organizationId, { email: form.get("email"), role: form.get("role") }); }
  catch (error) { return failure(error); }
  revalidatePath(`/app/org/${result.organizationId}/team`);
  return { success: "Invitation created. Copy the link now; it cannot be recovered later.", link: result.link };
}
export async function revokeInvitation(organizationId: string, invitationId: string, _state: TeamState, _form: FormData): Promise<TeamState> {
  void _state; void _form;
  let verifiedId;
  try { verifiedId = await revokeTeamInvitation(organizationId, invitationId); }
  catch (error) { return failure(error); }
  revalidatePath(`/app/org/${verifiedId}/team`);
  return { success: "Invitation revoked." };
}
export async function updateMember(organizationId: string, targetUserId: string, revision: string, _state: TeamState, form: FormData): Promise<TeamState> {
  let verifiedId;
  try { verifiedId = await changeTeamMember(organizationId, { targetUserId, revision, operation: form.get("operation"), role: form.get("role"), confirmed: form.get("confirmed") === "on" }); }
  catch (error) { return failure(error); }
  revalidatePath(`/app/org/${verifiedId}/team`);
  revalidatePath("/app", "layout");
  return { success: "Membership updated." };
}
