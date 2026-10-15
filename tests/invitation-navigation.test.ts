import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
const mocks = vi.hoisted(() => ({ effect: vi.fn(), prepare: vi.fn(), message: vi.fn() }));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), useEffect: mocks.effect, useRef: () => ({ current: false }), useState: () => ["Opening invitation…", mocks.message] }));
vi.mock("@/app/join/actions", () => ({ prepareInvitation: mocks.prepare }));
import { InvitationLanding } from "@/components/team/invitation-landing";
const token = "synthetic-test-token";
let historyReplace: ReturnType<typeof vi.fn>, documentReplace: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  historyReplace = vi.fn(); documentReplace = vi.fn();
  vi.stubGlobal("window", { location: { hash: `#${token}`, replace: documentReplace }, history: { replaceState: historyReplace } });
});
afterEach(() => vi.unstubAllGlobals());

describe("invitation policy-boundary navigation (mocked browser APIs)", () => {
  it("strips the fragment, waits for the secure session, then replaces the document", async () => {
    let finish!: (result: { success: string }) => void;
    mocks.prepare.mockImplementation(() => {
      expect(historyReplace).toHaveBeenCalledWith(null, "", "/join");
      return new Promise(resolve => { finish = resolve; });
    });
    InvitationLanding(); const effect = mocks.effect.mock.calls[0][0]; effect();
    expect(mocks.prepare).toHaveBeenCalledWith(token);
    expect(documentReplace).not.toHaveBeenCalled();
    finish({ success: "Ready" }); await Promise.resolve();
    expect(documentReplace).toHaveBeenCalledExactlyOnceWith("/join/accept");
    expect(JSON.stringify(documentReplace.mock.calls)).not.toContain(token);
    effect(); expect(mocks.prepare).toHaveBeenCalledTimes(1);
  });
  it.each(["error", "rejected"])("does not cross policies when session setup %s", async kind => {
    if (kind === "error") mocks.prepare.mockResolvedValue({ error: "Unavailable" });
    else mocks.prepare.mockRejectedValue(new Error("Unavailable"));
    InvitationLanding(); mocks.effect.mock.calls[0][0]();
    await Promise.resolve(); await Promise.resolve();
    expect(historyReplace).toHaveBeenCalledWith(null, "", "/join");
    expect(documentReplace).not.toHaveBeenCalled(); expect(mocks.message).toHaveBeenCalled();
  });
  it("keeps landing free of Clerk and uses a non-prefetched document exit", () => {
    const layout = readFileSync("src/app/join/layout.tsx", "utf8");
    const landing = readFileSync("src/components/team/invitation-landing.tsx", "utf8");
    expect(layout).not.toContain('from "next/link"');
    expect(layout).toContain('href="/" referrerPolicy="no-referrer"');
    for (const source of [layout, landing]) expect(source).not.toMatch(/import.*(@clerk|auth-provider)|router\.(push|replace)\(/);
  });
});
