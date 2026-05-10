/**
 * Playwright E2E tests for the OrdersTable component — specifically the
 * two-pill universe/subuniverse display in each row.
 *
 * All tests use page.route() to mock /api/orders so they run without a DB.
 */
import { test, expect } from "@playwright/test";

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    order_number: "123456",
    order_date: "2024-01-15",
    amount_chf: "49.90",
    status: "paid",
    subtotal_chf: "49.90",
    discount_chf: null,
    vat_chf: "3.85",
    delivery_on: null,
    offer_id: "offer-1",
    offer_title: "Test Offer",
    offer_subtitle: null,
    universe: "wine",
    subuniverse: "red",
    universe_name: "Wine",
    subuniverse_name: "Red Wine",
    item_description: null,
    invoice_number: null,
    pdf_filename: null,
    created_at: "2024-01-15T10:00:00",
    updated_at: "2024-01-15T10:00:00",
    ...overrides,
  };
}

const BASE_RESPONSE = {
  pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  stats: { total_spent: "49.90", order_count: 1, average_per_order: "49.90" },
  monthly: [],
  yearly: [],
};

test.describe("OrdersTable — universe/subuniverse pills", () => {
  test("shows two pills when both universe_name and subuniverse_name are present", async ({
    page,
  }) => {
    await page.route("**/api/orders**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...BASE_RESPONSE,
          orders: [makeOrder({ universe_name: "Wine", subuniverse_name: "Red Wine" })],
        }),
      });
    });

    await page.goto("/");

    // Both pills should be visible in the universe column
    await expect(page.getByText("Wine").first()).toBeVisible();
    await expect(page.getByText("Red Wine")).toBeVisible();
  });

  test("shows only universe pill when subuniverse_name is null", async ({ page }) => {
    await page.route("**/api/orders**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...BASE_RESPONSE,
          orders: [
            makeOrder({
              subuniverse: null,
              subuniverse_name: null,
              universe_name: "Beer",
            }),
          ],
        }),
      });
    });

    await page.goto("/");
    await expect(page.getByText("Beer")).toBeVisible();
    // Subuniverse name "Red Wine" should NOT appear
    await expect(page.getByText("Red Wine")).not.toBeVisible();
  });

  test("shows dash when universe is null", async ({ page }) => {
    await page.route("**/api/orders**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...BASE_RESPONSE,
          orders: [
            makeOrder({
              universe: null,
              universe_name: null,
              subuniverse: null,
              subuniverse_name: null,
            }),
          ],
        }),
      });
    });

    await page.goto("/");
    // The em-dash fallback should appear in the universe column cell
    await expect(page.getByText("—").first()).toBeVisible();
  });

  test("subuniverses param is forwarded in the /api/orders fetch", async ({ page }) => {
    const requestUrls: string[] = [];
    await page.route("**/api/orders**", async (route) => {
      requestUrls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...BASE_RESPONSE, orders: [] }),
      });
    });

    await page.goto("/?subuniverses=red,white");
    // Wait for the orders table to render
    await page.waitForSelector("table");

    // The /api/orders request triggered by the table should include subuniverses
    const tableRequests = requestUrls.filter((u) => u.includes("/api/orders"));
    expect(tableRequests.some((u) => u.includes("subuniverses=red"))).toBeTruthy();
  });
});
