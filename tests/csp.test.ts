import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { unstable_doesMiddlewareMatch, unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
const mocks = vi.hoisted(() => ({ clerk: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware: mocks.clerk.mockReturnValue(vi.fn()) }));
import { config as proxyConfig } from "@/proxy";
import nextConfig from "../next.config";
import { clerkPagePolicy, invitationLandingPolicy } from "@/lib/content-security-policy";

function publicKey(host: string, live = false) { return `pk_${live ? "live" : "test"}_${Buffer.from(host + "$", "utf8").toString("base64")}`; }
function directives(policy: string) {
  return Object.fromEntries(policy.split(";").map(directive => { const [name, ...values] = directive.trim().split(/\s+/); return [name, values]; }));
}
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", publicKey("test-instance.clerk.accounts.dev"));
  vi.stubEnv("NODE_ENV", "development");
});
afterEach(() => vi.unstubAllEnvs());

describe("CSP route configuration using Next's actual config matcher (not browser verification)", () => {
  it.each(["/join", "/join?test=1"])("keeps %s same-origin, private and outside Clerk middleware", async path => {
    const response = await unstable_getResponseFromNextConfig({ url: `https://app.example${path}`, nextConfig });
    expect(response.headers.get("Content-Security-Policy")).toBe(invitationLandingPolicy(true));
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("Content-Security-Policy")).not.toMatch(/clerk|cloudflare|https:/);
    expect(unstable_doesMiddlewareMatch({ config: proxyConfig, url: path, nextConfig })).toBe(false);
  });
  it.each(["/join/accept", "/join/accept?test=1", "/sign-in", "/sign-in/factor-one", "/sign-up", "/sign-up/verify-email-address", "/app", "/app/org/example", "/app/org/example/team"])("gives %s exactly one compatible policy with private headers", async path => {
    const response = await unstable_getResponseFromNextConfig({ url: `https://app.example${path}`, nextConfig });
    const policy = response.headers.get("Content-Security-Policy")!;
    expect(policy).toBe(clerkPagePolicy({ publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, development: true }));
    expect(policy.split("default-src")).toHaveLength(2);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(unstable_doesMiddlewareMatch({ config: proxyConfig, url: path, nextConfig })).toBe(true);
  });
  it("has no overlapping landing rule, middleware CSP injection, or CSP meta tag", async () => {
    const rules = await nextConfig.headers!();
    expect(rules.map(rule => rule.source)).toEqual(["/join", "/join/accept/:path*", "/app/:path*", "/sign-in/:path*", "/sign-up/:path*"]);
    for (const rule of rules) expect(rule.headers.filter(header => header.key.toLowerCase() === "content-security-policy")).toHaveLength(1);
    expect(mocks.clerk).toHaveBeenCalledWith(); // No automatic second CSP policy.
    for (const file of ["src/app/layout.tsx", "src/app/(auth)/layout.tsx", "src/app/join/layout.tsx", "src/components/auth-provider.tsx"]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/httpEquiv=.*Content-Security-Policy/i);
    }
  });
  it("does not change public sample page headers", async () => {
    const response = await unstable_getResponseFromNextConfig({ url: "https://app.example/", nextConfig });
    expect(response.headers.has("Content-Security-Policy")).toBe(false);
  });
});

describe("Clerk documented CSP sources", () => {
  it.each([false, true])("derives the exact %s instance origin from public configuration", live => {
    const host = live ? "clerk.school.example" : "another-instance.clerk.accounts.dev";
    const policy = directives(clerkPagePolicy({ publishableKey: publicKey(host, live), development: false }));
    expect(policy["script-src"]).toContain(`https://${host}`);
    expect(policy["connect-src"]).toContain(`https://${host}`);
    expect(policy["script-src"]).toContain("https://challenges.cloudflare.com");
    expect(policy["script-src"]).toContain("https://*.protect.clerk.com");
    expect(policy["frame-src"]).toContain("https://*.protect.clerk.com");
    expect(policy["frame-src"]).toContain("https://challenges.cloudflare.com");
    expect(policy["connect-src"]).toContain("https://*.protect.clerk.com:*");
    expect(policy["img-src"]).toContain("https://img.clerk.com");
    expect(policy["worker-src"]).toEqual(["'self'", "blob:"]);
    expect(policy["style-src"]).toContain("'unsafe-inline'");
    expect(Object.values(policy).flat()).not.toEqual(expect.arrayContaining(["*"]));
    expect(Object.values(policy).flat()).not.toContain("https:");
    expect(Object.values(policy).flat()).not.toContain("http:");
    expect(policy["script-src"]).not.toContain("'unsafe-eval'");
  });
  it("limits unsafe-eval to development in both policies", () => {
    expect(invitationLandingPolicy(false)).not.toContain("unsafe-eval");
    expect(clerkPagePolicy({ development: true })).toContain("unsafe-eval");
  });
  it.each(["invalid", publicKey("evil.example; script-src *"), publicKey("evil.example/path"), publicKey("evil.example:443")])("rejects malformed public configuration", key => {
    expect(() => clerkPagePolicy({ publishableKey: key, development: false })).toThrow();
  });
  it("never derives sources from untrusted request headers", async () => {
    const response = await unstable_getResponseFromNextConfig({ url: "https://app.example/sign-in", nextConfig, headers: { host: "attacker.example", "x-forwarded-host": "attacker.example" } });
    expect(response.headers.get("Content-Security-Policy")).not.toContain("attacker");
  });
});
