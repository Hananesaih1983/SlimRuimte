/** Dashed placeholder card used wherever a dashboard list has nothing to show. */
export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <span aria-hidden className="text-4xl">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      </div>
      {children}
    </div>
  );
}
