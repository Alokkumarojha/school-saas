import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const INVITATION_COOKIE = "vidya-invitation";
export const INVITATION_COOKIE_SECONDS = 3600;
export const INVALID_INVITATION = "This invitation is unavailable, expired, revoked, or does not match a verified email on your account. Ask the owner for a new link if needed.";

export function trustedAppOrigin() {
  const value = process.env.APP_ORIGIN;
  if (!value) throw new Error("Invitation configuration is unavailable.");
  const url = new URL(value);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && local && url.protocol === "http:"))) {
    throw new Error("Invitation configuration is unavailable.");
  }
  return url.origin;
}
function signingSecret() {
  const secret = process.env.TEAM_INVITATION_COOKIE_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("Invitation configuration is unavailable.");
  return secret;
}
export function invitationHash(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error(INVALID_INVITATION);
  return createHash("sha256").update(token).digest("hex");
}
export function createInvitationSecret() {
  // Validate all required configuration before creating an invitation.
  signingSecret();
  const origin = trustedAppOrigin();
  const token = randomBytes(32).toString("base64url");
  return { tokenHash: invitationHash(token), link: `${origin}/join#${token}` };
}
export function sealInvitation(token: string, now = Date.now()) {
  const payload = `${invitationHash(token)}.${now + INVITATION_COOKIE_SECONDS * 1000}`;
  return `${payload}.${createHmac("sha256", signingSecret()).update(payload).digest("hex")}`;
}
export function readInvitationSeal(value: string | undefined, now = Date.now()) {
  if (!value || !/^[0-9a-f]{64}\.\d{13}\.[0-9a-f]{64}$/.test(value)) return null;
  const [hash, expiry, mac] = value.split(".");
  const expected = createHmac("sha256", signingSecret()).update(`${hash}.${expiry}`).digest();
  if (!timingSafeEqual(expected, Buffer.from(mac, "hex")) || Number(expiry) <= now) return null;
  return hash;
}
