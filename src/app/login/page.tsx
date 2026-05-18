import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UiModeToggle } from "@/components/ui-mode-toggle";
export default function LoginPage(){return <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[0.95fr_1.05fr]"><div className="flex flex-col justify-between bg-card/70 p-8"><div className="flex items-center justify-between"><Logo/><div className="flex gap-2"><UiModeToggle compact/><ThemeToggle/></div></div><div className="max-w-xl"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Inventory intelligence</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Sign in to your ShopIQ business workspace.</h1><p className="mt-4 text-sm leading-7 text-muted-foreground">Review sales, stock health, dues, suppliers, reports and AI suggestions from one polished operating system.</p></div><p className="text-sm text-muted-foreground">Need an account? <Link href="/signup" className="text-primary underline underline-offset-4">Create one</Link></p></div><div className="grid place-items-center p-8"><Suspense fallback={null}><LoginForm/></Suspense></div></div>}
