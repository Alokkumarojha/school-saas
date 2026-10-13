import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), membership: vi.fn(), transaction: vi.fn(), students: vi.fn(), groups: vi.fn(), attendance: vi.fn(), raw: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ membership: { findUnique: mocks.membership }, $transaction: mocks.transaction }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import { Prisma } from "@/generated/prisma/client";
import { getOrganizationDashboard } from "@/lib/organization-dashboard";
import { formatAggregateINR } from "@/lib/dashboard-format";
import { feeBalance } from "@/lib/fee-payment-validation";
import OrganizationPage from "@/app/app/org/[organizationId]/page";
const org = "cmg00000000000000000000001", foreign = "cmg00000000000000000000002";
const organization = { id: org, name: "Saraswati School", type: "SCHOOL", slug: "saraswati" };
const now = new Date("2026-10-12T18:30:00Z");
type Person = { organizationId: string; status: string };
type Charge = { id: string; organizationId: string; amount: number; due: string; studentStatus?: string };
type Payment = { chargeId: string; organizationId: string; amount: number };
type Mark = { organizationId: string; status: "PRESENT" | "ABSENT" | "LATE"; date: string; currentStatus?: string; currentGroup?: string };
let students: Person[], groups: Person[], charges: Charge[], payments: Payment[], marks: Mark[];
const tx = { student: { count: mocks.students }, group: { count: mocks.groups }, attendance: { groupBy: mocks.attendance }, $queryRaw: mocks.raw };
const data = () => getOrganizationDashboard(org, now);
async function html() { return renderToStaticMarkup(await OrganizationPage({ params: Promise.resolve({ organizationId: org }) })); }
beforeEach(() => {
  vi.resetAllMocks(); students = []; groups = []; charges = []; payments = []; marks = [];
  mocks.auth.mockResolvedValue({ userId: "user-1" });
  mocks.membership.mockResolvedValue({ organization, role: "ADMIN" });
  mocks.transaction.mockImplementation(async work => work(tx));
  mocks.students.mockImplementation(async ({ where }) => students.filter(row => row.organizationId === where.organizationId && row.status === where.status).length);
  mocks.groups.mockImplementation(async ({ where }) => groups.filter(row => row.organizationId === where.organizationId && row.status === where.status).length);
  mocks.attendance.mockImplementation(async ({ where }) => {
    expect(Object.keys(where).sort()).toEqual(["date", "organizationId"]);
    const filtered = marks.filter(row => row.organizationId === where.organizationId && row.date === where.date.toISOString().slice(0, 10));
    return (["PRESENT", "ABSENT", "LATE"] as const).map(status => ({ status, _count: { _all: filtered.filter(row => row.status === status).length } }));
  });
  // Fixture model and SQL-contract assertions, NOT a SQL engine or PostgreSQL test.
  mocks.raw.mockImplementation(async (parts: TemplateStringsArray, paymentOrg: string, chargeOrg: string, day: Date) => {
    expect(paymentOrg).toBe(chargeOrg);
    const sql = parts.join("?");
    expect(sql).toContain('FROM "FeePayment" WHERE "organizationId" = ?');
    expect(sql).toContain('WHERE c."organizationId" = ?');
    expect(sql).toContain('GROUP BY "organizationId", "feeChargeId"');
    expect(sql).toContain('p."organizationId" = c."organizationId" AND p."feeChargeId" = c.id');
    expect(sql).toContain('"dueDate" < ?::date AND remaining > 0');
    expect(sql).not.toContain('"Student"');
    let charged = BigInt(0), collected = BigInt(0), outstanding = BigInt(0), overdue = BigInt(0);
    for (const charge of charges.filter(row => row.organizationId === chargeOrg)) {
      const paid = payments.filter(row => row.organizationId === paymentOrg && row.chargeId === charge.id).reduce((sum, row) => sum + BigInt(row.amount), BigInt(0));
      const remaining = BigInt(feeBalance(charge.amount, paid).remainingPaise);
      charged += BigInt(charge.amount); collected += paid; outstanding += remaining;
      if (charge.due < day.toISOString().slice(0, 10) && remaining > BigInt(0)) overdue += remaining;
    }
    return [{ charged: String(charged), collected: String(collected), outstanding: String(outstanding), overdue: String(overdue), invalid: false }];
  });
});
describe("organization dashboard aggregates (mocked database)", () => {
  it("requires membership before any aggregate; denies non-members", async () => {
    mocks.membership.mockResolvedValue(null);
    await expect(data()).rejects.toThrow("NOT_FOUND");
    expect(mocks.membership).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId_clerkUserId: { organizationId: org, clerkUserId: "user-1" } } }));
    expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.raw).not.toHaveBeenCalled();
  });
  it("uses the verified organization, four aggregate calls, and one consistent snapshot", async () => {
    await getOrganizationDashboard(foreign, now);
    expect(mocks.students).toHaveBeenCalledWith({ where: { organizationId: org, status: "ACTIVE" } });
    expect(mocks.groups).toHaveBeenCalledWith({ where: { organizationId: org, status: "ACTIVE" } });
    expect(mocks.attendance).toHaveBeenCalledWith({ by: ["status"], where: { organizationId: org, date: new Date("2026-10-13T00:00:00Z") }, _count: { _all: true } });
    expect(mocks.raw.mock.calls[0].slice(1, 3)).toEqual([org, org]);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    for (const query of [mocks.students, mocks.groups, mocks.attendance, mocks.raw]) expect(query).toHaveBeenCalledTimes(1);
    await data(); expect(mocks.membership).toHaveBeenCalledTimes(2); expect(mocks.raw).toHaveBeenCalledTimes(2);
  });
  it("returns zeros and helpful empty states without invented data", async () => {
    expect(await data()).toMatchObject({ activeStudents: 0, activeGroups: 0, fees: { charged: BigInt(0), collected: BigInt(0), outstanding: BigInt(0), overdue: BigInt(0) }, attendance: { PRESENT: 0, ABSENT: 0, LATE: 0 } });
    const content = await html();
    for (const text of ["No active students yet", "No active classes yet", "No fee charges yet", "No attendance recorded today", "₹0.00"]) expect(content).toContain(text);
    expect(content).not.toContain("sample dashboard"); expect(content).not.toContain("Unmarked");
  });
  it("counts only active students/groups and excludes other organizations", async () => {
    students = [{ organizationId: org, status: "ACTIVE" }, { organizationId: org, status: "ACTIVE" }, { organizationId: org, status: "INACTIVE" }, { organizationId: foreign, status: "ACTIVE" }];
    groups = [{ organizationId: org, status: "ACTIVE" }, { organizationId: org, status: "INACTIVE" }, { organizationId: foreign, status: "ACTIVE" }];
    expect(await data()).toMatchObject({ activeStudents: 2, activeGroups: 1 });
  });
  it("combines partial/full payments once per charge, including inactive students and unpaid overdue charges", async () => {
    charges = [
      { id: "partial", organizationId: org, amount: 10000, due: "2026-10-12", studentStatus: "INACTIVE" },
      { id: "full", organizationId: org, amount: 20000, due: "2026-10-11" },
      { id: "unpaid", organizationId: org, amount: 5000, due: "2026-10-10" },
      { id: "today", organizationId: org, amount: 4000, due: "2026-10-13" },
      { id: "future", organizationId: org, amount: 3000, due: "2026-10-14" },
      { id: "other", organizationId: foreign, amount: 999999, due: "2026-01-01" },
    ];
    payments = [
      { chargeId: "partial", organizationId: org, amount: 2001 }, { chargeId: "partial", organizationId: org, amount: 1000 },
      { chargeId: "full", organizationId: org, amount: 7000 }, { chargeId: "full", organizationId: org, amount: 13000 },
      { chargeId: "other", organizationId: foreign, amount: 999999 },
    ];
    expect((await data()).fees).toEqual({ charged: BigInt(42000), collected: BigInt(23001), outstanding: BigInt(18999), overdue: BigInt(11999) });
    const content = await html();
    expect(content).toContain("Fees · All-time"); expect(content).toContain("manually recorded payments"); expect(content).toContain("manual UPI and bank transfer");
  });
  it("moves today-due balances to overdue only across Kolkata midnight", async () => {
    charges = [{ id: "c", organizationId: org, amount: 100, due: "2026-10-12" }];
    expect((await getOrganizationDashboard(org, new Date("2026-10-12T18:29:59Z"))).fees.overdue).toBe(BigInt(0));
    expect((await getOrganizationDashboard(org, new Date("2026-10-12T18:30:00Z"))).fees.overdue).toBe(BigInt(100));
  });
  it("reads today's saved attendance regardless of current assignment/status, excludes other days/tenants", async () => {
    marks = [
      { organizationId: org, date: "2026-10-13", status: "PRESENT", currentStatus: "INACTIVE", currentGroup: "transferred" },
      { organizationId: org, date: "2026-10-13", status: "ABSENT" }, { organizationId: org, date: "2026-10-13", status: "LATE" },
      { organizationId: org, date: "2026-10-12", status: "LATE" }, { organizationId: foreign, date: "2026-10-13", status: "PRESENT" },
    ];
    expect(await data()).toMatchObject({ activeStudents: 0, attendance: { PRESENT: 1, ABSENT: 1, LATE: 1 } });
    expect((await getOrganizationDashboard(org, new Date("2026-10-12T18:29:59Z"))).attendance).toEqual({ PRESENT: 0, ABSENT: 0, LATE: 1 });
  });
  it("preserves aggregate paise above database INTEGER and JS safe integers", async () => {
    mocks.raw.mockResolvedValue([{ charged: "900719925474099399", collected: "900719925474099301", outstanding: "98", overdue: "98", invalid: false }]);
    const result = await data();
    expect(result.fees.charged).toBe(BigInt("900719925474099399"));
    expect(result.fees.charged - result.fees.collected).toBe(BigInt(98));
    expect(formatAggregateINR(result.fees.charged)).toBe("₹9,00,71,99,25,47,40,993.99");
    expect(formatAggregateINR(BigInt("4294967294"))).toBe("₹4,29,49,672.94");
    expect(formatAggregateINR(BigInt(1))).toBe("₹0.01");
    const content = await html(); expect(content).toContain("₹9,00,71,99,25,47,40,993.99"); expect(content).toContain("[overflow-wrap:anywhere]");
  });
  it("fails on invalid per-charge balances rather than concealing overpayments", async () => {
    mocks.raw.mockResolvedValue([{ charged: "100", collected: "101", outstanding: "-1", overdue: "0", invalid: true }]);
    await expect(data()).rejects.toThrow("Invalid fee balance");
  });
});
describe("dashboard static rendering, not browser verification", () => {
  it.each(["OWNER", "ADMIN"])("shows existing create actions for %s", async role => {
    mocks.membership.mockResolvedValue({ organization, role });
    const content = await html();
    for (const path of ["students/new", "groups/new", "fees/new"]) expect(content).toContain(`href="/app/org/${org}/${path}"`);
    expect(content).toContain("Record attendance");
  });
  it("gives STAFF only verified view links and correct coaching terminology", async () => {
    mocks.membership.mockResolvedValue({ organization: { ...organization, type: "COACHING", name: "Long".repeat(100) }, role: "STAFF" });
    const content = await html();
    for (const path of ["students", "groups", "fees", "attendance"]) expect(content).toContain(`href="/app/org/${org}/${path}"`);
    expect(content).toContain("Active batches"); expect(content).toContain("View batches"); expect(content).toContain("View-only access");
    expect(content).not.toContain("/new"); expect(content).not.toContain("Record attendance</a>"); expect(content).not.toContain(foreign);
    expect(content).toContain("Today&#x27;s recorded attendance"); expect(content).not.toContain("Unmarked");
  });
});
