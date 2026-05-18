"use client";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const palette = [
  "hsl(var(--shopiq-chart-1))",
  "hsl(var(--shopiq-chart-2))",
  "hsl(var(--shopiq-chart-3))",
  "hsl(var(--shopiq-chart-4))",
  "hsl(var(--shopiq-chart-5))",
  "hsl(var(--shopiq-chart-6))"
];

function tooltipStyle() {
  return {
    border: "1px solid hsl(var(--border))",
    borderRadius: "14px",
    background: "hsl(var(--card) / 0.96)",
    boxShadow: "0 18px 42px rgba(24,24,31,0.14)",
    color: "hsl(var(--foreground))"
  };
}

export function BarChartCard({ title, data, xKey = "name", yKey = "qty" }: { title: string; data: any[]; xKey?: string; yKey?: string }) {
  const total = data.reduce((sum, item) => sum + Number(item[yKey] || 0), 0);

  return (
    <Card className="chart-shell overflow-hidden">
      <CardHeader className="pb-2">
        <div className="chart-card-title">
          <div>
            <CardTitle className="text-base tracking-normal">{title}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Ranked by live movement volume</p>
          </div>
          <span className="chart-chip">{total.toLocaleString()} units</span>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="24%" margin={{ top: 16, right: 8, bottom: 8, left: -12 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 6" vertical={false} opacity={0.5} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={0} angle={-10} height={52} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={38} />
              <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.34)" }} contentStyle={tooltipStyle()} />
              <Bar dataKey={yKey} radius={[14, 14, 6, 6]} isAnimationActive={false}>
                {data.map((_, i) => (
                  <Cell key={i} fill={palette[i % palette.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function PieChartCard({ title, data }: { title: string; data: any[] }) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <Card className="chart-shell overflow-hidden">
      <CardHeader className="pb-2">
        <div className="chart-card-title">
          <div>
            <CardTitle className="text-base tracking-normal">{title}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Category value share</p>
          </div>
          <span className="chart-chip">{data.length || 0} groups</span>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="relative h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" outerRadius={104} innerRadius={58} paddingAngle={4} stroke="hsl(var(--card))" strokeWidth={4} isAnimationActive={false}>
                {data.map((_, i) => (
                  <Cell key={i} fill={palette[i % palette.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [`PKR ${Number(value).toLocaleString()}`, "Value"]} contentStyle={tooltipStyle()} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-semibold">PKR {Math.round(total).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.slice(0, 6).map((item, i) => (
            <span key={item.name} className="rounded-full border border-border/70 bg-background/55 px-2.5 py-1 text-xs text-muted-foreground">
              <span style={{ background: palette[i % palette.length] }} className="mr-1 inline-block size-2 rounded-full" />
              {item.name}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
