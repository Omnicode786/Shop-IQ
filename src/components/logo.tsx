import Link from "next/link";
import { PackageCheck } from "lucide-react";

export function Logo() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
        <PackageCheck className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold tracking-normal">ShopIQ</p>
        <p className="truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Retail inventory</p>
      </div>
    </Link>
  );
}
