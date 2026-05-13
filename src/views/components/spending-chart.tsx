import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatter } from "@/lib/formatter-context";
import { useTranslation } from "react-i18next";
import type { MonthlySpending, SpendingByGroup, YearlySpending } from "../../shared/types";
import { SpendingPieChart } from "@/components/spending-pie-chart";

interface SpendingChartProps {
  monthly: MonthlySpending[];
  yearly: YearlySpending[];
  pieData?: SpendingByGroup[] | null;
  pieMode?: "universe" | "subuniverse" | null;
}

interface ChartCardProps {
  title: string;
  data: { name: string; total: number; orders: number }[];
  gradientId: string;
  barColor: string;
  lineColor: string;
}

function ChartCard({ title, data, gradientId, barColor, lineColor }: ChartCardProps) {
  const { formatCHF, formatCHFAxis, formatDecimal } = useFormatter();
  const { t } = useTranslation("SpendingChart");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={barColor} stopOpacity={0.95} />
                <stop offset="95%" stopColor={barColor} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--border)"
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={70}
              tickFormatter={formatCHFAxis}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={32}
              tickFormatter={formatDecimal}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              contentStyle={{
                backgroundColor: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--popover-foreground)",
                fontSize: 12,
                boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
              }}
              labelStyle={{
                color: "var(--foreground)",
                fontWeight: 500,
                marginBottom: 4,
              }}
              formatter={(value, name) =>
                name === t("legendTotal")
                  ? [formatCHF(Number(value)), t("tooltipTotal")]
                  : [formatDecimal(Number(value)), t("tooltipOrders")]
              }
            />
            <Legend
              iconType="circle"
              wrapperStyle={{
                fontSize: 12,
                color: "var(--muted-foreground)",
                paddingTop: 8,
              }}
            />
            <Bar
              yAxisId="left"
              dataKey="total"
              name={t("legendTotal")}
              fill={`url(#${gradientId})`}
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="orders"
              name={t("legendOrders")}
              stroke={lineColor}
              strokeWidth={2.5}
              dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--background)" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function SpendingChart({ monthly, yearly, pieData, pieMode }: SpendingChartProps) {
  const { formatMonth } = useFormatter();
  const { t } = useTranslation("SpendingChart");

  const monthlyData = monthly.map((m) => ({
    name: formatMonth(m.month),
    total: m.total,
    orders: m.count,
  }));

  const yearlyData = yearly.map((y) => ({
    name: y.year.toString(),
    total: y.total,
    orders: y.count,
  }));

  const hasPie = pieData && pieData.length > 0;
  const pieTitle =
    pieMode === "subuniverse"
      ? t("pieBySubuniverseTitle")
      : t("pieByUniverseTitle");

  return (
    <div
      className={
        hasPie
          ? "grid gap-4 grid-cols-1 lg:grid-cols-3"
          : "grid gap-4 md:grid-cols-2"
      }
    >
      <ChartCard
        title={t("monthlyTitle")}
        data={monthlyData}
        gradientId="spending-chart-monthly"
        barColor="var(--chart-1)"
        lineColor="var(--chart-2)"
      />
      <ChartCard
        title={t("yearlyTitle")}
        data={yearlyData}
        gradientId="spending-chart-yearly"
        barColor="var(--chart-3)"
        lineColor="var(--chart-4)"
      />
      {hasPie && <SpendingPieChart data={pieData} title={pieTitle} />}
    </div>
  );
}
