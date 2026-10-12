import { createElement, type FunctionComponent, type PropsWithChildren } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ pathname: "/app/org/verified", membership: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/lib/organizations", () => ({ requireOrganizationMembership: mocks.membership }));
vi.mock("@clerk/nextjs", () => ({ UserButton: () => createElement("button", {}, "Account") }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => createElement("button", {}, "Theme") }));
import { OrganizationShell } from "@/components/organization-shell";
import { AccountFrame } from "@/components/account-frame";
import OrganizationLayout from "@/app/app/org/[organizationId]/layout";

const organization = { id: "verified", name: "Saraswati School", type: "SCHOOL" as const };
function render() {
  return renderToStaticMarkup(createElement(AccountFrame as FunctionComponent<PropsWithChildren>, {}, createElement(OrganizationShell as FunctionComponent<PropsWithChildren<{ organization: typeof organization }>>, { organization }, "Content")));
}
beforeEach(() => {
  mocks.pathname = "/app/org/verified";
  mocks.membership.mockReset().mockResolvedValue({ organization, role: "STAFF" });
});
describe("organization shell (static rendering with mocked navigation and membership)", () => {
  it.each([
    ["", "Workspace"],
    ["/students", "Students"],
    ["/students/new", "Students"],
    ["/students/student-1/edit", "Students"],
    ["/groups", "Classes"],
    ["/groups/new", "Classes"],
    ["/groups/g1/edit", "Classes"],
  ])("marks the correct link on %s for both navigation surfaces", (suffix, label) => {
    mocks.pathname += suffix;
    const html = render();
    const active = html.match(/<a[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/g) ?? [];
    expect(active).toHaveLength(2);
    active.forEach(link => expect(link).toContain(label));
    expect(html.match(/<header/g)).toHaveLength(1);
    expect(html.match(/<main/g)).toHaveLength(1);
    expect(html.match(/>Theme<\/button>/g)).toHaveLength(1);
    expect(html.match(/>Account<\/button>/g)).toHaveLength(1);
  });
  it("does not activate similarly prefixed routes", () => {
    mocks.pathname += "/students-archive";
    expect(render()).not.toContain('aria-current="page"');
  });
  it("uses verified destinations, shows organization identity, and has safe-area padding", () => {
    const html = render();
    expect(html).toContain('href="/app/org/verified"');
    expect(html).toContain('href="/app/org/verified/students"');
    expect(html).toContain('href="/app"');
    expect(html).toContain("Switch organization");
    expect(html).toContain("Saraswati School");
    expect(html).toContain('aria-label="Mobile organization navigation"');
    expect(html).toContain('aria-label="Organization navigation"');
    expect(html).toContain("pb-[calc(6rem+env(safe-area-inset-bottom))]");
    expect(html).toContain("pb-[max(0.5rem,env(safe-area-inset-bottom))]");
    expect(html).not.toContain("/fees");
    expect(html).not.toContain("/attendance");
  });
  it("supports switching to another verified coaching organization", () => {
    mocks.pathname = "/app/org/coaching/students";
    const html = renderToStaticMarkup(createElement(OrganizationShell as FunctionComponent<PropsWithChildren<{ organization: { id: string; name: string; type: "SCHOOL" | "COACHING" } }>>, { organization: { id: "coaching", name: "Coaching Centre", type: "COACHING" } }, "Content"));
    expect(html).toContain('href="/app/org/coaching/students"');
    expect(html).not.toContain("/app/org/verified");
    expect(html).toContain(">Coaching</p>");
    expect(html).toContain("Batches");
    expect(html).toContain('href="/app/org/coaching/groups"');
  });
  it.each(["/app", "/app/new"])("retains the account header and wrapper for %s", path => {
    mocks.pathname = path;
    const html = renderToStaticMarkup(createElement(AccountFrame as FunctionComponent<PropsWithChildren>, {}, "Picker"));
    expect(html).toContain("Organizations");
    expect(html.match(/<header/g)).toHaveLength(1);
    expect(html).not.toContain("Mobile organization navigation");
  });
  it("checks membership before rendering and passes only verified organization details", async () => {
    const element = await OrganizationLayout({ params: Promise.resolve({ organizationId: "requested" }), children: "Content" });
    expect(mocks.membership).toHaveBeenCalledWith("requested");
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Saraswati School");
    expect(html).not.toContain("/app/org/requested");
    mocks.membership.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(OrganizationLayout({ params: Promise.resolve({ organizationId: "other" }), children: "Content" })).rejects.toThrow("NOT_FOUND");
  });
});
