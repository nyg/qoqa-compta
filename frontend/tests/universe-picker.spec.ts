/**
 * Playwright E2E tests for the hierarchical UniversePicker component.
 *
 * All tests mock both the API and the Next.js server component data so
 * they work without a live database.
 */
import { test, expect } from "@playwright/test";

const AVAILABLE_UNIVERSES = [
  {
    identifier: "wine",
    name: "Wine",
    subuniverses: [
      { identifier: "red", name: "Red Wine" },
      { identifier: "white", name: "White Wine" },
    ],
  },
  {
    identifier: "beer",
    name: "Beer",
    subuniverses: [{ identifier: "craft", name: "Craft Beer" }],
  },
];

/** Intercept the dashboard page and inject mock data via the API mock pattern. */
async function setupMocks(page: import("@playwright/test").Page) {
  // Mock the /api/orders endpoint so the OrdersTable loads without a DB
  await page.route("**/api/orders**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        orders: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        stats: { total_spent: "0", order_count: 0, average_per_order: "0" },
        monthly: [],
        yearly: [],
      }),
    });
  });
}

test.describe("UniversePicker — hierarchical selection", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test("opens dropdown and shows universes with sub-universes", async ({ page }) => {
    await page.goto("/");
    // Click the picker button ("All universes" label in English)
    const pickerButton = page.getByRole("button", { name: /all universes/i });
    await pickerButton.click();

    // Universe names should be visible
    await expect(page.getByRole("option", { name: /wine/i }).first()).toBeVisible();
    await expect(page.getByRole("option", { name: /beer/i }).first()).toBeVisible();
    // Sub-universe names should be indented below their parent
    await expect(page.getByRole("option", { name: /red wine/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /white wine/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /craft beer/i })).toBeVisible();
  });

  test("clicking a subuniverse adds ?subuniverses=id to URL", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /all universes/i }).click();
    await page.getByRole("option", { name: /red wine/i }).click();

    await expect(page).toHaveURL(/subuniverses=red/);
    // universes param should NOT be present for a single subuniverse selection
    expect(page.url()).not.toMatch(/universes=/);
  });

  test("clicking a universe adds ?universes=id and clears its subuniverses from URL", async ({
    page,
  }) => {
    // Start with a subuniverse already selected
    await page.goto("/?subuniverses=red");
    await page.getByRole("button", { name: /1 selected/i }).click();
    // Click the parent universe "Wine"
    await page.getByRole("option", { name: /^wine$/i }).click();

    await expect(page).toHaveURL(/universes=wine/);
    // The previously-selected subuniverse should be gone
    expect(page.url()).not.toMatch(/subuniverses=/);
  });

  test("selecting all subuniverses of a universe collapses to universe-level URL", async ({
    page,
  }) => {
    // Beer has exactly one subuniverse (craft), so selecting it should collapse to universe-level
    await page.goto("/");
    await page.getByRole("button", { name: /all universes/i }).click();
    await page.getByRole("option", { name: /craft beer/i }).click();

    // After selecting the only subuniverse, URL should use universes=beer, not subuniverses
    await expect(page).toHaveURL(/universes=beer/);
    expect(page.url()).not.toMatch(/subuniverses=/);
  });

  test("unchecking a subuniverse while universe is selected explodes into remaining subs", async ({
    page,
  }) => {
    // Wine has two subs: red + white. Start with universe=wine selected.
    await page.goto("/?universes=wine");
    await page.getByRole("button", { name: /1 selected/i }).click();
    // Uncheck "Red Wine"
    await page.getByRole("option", { name: /red wine/i }).click();

    // Should now have subuniverses=white (the remaining sub), not universes=wine
    await expect(page).toHaveURL(/subuniverses=white/);
    expect(page.url()).not.toMatch(/universes=/);
  });

  test("label shows count of both selected universes and subuniverses", async ({ page }) => {
    // Select one universe and one subuniverse from a different universe
    await page.goto("/?universes=beer&subuniverses=red");
    // Total = 2 (1 universe + 1 subuniverse)
    await expect(page.getByRole("button", { name: /2 selected/i })).toBeVisible();
  });

  test("clicking outside the picker closes it", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /all universes/i }).click();
    await expect(page.getByRole("listbox", { name: /universe filter/i })).toBeVisible();

    // Click somewhere outside the picker
    await page.mouse.click(10, 10);
    await expect(page.getByRole("listbox", { name: /universe filter/i })).not.toBeVisible();
  });
});
