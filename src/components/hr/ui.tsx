import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { titleCase } from "@/lib/hr";
import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  approved: "bg-success/12 text-success border-success/25",
  hired: "bg-success/12 text-success border-success/25",
  active: "bg-success/12 text-success border-success/25",
  present: "bg-success/12 text-success border-success/25",
  paid: "bg-success/12 text-success border-success/25",
  completed: "bg-success/12 text-success border-success/25",
  open: "bg-primary/10 text-primary border-primary/25",
  in_progress: "bg-primary/10 text-primary border-primary/25",
  interview: "bg-primary/10 text-primary border-primary/25",
  pending: "bg-warning/15 text-warning-foreground border-warning/40",
  draft: "bg-muted text-muted-foreground border-border",
  screening: "bg-warning/15 text-warning-foreground border-warning/40",
  late: "bg-warning/15 text-warning-foreground border-warning/40",
  rejected: "bg-destructive/10 text-destructive border-destructive/25",
  closed: "bg-destructive/10 text-destructive border-destructive/25",
  absent: "bg-destructive/10 text-destructive border-destructive/25",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = (status ?? "").toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONES[key] ?? "bg-secondary text-secondary-foreground border-border",
      )}
    >
      {titleCase(status)}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string | undefined;
  icon?: ReactNode;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <div className="flex size-10 items-center justify-center rounded-md bg-accent text-primary">
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string | undefined }) {
  return (
    <div className="rounded-lg border border-dashed py-14 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export { Badge };
