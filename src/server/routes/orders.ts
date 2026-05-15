import path from "node:path";
import { Hono } from "hono";
import { fetchOrders, fetchOrderPdf, fetchAllOrders } from "../queries";
import type { OrdersResponse, QoqaOrder } from "../../shared/types";

function parseList(param: string | undefined): string[] {
  return param ? param.split(",").filter(Boolean) : [];
}

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function ordersToCsv(orders: QoqaOrder[]): string {
  const headers = [
    "order_number",
    "order_date",
    "universe_name",
    "subuniverse_name",
    "offer_title",
    "offer_subtitle",
    "item_description",
    "status",
    "amount_chf",
    "subtotal_chf",
    "discount_chf",
    "vat_chf",
    "invoice_number",
  ];

  const rows = orders.map((o) =>
    [
      o.order_number,
      o.order_date,
      o.universe_name,
      o.subuniverse_name,
      o.offer_title,
      o.offer_subtitle,
      o.item_description,
      o.status,
      o.amount_chf,
      o.subtotal_chf,
      o.discount_chf,
      o.vat_chf,
      o.invoice_number,
    ]
      .map(escapeCsv)
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

export default function ordersRouter(openDirectoryDialog?: () => Promise<string | null>) {
  const router = new Hono();
  // GET /api/orders/csv  (must be defined before /:orderNumber/pdf)
  router.get("/orders/csv", async (c) => {
    try {
      const universeList = parseList(c.req.query("universes"));
      const subuniverseList = parseList(c.req.query("subuniverses"));
      const from = c.req.query("from");
      const to = c.req.query("to");

      const orders = await fetchAllOrders({
        universes: universeList.length ? universeList : undefined,
        subuniverses: subuniverseList.length ? subuniverseList : undefined,
        from,
        to,
      });

      const csv = ordersToCsv(orders);

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="qoqa-orders.csv"`,
        },
      });
    } catch (err) {
      console.error("[orders/csv]", err);
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  // POST /api/orders/csv-save  (desktop only — requires openDirectoryDialog)
  if (openDirectoryDialog) {
    router.post("/orders/csv-save", async (c) => {
      try {
        const universeList = parseList(c.req.query("universes"));
        const subuniverseList = parseList(c.req.query("subuniverses"));
        const from = c.req.query("from");
        const to = c.req.query("to");

        const dir = await openDirectoryDialog();
        if (!dir) return c.json({ cancelled: true });

        const orders = await fetchAllOrders({
          universes: universeList.length ? universeList : undefined,
          subuniverses: subuniverseList.length ? subuniverseList : undefined,
          from,
          to,
        });

        const csv = ordersToCsv(orders);
        const date = new Date().toISOString().slice(0, 10);
        const filePath = path.join(dir, `qoqa-orders-${date}.csv`);
        await Bun.write(filePath, csv);

        return c.json({ path: filePath });
      } catch (err) {
        console.error("[orders/csv-save]", err);
        return c.json({ error: (err as Error).message }, 500);
      }
    });
  }

  // GET /api/orders
  router.get("/orders", async (c) => {
    try {
      const universeList = parseList(c.req.query("universes"));
      const subuniverseList = parseList(c.req.query("subuniverses"));
      const from = c.req.query("from");
      const to = c.req.query("to");
      const search = c.req.query("search") ?? "";
      const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query("pageSize") ?? "20", 10)));

      const { orders, total } = await fetchOrders(
        universeList,
        subuniverseList,
        search,
        page,
        pageSize,
        from,
        to
      );

      const totalPages = Math.ceil(total / pageSize);
      const body: OrdersResponse = {
        orders,
        pagination: { page, pageSize, total, totalPages },
      };

      return c.json(body);
    } catch (err) {
      console.error("[orders]", err);
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  // GET /api/orders/:orderNumber/pdf
  router.get("/orders/:orderNumber/pdf", async (c) => {
    try {
      const orderNumber = c.req.param("orderNumber");
      const pdfBuffer = await fetchOrderPdf(orderNumber);

      if (!pdfBuffer) {
        return c.json({ error: "PDF not found" }, 404);
      }

      return new Response(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="invoice-${orderNumber}.pdf"`,
          "Content-Length": String(pdfBuffer.length),
        },
      });
    } catch (err) {
      console.error("[orders/pdf]", err);
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  return router;
}
