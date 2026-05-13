import { Hono } from "hono";
import { fetchOrders, fetchOrderPdf } from "../queries";
import type { OrdersResponse } from "../../shared/types";

const router = new Hono();

function parseList(param: string | undefined): string[] {
  return param ? param.split(",").filter(Boolean) : [];
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

export default router;
