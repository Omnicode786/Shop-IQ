"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";

export function LoginForm() {
  const router = useRouter(); const params = useSearchParams();
  const [email, setEmail] = useState("owner@shopiq.dev"); const [password, setPassword] = useState("demo12345"); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error || "Login failed");
      toast.success("Signed in successfully.");
      router.push(params.get("next") || data.redirectTo || "/admin/dashboard");
      router.refresh();
    } catch (err: any) {
      const errorMessage = err?.message || "Login failed";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }
  return <Card className="w-full max-w-md"><CardContent className="p-6"><form onSubmit={submit} className="flex flex-col gap-4"><div><p className="text-xl font-semibold">Welcome back</p><p className="mt-1 text-sm text-muted-foreground">Sign in to your ShopIQ workspace.</p></div>{error ? <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}<Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" required/><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" required/><Button className="w-full" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button><div className="rounded-2xl bg-muted/40 p-3 text-xs text-muted-foreground">Demo: owner@shopiq.dev / demo12345<br/>Staff: staff@shopiq.dev / demo12345<br/>Manager: manager@shopiq.dev / demo12345</div></form></CardContent></Card>;
}
