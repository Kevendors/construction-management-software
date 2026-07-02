import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  delta?: { value: string; positive: boolean };
  hint?: string;
  accent?: "primary" | "accent" | "success" | "destructive" | "info";
  onClick?: () => void;
}

const accentMap: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/15 text-amber-700 dark:text-amber-400",
  success: "bg-success/15 text-success",
  destructive: "bg-destructive/15 text-destructive",
  info: "bg-chart-3/15 text-chart-3",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  hint,
  accent = "primary",
  onClick,
}: StatCardProps) {
  return (
    <Card className={cn("p-5", onClick && "cursor-pointer transition-shadow hover:shadow-md")} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
        </div>
        {Icon && (
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", accentMap[accent])}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      {(delta || hint) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                delta.positive ? "text-success" : "text-destructive"
              )}
            >
              {delta.positive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {delta.value}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </Card>
  );
}
