import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    membership: { findMany: mocks.findMany, findUnique: mocks.findUnique },
    organization: { create: mocks.create },
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import {
  listMyOrganizations,
  requireOrganizationMembership,
} from "@/lib/organizations";
import { createOrganization } from "@/app/app/actions";
import { Prisma } from "@/generated/prisma/client";

const orgA = "cmg00000000000000000000001";
const orgB = "cmg00000000000000000000002";
function form(overrides: Record<string, string | undefined> = {}) {
  const data = new FormData();
  Object.entries({
    name: "Saraswati School",
    type: "SCHOOL",
    slug: "saraswati-kota",
    ...overrides,
  }).forEach(([key, value]) => data.set(key, value ?? ""));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({
    userId: "user_A",
    redirectToSignIn: () => {
      throw new Error("SIGN_IN");
    },
  });
});

describe("organization authorization", () => {
  it("requires authentication before any query or mutation", async () => {
    mocks.auth.mockResolvedValue({
      userId: null,
      redirectToSignIn: () => {
        throw new Error("SIGN_IN");
      },
    });
    await expect(listMyOrganizations()).rejects.toThrow("SIGN_IN");
    await expect(requireOrganizationMembership(orgA)).rejects.toThrow(
      "SIGN_IN",
    );
    await expect(createOrganization({}, form())).rejects.toThrow("SIGN_IN");
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("scopes the picker to the authenticated identity and supports no memberships", async () => {
    mocks.findMany.mockResolvedValue([]);
    await expect(listMyOrganizations()).resolves.toEqual([]);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clerkUserId: "user_A" } }),
    );
  });
  it("returns per-organization roles for the same user without a global role", async () => {
    mocks.findUnique.mockImplementation(({ where }) =>
      Promise.resolve({
        role:
          where.organizationId_clerkUserId.organizationId === orgA
            ? "OWNER"
            : "STAFF",
        organization: { id: where.organizationId_clerkUserId.organizationId },
      }),
    );
    expect((await requireOrganizationMembership(orgA)).role).toBe("OWNER");
    expect((await requireOrganizationMembership(orgB)).role).toBe("STAFF");
    expect(mocks.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          organizationId_clerkUserId: {
            organizationId: orgB,
            clerkUserId: "user_A",
          },
        },
      }),
    );
  });
  it("rejects guessed organization IDs and revoked memberships", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(requireOrganizationMembership(orgB)).rejects.toThrow(
      "NOT_FOUND",
    );
    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_clerkUserId: {
            organizationId: orgB,
            clerkUserId: "user_A",
          },
        },
      }),
    );
  });
  it("rejects malformed IDs before a database query", async () => {
    await expect(
      requireOrganizationMembership("../another-user"),
    ).rejects.toThrow("NOT_FOUND");
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
  it("does not reuse the first user's membership for the second user", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_B" });
    mocks.findUnique.mockResolvedValue(null);
    await expect(requireOrganizationMembership(orgA)).rejects.toThrow(
      "NOT_FOUND",
    );
    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_clerkUserId: {
            organizationId: orgA,
            clerkUserId: "user_B",
          },
        },
      }),
    );
  });
});

describe("organization creation", () => {
  it("atomically creates the owner from verified identity, ignoring forged fields", async () => {
    mocks.create.mockResolvedValue({ id: orgA });
    await expect(
      createOrganization(
        {},
        form({
          name: "  Saraswati School  ",
          slug: "SARASWATI-KOTA",
          clerkUserId: "user_B",
          role: "STAFF",
          organizationId: orgB,
        }),
      ),
    ).rejects.toThrow(`REDIRECT:/app/org/${orgA}`);
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        name: "Saraswati School",
        type: "SCHOOL",
        slug: "saraswati-kota",
        memberships: { create: { clerkUserId: "user_A", role: "OWNER" } },
      },
      select: { id: true },
    });
  });
  it.each([
    { type: "OTHER" },
    { name: " " },
    { slug: "../bad" },
    { slug: "a" },
    { name: "x".repeat(101) },
  ])("validates input before writes: %j", async (input) => {
    const result = await createOrganization({}, form(input));
    expect(result.fieldErrors).toBeDefined();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("handles concurrent slug conflicts without leaking database details", async () => {
    mocks.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("private database detail", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const result = await createOrganization({}, form());
    expect(result.fieldErrors?.slug).toEqual([
      "This slug is already in use. Choose another.",
    ]);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("does not expose unexpected database errors", async () => {
    mocks.create.mockRejectedValue(new Error("private connection details"));
    const result = await createOrganization({}, form());
    expect(result.error).toBe(
      "We could not create your organization. Please try again later.",
    );
  });
});
