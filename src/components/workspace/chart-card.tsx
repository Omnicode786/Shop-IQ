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

function cleanText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function EmptyChartState({ label = "No role-visible chart data yet" }: { label?: string }) {
  return (
    <div className="analytics-empty-state">
      <span>{label}</span>
    </div>
  );
}

export function BarChartCard({ title, data, xKey = "name", yKey = "qty" }: { title: string; data: any[]; xKey?: string; yKey?: string }) {
  const safeData = data
    .map((item) => ({ ...item, [xKey]: cleanText(item[xKey]) || "Item", [yKey]: Number(item[yKey] || 0) }))
    .filter((item) => Number(item[yKey] || 0) > 0);
  const total = safeData.reduce((sum, item) => sum + Number(item[yKey] || 0), 0);

  return (
    <Card className="chart-shell overflow-hidden">
      <CardHeader className="pb-2">
        <div className="chart-card-title">
          <div className="min-w-0">
            <CardTitle className="truncate text-base tracking-normal" title={title}>{title}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Ranked by live movement volume</p>
          </div>
          {total > 0 ? <span className="chart-chip" title={`${total.toLocaleString()} units`}>{total.toLocaleString()} units</span> : null}
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="analytics-chart-frame analytics-chart-frame-lg">
          {safeData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeData} barCategoryGap="24%" margin={{ top: 16, right: 8, bottom: 8, left: -12 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 6" vertical={false} opacity={0.5} />
                <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={0} angle={-10} height={52} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={38} />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.34)" }} contentStyle={tooltipStyle()} />
                <Bar dataKey={yKey} radius={[14, 14, 6, 6]} isAnimationActive={false}>
                  {safeData.map((_, i) => (
                    <Cell key={i} fill={palette[i % palette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PieChartCard({ title, data }: { title: string; data: any[] }) {
  const safeData = data
    .map((item) => ({ ...item, name: cleanText(item.name), value: Number(item.value || 0) }))
    .filter((item) => item.name && item.value > 0);
  const total = safeData.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <Card className="chart-shell overflow-hidden">
      <CardHeader className="pb-2">
        <div className="chart-card-title">
          <div className="min-w-0">
            <CardTitle className="truncate text-base tracking-normal" title={title}>{title}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Category value share</p>
          </div>
          {safeData.length ? <span className="chart-chip" title={`${safeData.length} groups`}>{safeData.length} groups</span> : null}
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="analytics-chart-frame analytics-chart-frame-lg relative">
          {safeData.length ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={safeData} dataKey="value" nameKey="name" outerRadius={104} innerRadius={58} paddingAngle={4} stroke="hsl(var(--card))" strokeWidth={4} isAnimationActive={false}>
                    {safeData.map((_, i) => (
                      <Cell key={i} fill={palette[i % palette.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`PKR ${Number(value).toLocaleString()}`, "Value"]} contentStyle={tooltipStyle()} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div className="min-w-0 max-w-[9rem]">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="truncate text-lg font-semibold" title={`PKR ${Math.round(total).toLocaleString()}`}>PKR {Math.round(total).toLocaleString()}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full">
              <EmptyChartState />
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {safeData.slice(0, 6).map((item, i) => (
            <span key={item.name} className="chart-legend-pill" title={item.name}>
              <span style={{ background: palette[i % palette.length] }} className="mr-1 inline-block size-2 rounded-full" />
              {item.name}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
