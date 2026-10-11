import { SearchX } from "lucide-react";
export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <SearchX className="mx-auto mb-4 size-8 text-muted-foreground" />
      <h2 className="font-semibold">No records found</h2>
      <p className="mb-5 mt-2 text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
