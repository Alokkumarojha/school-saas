// Aggregate paise can exceed both a database INTEGER and JS's safe integer.
// Format the integer rupee quotient and paise remainder without floating point.
export function formatAggregateINR(paise: bigint) {
  if (paise < BigInt(0)) throw new Error("Invalid aggregate amount.");
  return `₹${(paise / BigInt(100)).toLocaleString("en-IN")}.${String(paise % BigInt(100)).padStart(2, "0")}`;
}
