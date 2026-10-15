import { z } from "zod";

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address."),
  role: z.enum(["ADMIN", "STAFF"]),
});
export const memberChangeSchema = z.object({
  targetUserId: z.string().min(1).max(255),
  revision: z.uuid(),
  operation: z.enum(["role", "remove"]),
  role: z.enum(["ADMIN", "STAFF"]),
  confirmed: z.boolean(),
});
export type TeamState = { error?: string; success?: string; link?: string };
export const TEAM_PAGE_SIZE = 20;
export function teamPage(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) return 1;
  return Number(value);
}

// Only the invitation destination is supported here, never a client return URL.
export function authDestination(value: string | string[] | undefined, trustedOrigin?: string) {
  if (value === "/join/accept") return "/join/accept";
  // Clerk normalizes redirect_url to an absolute URL between sign-in/sign-up.
  // Accept only the exact allowlisted path on configured APP_ORIGIN, never Host.
  if (trustedOrigin && typeof value === "string") {
    try {
      const origin = new URL(trustedOrigin);
      if (["http:", "https:"].includes(origin.protocol) && !origin.username && !origin.password &&
        origin.pathname === "/" && !origin.search && !origin.hash && value === `${origin.origin}/join/accept`) return "/join/accept";
    } catch { /* Invalid configuration must not open up redirect validation. */ }
  }
  return "/app";
}
