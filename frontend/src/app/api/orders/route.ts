/**
 * GET /api/orders
 *
 * Returns a JSON payload with:
 *   - stats: aggregated spending statistics
 *   - monthly: spending grouped by month
 *   - yearly: spending grouped by year
 *   - orders: paginated list of orders (with optional filters)
 *
 * Query parameters:
 *   - search: string (order_number, offer_title, or item_description; optional)
 *   - minAmount: number (optional)
 *   - maxAmount: number (optional)
 *   - from: ISO date YYYY-MM-DD (optional)
 *   - to: ISO date YYYY-MM-DD (optional)
 *   - page: number (default 1)
 *   - pageSize: number (default 20, max 100)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  fetchStats,
  fetchMonthlySpending,
  fetchYearlySpending,
  fetchOrders,
  fetchOrdersCount,
} from "@/lib/queries";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function safeDate(value: string | null, fallback: string): string {
  if (value && ISO_DATE_RE.test(value)) return value;
  return fallback;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const search = searchParams.get("search") ?? "";
  const minAmountParam = searchParams.get("minAmount");
  const maxAmountParam = searchParams.get("maxAmount");
  const minAmount =
    minAmountParam !== null && !isNaN(parseFloat(minAmountParam))
      ? parseFloat(minAmountParam)
      : 0;
  const maxAmount =
    maxAmountParam !== null && !isNaN(parseFloat(maxAmountParam))
      ? parseFloat(maxAmountParam)
      : Number.MAX_SAFE_INTEGER;
  const from = safeDate(searchParams.get("from"), "2000-01-01");
  const to = safeDate(searchParams.get("to"), "2099-12-31");
  const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const rawPageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);
  const pageSize = Math.min(
    100,
    Number.isFinite(rawPageSize) && rawPageSize > 0 ? rawPageSize : 20
  );

  const filter = { search, minAmount, maxAmount, from, to, page, pageSize };

  try {
    const [stats, monthly, yearly, orders, total] = await Promise.all([
      fetchStats(),
      fetchMonthlySpending(),
      fetchYearlySpending(),
      fetchOrders(filter),
      fetchOrdersCount(filter),
    ]);

    return NextResponse.json({
      stats,
      monthly,
      yearly,
      orders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("[/api/orders] DB error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders from the database." },
      { status: 500 }
    );
  }
}

