import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Prisma } from "@/generated/prisma/client";
const mocks = vi.hoisted(() => ({ membership: vi.fn(), user: vi.fn(), transaction: vi.fn(), raw: vi.fn(), listRaw: vi.fn(), history: vi.fn(), count: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/organizations", () => ({ requireOrganizationMembership: mocks.membership }));
vi.mock("@/lib/auth", () => ({ requireUserId: mocks.user }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ $transaction: mocks.transaction, $queryRaw: mocks.listRaw, student: { findFirst: async () => ({ id: "cmg00000000000000000000002", name: "Student", admissionNumber: "ST001" }) } }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { recordFeePayment } from "@/app/app/org/[organizationId]/fees/payment-actions";
import { getFeeChargeDetail } from "@/lib/fee-payments";
import { listFeeCharges } from "@/lib/fees";
import { feeBalance, paymentSchema } from "@/lib/fee-payment-validation";
import ChargePage from "@/app/app/org/[organizationId]/fees/[feeChargeId]/page";

const org = { id: "cmg00000000000000000000001", name: "School", type: "SCHOOL" };
const charge = { id: "charge-1", organizationId: org.id, amountPaise: 10000, title: "Tuition", dueDate: new Date("2020-01-01T00:00:00Z"), student: { name: "Aarav", admissionNumber: "ST001", status: "INACTIVE" } };
type Payment = { id: string; organizationId: string; feeChargeId: string; amountPaise: number; paymentDate: Date; method: string; reference: string | null; note: string | null; recordedByClerkUserId: string; submissionKey: string };
let records: Payment[];
let exists: boolean;
let gate: Promise<void>;
const key = "00000000-0000-4000-8000-000000000001";
function form(overrides: Record<string, string | undefined> = {}) {
  const result = new FormData();
  Object.entries({ amount: "40.01", paymentDate: "2020-01-01", method: "CASH", reference: "", note: "", submissionKey: key, role: "OWNER", organizationId: "forged", recordedByClerkUserId: "forged", ...overrides }).forEach(([k, value]) => { if (value !== undefined) result.set(k, value); });
  return result;
}
const submit = (data = form()) => recordFeePayment(org.id, charge.id, { error: null }, data);
beforeEach(() => {
  vi.resetAllMocks(); records = []; exists = true; gate = Promise.resolve();
  mocks.membership.mockResolvedValue({ organization: org, role: "ADMIN" });
  mocks.user.mockResolvedValue("user");
  mocks.count.mockImplementation(async () => records.length);
  mocks.history.mockImplementation(async ({ skip, take }) => records.slice(skip, skip + take));
  // Serial transaction MODEL only: not real PostgreSQL locking/concurrency.
  mocks.transaction.mockImplementation(async work => {
    const previous = gate;
    let release!: () => void;
    gate = new Promise<void>(resolve => { release = resolve; });
    await previous;
    let inserted: Payment | undefined;
    const tx = {
      $queryRaw: async (parts: TemplateStringsArray, ...values: string[]) => {
        const sql = parts.join("?");
        mocks.raw(sql, values);
        if (sql.includes('FROM "Organization"')) { expect(values).toEqual([org.id]); expect(sql).toContain("FOR UPDATE"); return [{ id: org.id }]; }
        if (sql.includes('FROM "FeeCharge"')) { expect(values).toEqual([charge.id, org.id]); expect(sql).toContain('AND "organizationId" = ? FOR UPDATE'); return exists ? [charge] : []; }
        expect(sql).toContain('FROM "FeePayment" WHERE "organizationId" = ? AND "feeChargeId" = ?');
        expect(values).toEqual([org.id, charge.id]);
        return [{ paid: records.reduce((sum, record) => sum + BigInt(record.amountPaise), BigInt(0)).toString() }];
      },
      feeCharge: { findFirst: async ({ where }: { where: { id: string; organizationId: string } }) => { expect(where).toEqual({ id: charge.id, organizationId: org.id }); return exists ? charge : null; } },
      feePayment: {
        findUnique: async ({ where }: { where: { organizationId_submissionKey: { organizationId: string; submissionKey: string } } }) => records.find(record => record.organizationId === where.organizationId_submissionKey.organizationId && record.submissionKey === where.organizationId_submissionKey.submissionKey) ?? null,
        create: async ({ data }: { data: Omit<Payment, "id"> }) => { inserted = { id: String(records.length), ...data }; return inserted; },
        count: mocks.count, findMany: mocks.history,
      },
    };
    try { const result = await work(tx); if (inserted) records.push(inserted); return result; }
    finally { release(); }
  });
});
describe("manual payments (mocked transactions)", () => {
  it.each(["OWNER", "ADMIN"])("records exact partial and full payments for %s even with an inactive student", async role => {
    mocks.membership.mockResolvedValue({ organization: org, role });
    await expect(submit()).rejects.toThrow("REDIRECT:");
    expect(records[0]).toMatchObject({ amountPaise: 4001, organizationId: org.id, feeChargeId: charge.id, recordedByClerkUserId: "user" });
    expect(feeBalance(10000, "4001")).toEqual({ paidPaise: 4001, remainingPaise: 5999, paymentStatus: "Partially paid" });
    await expect(submit(form({ amount: "59.99", submissionKey: "00000000-0000-4000-8000-000000000002", method: "UPI" }))).rejects.toThrow("REDIRECT:");
    expect(feeBalance(10000, "10000").paymentStatus).toBe("Paid");
    expect(records).toHaveLength(2);
    expect(mocks.revalidate).toHaveBeenCalledWith(`/app/org/${org.id}/fees`);
    expect(mocks.revalidate).toHaveBeenCalledWith(`/app/org/${org.id}/fees/${charge.id}`);
  });
  it("rejects overpayment without inserting", async () => {
    expect((await submit(form({ amount: "100.01" }))).error).toContain("exceeds");
    expect(records).toHaveLength(0);
  });
  it("replays a full payment before checking the now-zero balance", async () => {
    await expect(submit(form({ amount: "100" }))).rejects.toThrow("REDIRECT:");
    mocks.raw.mockClear();
    await expect(submit(form({ amount: "100.00" }))).rejects.toThrow("REDIRECT:");
    expect(records).toHaveLength(1);
    expect(mocks.raw.mock.calls.some(([sql]) => sql.includes("SUM"))).toBe(false);
  });
  it.each([{ amount: "40.02" }, { method: "UPI" }, { paymentDate: "2020-01-02" }, { reference: "changed" }, { note: "changed" }])("rejects replay mismatch %j", async override => {
    await expect(submit()).rejects.toThrow("REDIRECT:");
    expect((await submit(form(override))).error).toContain("different details");
    expect(records).toHaveLength(1);
  });
  it("rejects same key previously used for another charge or recorder", async () => {
    await expect(submit()).rejects.toThrow("REDIRECT:");
    records[0].feeChargeId = "other";
    expect((await submit()).error).toContain("different details");
    records[0].feeChargeId = charge.id; records[0].recordedByClerkUserId = "other-user";
    expect((await submit()).error).toContain("different details");
  });
  it("models two concurrent payments that would overpay, allowing only one", async () => {
    const results = await Promise.allSettled([submit(form({ amount: "70" })), submit(form({ amount: "70", submissionKey: "00000000-0000-4000-8000-000000000002" }))]);
    expect(records).toHaveLength(1);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find(result => result.status === "fulfilled")).toMatchObject({ value: { error: expect.stringContaining("exceeds") } });
  });
  it("models concurrent same-key replays with one insert", async () => {
    await Promise.allSettled([submit(), submit()]);
    expect(records).toHaveLength(1);
  });
  it.each(["STAFF", "revoked"])("rejects an already-open form after %s", async role => {
    await getFeeChargeDetail(org.id, charge.id);
    mocks.transaction.mockClear();
    if (role === "STAFF") mocks.membership.mockResolvedValue({ organization: org, role });
    else mocks.membership.mockRejectedValue(new Error("NOT_FOUND"));
    if (role === "STAFF") expect((await submit()).error).toContain("Only owners");
    else await expect(submit()).rejects.toThrow("NOT_FOUND");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("denies foreign charge detail and writes without exposing records", async () => {
    exists = false;
    await expect(getFeeChargeDetail(org.id, charge.id)).rejects.toThrow("NOT_FOUND");
    expect((await submit()).error).toBe("Charge unavailable in this organization.");
    expect(records).toHaveLength(0);
  });
  it("caps P2034 retries at three and does not retry unknown/unique failures", async () => {
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" }));
    await submit(); expect(mocks.transaction).toHaveBeenCalledTimes(3);
    mocks.transaction.mockReset().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" }));
    await submit(); expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
  it("validates dates, positive exact amounts, method and field limits", () => {
    const schema = paymentSchema("2026-10-12");
    const good = { amount: "0.01", paymentDate: "2026-10-12", method: "BANK_TRANSFER", reference: "", note: "", submissionKey: key };
    expect(schema.parse(good).amount).toBe(1);
    for (const override of [{ paymentDate: "2026-10-13" }, { paymentDate: "2026-02-30" }, { amount: "0" }, { amount: "1.001" }, { method: "GATEWAY" }, { reference: "x".repeat(101) }, { note: "x".repeat(501) }]) expect(schema.safeParse({ ...good, ...override }).success).toBe(false);
    expect(feeBalance(10000, "0").paymentStatus).toBe("Unpaid");
    expect(() => feeBalance(10000, "99999999999999999999")).toThrow("Invalid");
  });
  it("scopes paginated history and renders view-only controls for STAFF", async () => {
    await expect(submit()).rejects.toThrow("REDIRECT:");
    mocks.membership.mockResolvedValue({ organization: org, role: "STAFF" });
    mocks.count.mockResolvedValue(21);
    const detail = await getFeeChargeDetail(org.id, charge.id, "99");
    expect(detail.page).toBe(2);
    expect(mocks.history).toHaveBeenLastCalledWith(expect.objectContaining({ where: { organizationId: org.id, feeChargeId: charge.id }, skip: 20, take: 20 }));
    const html = renderToStaticMarkup(await ChargePage({ params: Promise.resolve({ organizationId: org.id, feeChargeId: charge.id }), searchParams: Promise.resolve({ page: "2", due: "overdue" }) }));
    expect(html).not.toContain('name="amount"');
    expect(html).toContain("not gateway-verified");
    expect(html).toContain("Partially paid");
    expect(html).toContain("due=overdue&amp;page=2");
  });
});
describe("balance-aware list SQL contract (not database execution)", () => {
  it.each(["all", "overdue", "upcoming"])("filters %s before pagination with matching scoped count SQL", async due => {
    mocks.listRaw.mockResolvedValueOnce([{ total: "21" }]).mockResolvedValueOnce([{ id: charge.id, title: charge.title, amountPaise: 10000, dueDate: charge.dueDate, studentName: "Aarav", admissionNumber: "ST001", paid: due === "all" ? "10000" : "4001" }]);
    const result = await listFeeCharges(org.id, { page: "2", due }, new Date("2026-10-11T18:30:00Z"));
    const count = mocks.listRaw.mock.calls[0][0];
    const rows = mocks.listRaw.mock.calls[1][0];
    expect(count.text).toContain('WHERE "organizationId" =');
    expect(count.text).toContain('p."organizationId" = c."organizationId"');
    expect(rows.text).toContain(count.text.slice(0, count.text.indexOf("SELECT COUNT")).trimEnd());
    expect(count.values.filter((value: unknown) => value === org.id)).toHaveLength(2);
    expect(rows.text).toContain('ORDER BY c."createdAt" DESC, c.id DESC LIMIT 20 OFFSET');
    expect(rows.values.at(-1)).toBe(20);
    if (due === "all") { expect(count.text).not.toContain('paid < "amountPaise"'); expect(result.charges[0].paymentStatus).toBe("Paid"); }
    else { expect(count.text).toContain('paid < "amountPaise"'); expect(count.values).toContainEqual(new Date("2026-10-12T00:00:00Z")); expect(result.charges[0].remainingPaise).toBe(5999); }
    expect(mocks.listRaw).toHaveBeenCalledTimes(2);
  });
});
