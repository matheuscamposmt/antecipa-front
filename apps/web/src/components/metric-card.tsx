import type { ComponentType } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MetricCard({
  icon: Icon,
  label,
  value,
  cardClassName,
  iconClassName,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  cardClassName?: string;
  iconClassName?: string;
}) {
  return (
    <Card className={cardClassName ?? "border-primary/10"}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={iconClassName ?? "size-4 text-primary/80"} />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
