import { expect, test } from "@playwright/test";

import { PUBLIC_ROUTES } from "./helpers/prd-fixtures";

test.describe("PRD smoke", () => {
  test("anonymous browsing and auth redirects", async ({ page, baseURL }) => {
    test.skip(!baseURL, "baseURL is required");

    for (const path of PUBLIC_ROUTES) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toBeVisible();
    }

    await page.goto("/posts/new", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/auth/);

    await page.goto("/my", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/auth/);
  });
});
