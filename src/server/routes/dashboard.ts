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
import { isSchemaReady } from "../migrate";
import { readSettings } from "../settings";
import { parseSubuniverseKey } from "../../shared/filters";
import {
  DEFAULT_PAGE_SIZE,
  type DashboardData,
  type SpendingByGroup,
} from "../../shared/types";

const router = new Hono();

function parseList(param: string | undefined): string[] {
  return param ? param.split(",").filter(Boolean) : [];
}

function emptyDashboard(): DashboardData {
  return {
    stats: { total_spent: 0, order_count: 0, average_per_order: 0 },
    monthly: [],
    yearly: [],
    orders: [],
    pagination: { page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 },
    universes: [],
    pieData: null,
    pieMode: null,
    syncLocale: readSettings().syncLocale,
  };
}

router.get("/dashboard", async (c) => {
  try {
    const universeList = parseList(c.req.query("universes"));
    const subuniverseList = parseList(c.req.query("subuniverses"));
    const from = c.req.query("from");
    const to = c.req.query("to");
    const pageSize = DEFAULT_PAGE_SIZE;

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
          .map((key) => {
            const { universe, subuniverse } = parseSubuniverseKey(key);
            return universe ?? subToUniverse.get(subuniverse);
          })
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
    if (!(await isSchemaReady())) return c.json(emptyDashboard());
    console.error("[dashboard]", err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default router;
