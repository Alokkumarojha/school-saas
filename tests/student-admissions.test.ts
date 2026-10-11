import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => ({ $transaction: mocks.transaction }) }));
import { createStudentWithAdmissionNumber } from "@/lib/student-admissions";
import { Prisma } from "@/generated/prisma/client";

type Row = { organizationId: string; admissionNumber: string; status?: string };
const details = { name: "Aarav Sharma", guardianName: "Sanjay Sharma", guardianPhone: "" };
const counters = new Map<string, bigint>();
let rows: Row[];
let failInsert: boolean;
let locks: Map<string, Promise<void>>;

// Transaction/locking MODEL only. No PostgreSQL is connected: these tests cannot
// establish that PostgreSQL executes the SQL/locks correctly. They verify helper
// boundaries, formatting, retry policy and expected behavior against the model.
beforeEach(() => {
  vi.resetAllMocks(); counters.clear(); rows = []; failInsert = false; locks = new Map();
  mocks.transaction.mockImplementation(async (work: Parameters<PrismaClient["$transaction"]>[0]) => {
    let org: string | undefined;
    let allocated: bigint | undefined;
    let inserted: Row | undefined;
    let release: (() => void) | undefined;
    const tx = {
      $queryRaw: async (parts: TemplateStringsArray, ...values: string[]) => {
        const sql = parts.join("?");
        if (sql.includes("FOR UPDATE")) {
          org = values[0];
          expect(sql).toContain('FROM "Organization" WHERE "id" = ? FOR UPDATE');
          const previous = locks.get(org) ?? Promise.resolve();
          const gate = new Promise<void>(resolve => { release = resolve; });
          locks.set(org, previous.then(() => gate));
          await previous;
          return [{ id: org }];
        }
        expect(org).toBeDefined();
        expect(values).toEqual([org, org]);
        expect(sql).toContain('ON CONFLICT ("organizationId") DO UPDATE');
        expect(sql).toContain('"StudentAdmissionCounter"."lastNumber"');
        expect(sql).toContain("GREATEST");
        expect(sql).toContain("^ST[0-9]+$");
        expect(sql).not.toContain('"status"');
        const highestExisting = rows.filter(row => row.organizationId === org && /^ST[0-9]+$/.test(row.admissionNumber))
          .reduce((max, row) => { const n = BigInt(row.admissionNumber.slice(2)); return n > max ? n : max; }, BigInt(0));
        const previous = counters.get(org!) ?? BigInt(0);
        allocated = (highestExisting > previous ? highestExisting : previous) + BigInt(1);
        return [{ number: allocated.toString() }];
      },
      student: { create: async ({ data }: { data: Row }) => {
        expect(allocated).toBeDefined();
        expect(data.organizationId).toBe(org);
        if (failInsert) throw new Error("insert failed");
        inserted = data;
        return { id: "model-student", ...data };
      } },
    };
    try {
      const result = await (work as unknown as (client: typeof tx) => Promise<unknown>)(tx);
      counters.set(org!, allocated!);
      rows.push(inserted!);
      return result;
    } finally { release?.(); }
  });
});

describe("admission allocation (mocked transaction model, not PostgreSQL concurrency)", () => {
  it("uses independent organization sequences", async () => {
    await createStudentWithAdmissionNumber("A", details);
    await createStudentWithAdmissionNumber("A", details);
    await createStudentWithAdmissionNumber("B", details);
    expect(rows.map(row => [row.organizationId, row.admissionNumber])).toEqual([["A", "ST001"], ["A", "ST002"], ["B", "ST001"]]);
  });
  it("initializes beyond existing ST001/ST002, including an inactive record", async () => {
    rows = [{ organizationId: "A", admissionNumber: "ST001", status: "ACTIVE" }, { organizationId: "A", admissionNumber: "ST002", status: "INACTIVE" }];
    await createStudentWithAdmissionNumber("A", details);
    expect(rows.at(-1)?.admissionNumber).toBe("ST003");
    expect(rows[1].status).toBe("INACTIVE");
  });
  it("preserves custom legacy numbers and includes zero-padded standard numbers", async () => {
    rows = [{ organizationId: "A", admissionNumber: "LEGACY/2020" }, { organizationId: "A", admissionNumber: "ST-900" }, { organizationId: "A", admissionNumber: "ST0007" }];
    await createStudentWithAdmissionNumber("A", details);
    expect(rows.map(row => row.admissionNumber)).toEqual(["LEGACY/2020", "ST-900", "ST0007", "ST008"]);
  });
  it("continues beyond 999", async () => {
    counters.set("A", BigInt(999));
    await createStudentWithAdmissionNumber("A", details);
    await createStudentWithAdmissionNumber("A", details);
    expect(rows.map(row => row.admissionNumber)).toEqual(["ST1000", "ST1001"]);
  });
  it("retains the persisted high-water mark after a student is deleted", async () => {
    await createStudentWithAdmissionNumber("A", details);
    rows = []; // Models a future deletion; production code does not implement deletion.
    await createStudentWithAdmissionNumber("A", details);
    expect(rows[0].admissionNumber).toBe("ST002");
  });
  it("resynchronizes a counter behind existing standard numbers", async () => {
    counters.set("A", BigInt(1));
    rows = [{ organizationId: "A", admissionNumber: "ST010" }];
    await createStudentWithAdmissionNumber("A", details);
    expect(rows.at(-1)?.admissionNumber).toBe("ST011");
  });
  it("rolls back allocation with a failed student insert in the transaction model", async () => {
    failInsert = true;
    await expect(createStudentWithAdmissionNumber("A", details)).rejects.toThrow("insert failed");
    expect(counters.has("A")).toBe(false);
    expect(rows).toEqual([]);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    failInsert = false;
    await createStudentWithAdmissionNumber("A", details);
    expect(rows[0].admissionNumber).toBe("ST001");
  });
  it("models concurrent first-use calls with distinct numbers under the requested lock", async () => {
    await Promise.all(Array.from({ length: 10 }, () => createStudentWithAdmissionNumber("A", details)));
    expect(new Set(rows.map(row => row.admissionNumber)).size).toBe(10);
    expect(counters.get("A")).toBe(BigInt(10));
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 10000 });
  });
  it("retries P2034 at most three times", async () => {
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" }));
    await expect(createStudentWithAdmissionNumber("A", details)).rejects.toMatchObject({ code: "P2034" });
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
  });
  it("can succeed after a retryable conflict", async () => {
    mocks.transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" }));
    await createStudentWithAdmissionNumber("A", details);
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(rows[0].admissionNumber).toBe("ST001");
  });
  it.each(["P2002", "P2028", "P1001"])("does not retry %s", async code => {
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("failure", { code, clientVersion: "test" }));
    await expect(createStudentWithAdmissionNumber("A", details)).rejects.toMatchObject({ code });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
});


