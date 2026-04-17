import { Badge } from "@/components/ui/badge";
import { creativeStatusLabels, priorityBadgeClass, statusBadgeClass, taskPriorityLabels, taskStatusLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, kind = "task" }: { status: string; kind?: "task" | "creative" }) {
  const label = kind === "task" ? taskStatusLabels[status] ?? status : creativeStatusLabels[status] ?? status;
  return (
    <Badge variant="outline" className={cn("font-medium", statusBadgeClass(status))}>
      {label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", priorityBadgeClass(priority))}>
      {taskPriorityLabels[priority] ?? priority}
    </Badge>
  );
}
