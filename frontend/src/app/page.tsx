/**
 * Main dashboard — home page of the Qoqa Compta application.
 *
 * Fetches data server-side via the /api/orders API route and renders:
 *   - Stats cards (total, count, average)
 *   - Spending charts (monthly bar+line, yearly)
 *   - Orders table with search/filters
 */
import { Suspense } from "react";
import { sql } from "@/lib/db";
import { StatsCards } from "@/components/stats-cards";
import { SpendingChart } from "@/components/spending-chart";
import { OrdersTable } from "@/components/orders-table";
import type {
  OrderStats,
  MonthlySpending,
  QoqaOrder,
  YearlySpending,
} from "@/types/order";

// Revalidate this page every 5 minutes
export const revalidate = 300;

async function fetchDashboardData() {
  const [statsRows, monthlyRows, yearlyRows, ordersRows, countRows] =
    await Promise.all([
      sql`
        SELECT
          COALESCE(SUM(amount_chf), 0)::float AS total_spent,
          COUNT(*)::int                        AS order_count,
          COALESCE(AVG(amount_chf), 0)::float  AS average_per_order
        FROM qoqa_orders
      `,
      sql`
        SELECT
          TO_CHAR(order_date, 'YYYY-MM') AS month,
          SUM(amount_chf)::float         AS total,
          COUNT(*)::int                  AS count
        FROM qoqa_orders
        WHERE order_date >= NOW() - INTERVAL '24 months'
        GROUP BY month
        ORDER BY month
      `,
      sql`
        SELECT
          EXTRACT(YEAR FROM order_date)::int AS year,
          SUM(amount_chf)::float             AS total,
          COUNT(*)::int                      AS count
        FROM qoqa_orders
        GROUP BY year
        ORDER BY year
      `,
      sql`
        SELECT
          id, order_number, order_date, amount_chf::float, partner_name,
          pdf_filename, created_at, updated_at
        FROM qoqa_orders
        ORDER BY order_date DESC
        LIMIT 20
      `,
      sql`SELECT COUNT(*)::int AS total FROM qoqa_orders`,
    ]);

  return {
    stats: statsRows[0] as OrderStats,
    monthly: monthlyRows as MonthlySpending[],
    yearly: yearlyRows as YearlySpending[],
    orders: ordersRows as QoqaOrder[],
    total: (countRows[0] as { total: number }).total,
  };
}

export default async function DashboardPage() {
  let data;
  try {
    data = await fetchDashboardData();
  } catch {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Qoqa Compta</h1>
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-destructive">
          <p className="font-semibold">Unable to connect to the database.</p>
          <p className="text-sm mt-1">
            Make sure <code className="font-mono">DATABASE_URL</code> is correctly
            configured in <code className="font-mono">frontend/.env.local</code>.
          </p>
        </div>
      </main>
    );
  }

  const { stats, monthly, yearly, orders, total } = data;

  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Qoqa Compta</h1>
        <p className="text-muted-foreground mt-1">
          Your Qoqa.ch spending dashboard
        </p>
      </div>

      {/* Stats cards */}
      <Suspense fallback={<div className="h-28 animate-pulse rounded-xl bg-muted" />}>
        <StatsCards stats={stats} />
      </Suspense>

      {/* Spending charts */}
      <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-muted" />}>
        <SpendingChart monthly={monthly} yearly={yearly} />
      </Suspense>

      {/* Orders table */}
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <OrdersTable
          initialOrders={orders}
          initialPagination={{
            page: 1,
            pageSize: 20,
            total,
            totalPages: Math.ceil(total / 20),
          }}
        />
      </Suspense>
    </main>
  );
}
