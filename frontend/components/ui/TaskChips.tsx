import {
  categoryLabelClass,
  formatCategoryLabel,
  statusContainerClass,
  statusDotClass,
} from "@/lib/task-styles";

export function CategoryPill({ category }: { category: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${categoryLabelClass(category)}`}
    >
      {formatCategoryLabel(category)}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${statusContainerClass(status)}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass(status)}`} aria-hidden />
      {label}
    </span>
  );
}
