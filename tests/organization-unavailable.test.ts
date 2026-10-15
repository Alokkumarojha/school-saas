import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), membership: vi.fn(), shell: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ membership: { findUnique: mocks.membership } }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/components/organization-shell", () => ({ OrganizationShell: mocks.shell }));

import OrganizationLayout from "@/app/app/org/[organizationId]/layout";
import OrganizationNotFound from "@/app/app/not-found";
import OrganizationError from "@/app/app/error";
import { ThemeProvider } from "@/components/theme-provider";

const organizationId = "cmg00000000000000000000001";
const organization = { id: organizationId, name: "Private school", type: "SCHOOL", slug: "private-school" };
const renderLayout = () => OrganizationLayout({ params: Promise.resolve({ organizationId }), children: "Private workspace records" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "removed-user", redirectToSignIn: () => { throw new Error("SIGN_IN"); } });
  mocks.membership.mockResolvedValue({ organization, role: "STAFF" });
  mocks.shell.mockImplementation(({ children }) => createElement("main", null, children));
});

describe("organization unavailable path (mocked identity/database, real layout and fallback)", () => {
  it("rechecks membership on refresh and denies the removed member before constructing the shell", async () => {
    expect(renderToStaticMarkup(await renderLayout())).toContain("Private workspace records");
    mocks.shell.mockClear();
    mocks.membership.mockResolvedValue(null);
    await expect(renderLayout()).rejects.toThrow("NOT_FOUND");
    expect(mocks.auth).toHaveBeenCalledTimes(2);
    expect(mocks.membership).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { organizationId_clerkUserId: { organizationId, clerkUserId: "removed-user" } },
    }));
    expect(mocks.shell).not.toHaveBeenCalled();
    const fallback = renderToStaticMarkup(createElement(OrganizationNotFound));
    expect(fallback).toContain("Workspace unavailable");
    expect(fallback).toContain('href="/app"');
    expect(fallback).not.toMatch(/Private school|Private workspace records|<script|data-clerk/);
  });
  it("continues to require authentication before the membership query", async () => {
    mocks.auth.mockResolvedValue({ userId: null, redirectToSignIn: () => { throw new Error("SIGN_IN"); } });
    await expect(renderLayout()).rejects.toThrow("SIGN_IN");
    expect(mocks.membership).not.toHaveBeenCalled();
  });
  it("keeps the application error fallback script-free and generic", () => {
    const reset = vi.fn();
    const fallback = renderToStaticMarkup(createElement(OrganizationError, { reset }));
    expect(fallback).toContain("Workspace temporarily unavailable");
    expect(fallback).toContain("Try again");
    expect(fallback).not.toMatch(/<script|data-clerk/);
    expect(reset).not.toHaveBeenCalled();
  });
  it("identifies the real theme bootstrap as a separate provider script, not fallback markup", () => {
    // SSR evidence only. This does not reproduce React's client warning or
    // establish which script caused the user's missing-membership refresh.
    const html = renderToStaticMarkup(createElement(ThemeProvider, null, createElement(OrganizationNotFound)));
    expect(html).toContain("Workspace unavailable");
    expect(html.match(/<script\b/g)).toHaveLength(1);
    expect(html).toContain("localStorage");
    expect(html).not.toContain("data-clerk-js-script");
  });
});

// Exercise the actual emitted bootstrap, without replacing next-themes or
// claiming this isolated DOM model reproduces client hydration/remounting.
describe("initial theme bootstrap on the unavailable page", () => {
  it.each([
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["system", true, "dark"],
    [null, false, "light"],
    [null, true, "dark"],
  ])("resolves stored %s with system dark=%s before hydration", async (stored, dark, expected) => {
    const { runInNewContext } = await import("node:vm");
    const html = renderToStaticMarkup(createElement(ThemeProvider, null, createElement(OrganizationNotFound)));
    const script = /<script\b[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
    expect(script).toBeTruthy();
    const classes = new Set(["unrelated", expected === "light" ? "dark" : "light"]);
    const root = {
      classList: {
        remove: (...values: string[]) => values.forEach((value) => classes.delete(value)),
        add: (value: string) => classes.add(value),
      },
      style: { colorScheme: "" },
    };
    const getItem = vi.fn(() => stored);
    runInNewContext(script!, {
      document: { documentElement: root },
      localStorage: { getItem },
      window: { matchMedia: () => ({ matches: dark }) },
    }, { timeout: 1000 });
    expect(getItem).toHaveBeenCalledWith("theme");
    expect([...classes].sort()).toEqual([expected, "unrelated"].sort());
    expect(root.style.colorScheme).toBe(expected);
  });
});
