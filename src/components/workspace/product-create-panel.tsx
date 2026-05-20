"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";

const initialForm = { name: "", sku: "", brand: "", costPrice: "", salePrice: "", stockQty: "", reorderLevel: "" };

export function ProductCreatePanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          costPrice: Number(form.costPrice),
          salePrice: Number(form.salePrice),
          stockQty: Number(form.stockQty),
          reorderLevel: Number(form.reorderLevel)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Product could not be saved.");
      toast.success("Product created successfully.");
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      const errorMessage = error?.message || "Product could not be saved.";
      setMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        {!open ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Add inventory item</p>
              <p className="text-sm leading-6 text-muted-foreground">Create a database-backed product with stock and reorder levels.</p>
            </div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              Add product
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">New inventory item</p>
                <p className="text-xs text-muted-foreground">Add pricing, stock and reorder data.</p>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            {message ? <div className="status-message border-destructive/20 bg-destructive/10 text-destructive">{message}</div> : null}
            <div className="grid gap-3 md:grid-cols-4">
              <Input required placeholder="Product name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <Input placeholder="SKU" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
              <Input placeholder="Brand" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
              <Input type="number" required placeholder="Stock" value={form.stockQty} onChange={(event) => setForm({ ...form, stockQty: event.target.value })} />
              <Input type="number" required placeholder="Cost price" value={form.costPrice} onChange={(event) => setForm({ ...form, costPrice: event.target.value })} />
              <Input type="number" required placeholder="Sale price" value={form.salePrice} onChange={(event) => setForm({ ...form, salePrice: event.target.value })} />
              <Input type="number" placeholder="Low stock level" value={form.reorderLevel} onChange={(event) => setForm({ ...form, reorderLevel: event.target.value })} />
              <div className="flex gap-2">
                <Button disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
