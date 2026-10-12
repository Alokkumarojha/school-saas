import { z } from "zod";
import { feeChargeSchema, validDateOnly, kolkataToday } from "./fee-validation";
export function paymentSchema(today = kolkataToday()) {
  return z.object({
    amount: feeChargeSchema.shape.amount,
    paymentDate: z.string().refine(value => validDateOnly(value) && value <= today, "Enter a valid payment date no later than today in Asia/Kolkata."),
    method: z.enum(["CASH", "UPI", "BANK_TRANSFER"], { error: "Choose a payment method." }),
    reference: z.string().trim().max(100, "Use at most 100 characters for the reference."),
    note: z.string().trim().max(500, "Use at most 500 characters for the note."),
    submissionKey: feeChargeSchema.shape.submissionKey,
  });
}
export function feeBalance(charged: number, paid: string | bigint) {
  const total = BigInt(paid);
  const remaining = BigInt(charged) - total;
  if (total < BigInt(0) || remaining < BigInt(0) || total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Invalid fee balance.");
  return { paidPaise: Number(total), remainingPaise: Number(remaining), paymentStatus: total === BigInt(0) ? "Unpaid" : remaining === BigInt(0) ? "Paid" : "Partially paid" };
}
export const paymentMethodLabel = { CASH: "Cash", UPI: "UPI (manually recorded)", BANK_TRANSFER: "Bank transfer (manually recorded)" };
