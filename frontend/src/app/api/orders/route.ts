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
 *   - search: string (order_number or partner_name, optional)
 *   - minAmount: number (optional)
 *   - maxAmount: number (optional)
 *   - from: ISO date (optional)
 *   - to: ISO date (optional)
 *   - page: number (default 1)
 *   - pageSize: number (default 20, max 100)
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const search = searchParams.get("search") ?? "";
  const minAmountParam = searchParams.get("minAmount");
  const maxAmountParam = searchParams.get("maxAmount");
  const minAmount = minAmountParam !== null && !isNaN(parseFloat(minAmountParam))
    ? parseFloat(minAmountParam)
    : 0;
  const maxAmount = maxAmountParam !== null && !isNaN(parseFloat(maxAmountParam))
    ? parseFloat(maxAmountParam)
    : Number.MAX_SAFE_INTEGER;
  const from = searchParams.get("from") ?? "2000-01-01";
  const to = searchParams.get("to") ?? "2099-12-31";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10))
  );
  const offset = (page - 1) * pageSize;

  const searchPattern = `%${search}%`;

  try {
    // Aggregate stats
    const [statsRow] = await sql`
      SELECT
        COALESCE(SUM(amount_chf), 0)::float  AS total_spent,
        COUNT(*)::int                          AS order_count,
        COALESCE(AVG(amount_chf), 0)::float   AS average_per_order
      FROM qoqa_orders
    `;

    // Monthly spending (last 24 months)
    const monthlyRows = await sql`
      SELECT
        TO_CHAR(order_date, 'YYYY-MM') AS month,
        SUM(amount_chf)::float         AS total,
        COUNT(*)::int                  AS count
      FROM qoqa_orders
      WHERE order_date >= NOW() - INTERVAL '24 months'
      GROUP BY month
      ORDER BY month
    `;

    // Yearly spending
    const yearlyRows = await sql`
      SELECT
        EXTRACT(YEAR FROM order_date)::int AS year,
        SUM(amount_chf)::float             AS total,
        COUNT(*)::int                      AS count
      FROM qoqa_orders
      GROUP BY year
      ORDER BY year
    `;

    // Filtered orders list
    const orders = await sql`
      SELECT
        id, order_number, order_date, amount_chf::float, partner_name,
        pdf_filename, created_at, updated_at
      FROM qoqa_orders
      WHERE
        (order_number ILIKE ${searchPattern} OR partner_name ILIKE ${searchPattern})
        AND amount_chf >= ${minAmount}
        AND amount_chf <= ${maxAmount}
        AND order_date BETWEEN ${from}::date AND ${to}::date
      ORDER BY order_date DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const [countRow] = await sql`
      SELECT COUNT(*)::int AS total
      FROM qoqa_orders
      WHERE
        (order_number ILIKE ${searchPattern} OR partner_name ILIKE ${searchPattern})
        AND amount_chf >= ${minAmount}
        AND amount_chf <= ${maxAmount}
        AND order_date BETWEEN ${from}::date AND ${to}::date
    `;

    return NextResponse.json({
      stats: statsRow,
      monthly: monthlyRows,
      yearly: yearlyRows,
      orders,
      pagination: {
        page,
        pageSize,
        total: countRow.total,
        totalPages: Math.ceil(countRow.total / pageSize),
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
