import { ReactNode } from "react";

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  const cleanEyebrow = eyebrow?.trim();
  const cleanDescription = description?.trim();

  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {cleanEyebrow ? <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-primary" title={cleanEyebrow}>{cleanEyebrow}</p> : null}
        <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-normal md:text-4xl">{title}</h1>
        {cleanDescription ? <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{cleanDescription}</p> : null}
      </div>
      {action ? <div className="min-w-0 shrink-0 lg:max-w-[18rem]">{action}</div> : null}
    </div>
  );
}
