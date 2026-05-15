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
import { readSettings } from "../settings";
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

    // Pie chart mode: mirror the original logic — when no filter is applied, treat all
    // available universes as the effective scope. Build the set of distinct parent universes
    // actually in scope: if that set has exactly one entry, show subuniverse breakdown;
    // if more than one, show universe breakdown; if zero (no data), hide the pie.
    let pieMode: "universe" | "subuniverse" | null = null;
    let pieData: SpendingByGroup[] | null = null;

    if (total > 0) {
      const subToUniverse = new Map(
        universes.flatMap((u) => u.subuniverses.map((s) => [s.identifier, u.identifier]))
      );
      const effectiveUniverses =
        universeList.length === 0 && subuniverseList.length === 0
          ? universes.map((u) => u.identifier)
          : universeList;
      const activeUniverseIds = new Set([
        ...effectiveUniverses,
        ...subuniverseList
          .map((s) => subToUniverse.get(s))
          .filter((v): v is string => v !== undefined),
      ]);
      pieMode =
        activeUniverseIds.size === 1
          ? "subuniverse"
          : activeUniverseIds.size > 1
          ? "universe"
          : null;
      if (pieMode !== null) {
        pieData = await fetchSpendingByGroup(pieMode, universeList, subuniverseList, from, to);
      }
    }

    const totalPages = Math.ceil(total / pageSize);
    const { syncLocale } = readSettings();

    const body: DashboardData = {
      stats,
      monthly,
      yearly,
      orders,
      pagination: { page: 1, pageSize, total, totalPages },
      universes,
      pieData,
      pieMode,
      syncLocale,
    };

    return c.json(body);
  } catch (err) {
    console.error("[dashboard]", err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default router;
