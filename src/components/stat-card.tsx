import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="size-5 shrink-0 text-primary" />
      </div>
      <p className="number mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </Card>
  );
}
