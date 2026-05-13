import { Hono } from "hono";
import {
  fetchStats,
  fetchMonthlySpending,
  fetchYearlySpending,
  fetchInitialOrders,
  fetchTotalCount,
  fetchUniverses,
  fetchSpendingByGroup,
} from "../queries";
import type { DashboardData, SpendingByGroup } from "../../shared/types";

const router = new Hono();

function parseList(param: string | undefined): string[] {
  return param ? param.split(",").filter(Boolean) : [];
}

router.get("/dashboard", async (c) => {
  try {
    const universeList = parseList(c.req.query("universes"));
    const subuniverseList = parseList(c.req.query("subuniverses"));
    const from = c.req.query("from");
    const to = c.req.query("to");
    const pageSize = 20;

    const [stats, monthly, yearly, universes, total, orders] = await Promise.all([
      fetchStats(universeList, subuniverseList, from, to),
      fetchMonthlySpending(universeList, subuniverseList, from, to),
      fetchYearlySpending(universeList, subuniverseList, from, to),
      fetchUniverses(),
      fetchTotalCount(universeList, subuniverseList, from, to),
      fetchInitialOrders(universeList, subuniverseList, from, to, pageSize),
    ]);

    // Pie chart mode: subuniverse breakdown when exactly one universe is selected,
    // universe breakdown otherwise (only when there is data to show).
    let pieMode: "universe" | "subuniverse" | null = null;
    let pieData: SpendingByGroup[] | null = null;

    if (total > 0) {
      pieMode =
        universeList.length === 1 && subuniverseList.length === 0
          ? "subuniverse"
          : "universe";
      pieData = await fetchSpendingByGroup(pieMode, universeList, subuniverseList, from, to);
    }

    const totalPages = Math.ceil(total / pageSize);

    const body: DashboardData = {
      stats,
      monthly,
      yearly,
      orders,
      pagination: { page: 1, pageSize, total, totalPages },
      universes,
      pieData,
      pieMode,
    };

    return c.json(body);
  } catch (err) {
    console.error("[dashboard]", err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default router;
