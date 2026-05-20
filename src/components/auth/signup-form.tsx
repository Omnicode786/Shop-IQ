"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";

export function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ shopName: "", name: "", email: "", password: "" }); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error || "Signup failed");
      toast.success("Workspace created successfully.");
      router.push(data.redirectTo || "/admin/dashboard");
      router.refresh();
    } catch (err: any) {
      const errorMessage = err?.message || "Signup failed";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }
  return <Card className="w-full max-w-md"><CardContent className="p-6"><form onSubmit={submit} className="space-y-4"><div><p className="text-xl font-semibold">Create your ShopIQ workspace</p><p className="mt-1 text-sm text-muted-foreground">Start with a secure shop owner account.</p></div>{error ? <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}<Input value={form.shopName} onChange={e=>setForm({...form, shopName:e.target.value})} placeholder="Shop name" required/><Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Your name" required/><Input type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} placeholder="Email" required/><Input type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} placeholder="Password" required/><Button className="w-full" disabled={loading}>{loading ? "Creating..." : "Create workspace"}</Button></form></CardContent></Card>;
}
