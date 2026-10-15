import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ setCookie: vi.fn(), getCookie: vi.fn(), accept: vi.fn(), preview: vi.fn(), auth: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.setCookie, get: mocks.getCookie }) }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/team", () => ({ acceptTeamInvitation: mocks.accept, previewTeamInvitation: mocks.preview, TeamError: class extends Error {} }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error("REDIRECT:" + path); } }));
import { invitationHash, createInvitationSecret, sealInvitation, readInvitationSeal, trustedAppOrigin, INVITATION_COOKIE } from "@/lib/team-invitation-security";
import { inviteSchema, teamPage, authDestination } from "@/lib/team-validation";
import { prepareInvitation, joinOrganization } from "@/app/join/actions";
import AcceptPage from "@/app/join/accept/page";
import nextConfig from "../next.config";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", "https://vidya.example");
  vi.stubEnv("TEAM_INVITATION_COOKIE_SECRET", "test-only-cookie-key-".repeat(3));
  mocks.auth.mockResolvedValue({ userId: "recipient" });
});
afterEach(() => vi.unstubAllEnvs());

describe("invitation secrets and destination security (unit tests)", () => {
  it("creates unique 32-byte fragment tokens and stores only SHA-256 hashes", () => {
    const first = createInvitationSecret(), second = createInvitationSecret();
    const token = first.link.split("#")[1];
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(first.tokenHash).toBe(invitationHash(token)); expect(first.tokenHash).toHaveLength(64);
    expect(first).not.toEqual(second); expect(first.link.startsWith("https://vidya.example/join#")).toBe(true);
    expect(new URL(first.link).search).toBe("");
  });
  it("normalizes only case and surrounding whitespace", () => {
    expect(inviteSchema.parse({ email: " Person.Name+tag@Example.com ", role: "STAFF" }).email).toBe("person.name+tag@example.com");
  });
  it.each(["", "https://user:password@example.com", "https://example.com/path", "https://example.com?x=y", "https://example.com#secret", "http://example.com", "javascript:alert(1)"])("rejects untrusted origin configuration %s", origin => {
    vi.stubEnv("APP_ORIGIN", origin); expect(() => trustedAppOrigin()).toThrow();
  });
  it("allows HTTP localhost only for development and requires a signing secret", () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    expect(trustedAppOrigin()).toBe("http://localhost:3000");
    vi.stubEnv("NODE_ENV", "production"); expect(() => trustedAppOrigin()).toThrow();
    vi.stubEnv("TEAM_INVITATION_COOKIE_SECRET", "short"); expect(() => sealInvitation("a".repeat(43))).toThrow();
  });
  it("seals hash-only cookie, rejects forged/expired cookies and key rotation", () => {
    const token = "a".repeat(43), now = 1791936000000;
    const seal = sealInvitation(token, now);
    expect(seal).not.toContain(token); expect(readInvitationSeal(seal, now)).toBe(invitationHash(token));
    expect(readInvitationSeal(seal, now + 3600000)).toBeNull();
    expect(readInvitationSeal(`f${seal.slice(1)}`, now)).toBeNull();
    expect(readInvitationSeal(seal.replace(String(now + 3600000), String(now + 7200000)), now)).toBeNull();
    expect(readInvitationSeal(invitationHash(token), now)).toBeNull();
    vi.stubEnv("TEAM_INVITATION_COOKIE_SECRET", "rotated-test-key-".repeat(4)); expect(readInvitationSeal(seal, now)).toBeNull();
  });
  it.each([undefined, ["1", "2"], "-1", "0", "NaN", "1.2", "999999999999999999"])("normalizes invalid pagination %j", value => { expect(teamPage(value)).toBe(1); });
  it.each([undefined, "https://evil.example", "//evil.example", "/join/accept?org=foreign", "/app/org/foreign", ["/join/accept"]])("does not accept arbitrary authentication destination %j", value => { expect(authDestination(value)).toBe("/app"); });
  it("preserves only the exact invitation destination", () => expect(authDestination("/join/accept")).toBe("/join/accept"));
  it("accepts Clerk's absolute form only on configured APP_ORIGIN and returns a fixed internal path", () => {
    expect(authDestination("https://vidya.example/join/accept", "https://vidya.example")).toBe("/join/accept");
    expect(authDestination("http://localhost:3000/join/accept", "http://localhost:3000")).toBe("/join/accept");
    for (const value of ["https://evil.example/join/accept", "https://vidya.example/app", "https://vidya.example/join/accept?next=evil", "https://vidya.example/join/accept#secret", "//vidya.example/join/accept", "https://vidya.example.evil/join/accept", ["https://vidya.example/join/accept"]]) {
      expect(authDestination(value, "https://vidya.example")).toBe("/app");
    }
    expect(authDestination("https://vidya.example/join/accept")).toBe("/app");
    expect(authDestination("https://vidya.example/join/accept", "invalid origin")).toBe("/app");
  });
  it("sets a short-lived HttpOnly signed cookie without reading or consuming an invitation", async () => {
    const token = "a".repeat(43); vi.stubEnv("NODE_ENV", "production");
    expect(await prepareInvitation(token)).toHaveProperty("success");
    expect(mocks.setCookie).toHaveBeenCalledWith(INVITATION_COOKIE, expect.any(String), { httpOnly: true, secure: true, sameSite: "lax", path: "/join", maxAge: 3600 });
    expect(mocks.accept).not.toHaveBeenCalled(); expect(mocks.preview).not.toHaveBeenCalled();
    expect(await prepareInvitation("invalid")).toHaveProperty("error"); expect(mocks.setCookie).toHaveBeenCalledTimes(1);
  });
  it("requires sign-in and preserves only a fixed non-secret destination", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    await expect(AcceptPage()).rejects.toThrow("REDIRECT:/sign-in?redirect_url=%2Fjoin%2Faccept");
    await expect(joinOrganization("id", {}, new FormData())).rejects.toThrow("REDIRECT:/sign-in?redirect_url=%2Fjoin%2Faccept");
    expect(mocks.accept).not.toHaveBeenCalled();
  });
  it("GET renders an explicit Join without acceptance; POST rechecks and redirects outside catch", async () => {
    mocks.getCookie.mockReturnValue({ value: sealInvitation("a".repeat(43)) });
    mocks.preview.mockResolvedValue({ id: "invite", name: "School", role: "STAFF", accepted: false });
    const html = renderToStaticMarkup(await AcceptPage());
    expect(html).toContain("Join organization"); expect(mocks.accept).not.toHaveBeenCalled();
    mocks.accept.mockResolvedValue("verified-org");
    const form = new FormData(); form.set("organizationId", "foreign"); form.set("role", "OWNER"); form.set("email", "forged@example.com");
    await expect(joinOrganization("invite", {}, form)).rejects.toThrow("REDIRECT:/app/org/verified-org");
    expect(mocks.accept).toHaveBeenCalledWith(invitationHash("a".repeat(43)), "invite");
  });
  it("handles expired sessions and identity failures without leaking details", async () => {
    expect(await joinOrganization("invite", {}, new FormData())).toHaveProperty("error");
    mocks.getCookie.mockReturnValue({ value: sealInvitation("a".repeat(43)) });
    mocks.preview.mockRejectedValue(new Error("private database details"));
    const html = renderToStaticMarkup(await AcceptPage());
    expect(html).toContain("Invitation unavailable"); expect(html).not.toContain("private database details");
    mocks.accept.mockRejectedValue(new Error("private error"));
    expect(await joinOrganization("invite", {}, new FormData())).toEqual({ error: "Could not join. Please retry or ask the owner for help." });
  });
  it("configures no-store/referrer protection and excludes third-party resources on join", async () => {
    const rules = await nextConfig.headers!();
    const join = rules.find(rule => rule.source === "/join")!;
    expect(join.headers).toEqual(expect.arrayContaining([{ key: "Cache-Control", value: "private, no-store, max-age=0" }, { key: "Referrer-Policy", value: "no-referrer" }]));
    expect(join.headers.find(h => h.key === "Content-Security-Policy")?.value).toContain("connect-src 'self'");
    const landing = readFileSync("src/components/team/invitation-landing.tsx", "utf8");
    expect(landing.indexOf("history.replaceState")).toBeLessThan(landing.indexOf("prepareInvitation(token)"));
    // Source guard in addition to mocked server tests; this is not a browser
    // network/referrer or production-header verification.
    expect(landing).not.toMatch(/console\.|localStorage|sessionStorage/);
  });
});
