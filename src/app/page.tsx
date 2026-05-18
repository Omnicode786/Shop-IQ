import Link from "next/link";
import { ArrowRight, BarChart3, Bot, PackageCheck, ReceiptText, Sparkles, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UiModeToggle } from "@/components/ui-mode-toggle";

export default function LandingPage() {
  const features = [
    [PackageCheck, "Inventory intelligence", "Track stock, reorder risk, product velocity, margins and category value in one place."],
    [ReceiptText, "Billing OS", "Create database-backed bills, customer dues, payments and receipt-ready workflows."],
    [Bot, "Agentic AI", "Ask business questions or let AI preview safe actions before writing to your database."],
    [BarChart3, "Executive reports", "Beautiful charts for sales, low stock, dues, supplier pressure and business health."]
  ];
  return <main className="min-h-screen"><header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5"><Logo/><div className="flex items-center gap-3"><UiModeToggle/><ThemeToggle/><Button asChild><Link href="/login">Login</Link></Button></div></header><section className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">AI shop operating system</p><h1 className="mt-5 text-5xl font-semibold tracking-tight md:text-7xl">Run your shop like a modern business command center.</h1><p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground">ShopIQ turns everyday shop operations into an intelligent inventory and sales workspace: stock, billing, customers, suppliers, dues, reports and AI decisions in one premium app.</p><div className="mt-8 flex flex-wrap gap-3"><Button size="lg" asChild><Link href="/signup">Create workspace <ArrowRight className="ml-2 h-4 w-4"/></Link></Button><Button size="lg" variant="outline" asChild><Link href="/login">Open demo</Link></Button></div></div><Card className="overflow-hidden"><CardContent className="p-6"><div className="grid gap-4 sm:grid-cols-2"><Metric label="Today sales" value="PKR 428K"/><Metric label="Inventory value" value="PKR 18.7M"/><Metric label="Low stock" value="23 SKUs"/><Metric label="Pending dues" value="PKR 1.2M"/></div><div className="mt-6 rounded-3xl border border-border/70 bg-muted/30 p-5"><div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-primary"/><p className="font-medium">AI summary</p></div><p className="mt-3 text-sm leading-7 text-muted-foreground">Reorder HP EliteBooks, printer toner and barcode scanners first. Collect overdue customer balances before increasing supplier purchases.</p></div></CardContent></Card></section><section className="mx-auto grid max-w-7xl gap-4 px-6 pb-16 md:grid-cols-4">{features.map(([Icon,title,desc]:any)=><Card key={title} className="soft-hover"><CardContent className="p-5"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5"/></div><p className="font-medium">{title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{desc}</p></CardContent></Card>)}</section></main>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-3xl border border-border/70 bg-background/70 p-5"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>}
