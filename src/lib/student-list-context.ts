export type StudentListContext = { page?: string; q?: string; status?: string; groupId?: string };
export function normalizeStudentSearch(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 100) : "";
}
export function normalizeStudentStatus(value: unknown) {
  return value === "ACTIVE" || value === "INACTIVE" ? value : "ALL";
}
export function normalizeStudentPage(value: unknown) {
  const page = typeof value === "string" && /^[1-9]\d*$/.test(value) ? Number(value) : 1;
  return Number.isSafeInteger(page) ? page : 1;
}
export function studentListQuery(context: StudentListContext) {
  return new URLSearchParams({
    ...(context.q ? { q: context.q } : {}),
    ...(context.status && context.status !== "ALL" ? { status: context.status } : {}),
    ...(context.groupId ? { groupId: context.groupId } : {}),
    ...(context.page ? { page: context.page } : {}),
  }).toString();
}
export function studentListDestination(verifiedOrganizationId: string, context: StudentListContext) {
  const query = studentListQuery(context);
  return `/app/org/${verifiedOrganizationId}/students${query ? "?" + query : ""}`;
}
