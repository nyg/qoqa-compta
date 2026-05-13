import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatter } from "@/lib/formatter-context";
import type { SpendingByGroup } from "../../shared/types";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface SpendingPieChartProps {
  data: SpendingByGroup[];
  title: string;
}

export function SpendingPieChart({ data, title }: SpendingPieChartProps) {
  const { formatCHF } = useFormatter();
  const grandTotal = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="name"
              cx="50%"
              cy="45%"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.identifier}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--popover-foreground)",
                fontSize: 12,
                boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
              }}
              formatter={(value, name) => {
                const pct =
                  grandTotal > 0
                    ? ((Number(value) / grandTotal) * 100).toFixed(1)
                    : "0";
                return [`${formatCHF(Number(value))} · ${pct}%`, name];
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{
                fontSize: 11,
                color: "var(--muted-foreground)",
                paddingTop: 8,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
