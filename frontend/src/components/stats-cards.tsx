/**
 * Stats Cards — displays aggregate spending metrics.
 *
 * Shows:
 *   - Total spent (CHF)
 *   - Number of orders
 *   - Average spend per order (CHF)
 *
 * Server Component: formatting happens on the server to avoid hydration
 * mismatches caused by differing ICU data between Node.js and the browser.
 */

import { ShoppingBag, TrendingUp, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { parseAcceptLanguage, createFormatters } from "@/lib/formatters";
import type { OrderStats } from "@/types/order";

interface StatsCardsProps {
  stats: OrderStats;
}

export async function StatsCards({ stats }: StatsCardsProps) {
  const hdrs = await headers();
  const { formatCHF } = createFormatters(parseAcceptLanguage(hdrs.get("accept-language")));
  const t = await getTranslations("StatsCards");
  const cards = [
    {
      title: t("totalSpent"),
      value: formatCHF(stats.total_spent),
      description: t("totalSpentDesc"),
      icon: CreditCard,
      color: "text-blue-500",
    },
    {
      title: t("orders"),
      value: stats.order_count.toString(),
      description: t("ordersDesc"),
      icon: ShoppingBag,
      color: "text-green-500",
    },
    {
      title: t("averagePerOrder"),
      value: formatCHF(stats.average_per_order),
      description: t("averagePerOrderDesc"),
      icon: TrendingUp,
      color: "text-orange-500",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-5 w-5 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
