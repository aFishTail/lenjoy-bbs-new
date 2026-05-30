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

  test("global search routes to search results with keyword state", async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, "baseURL is required");

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByLabel("搜索帖子").fill("redis");
    await page.getByRole("button", { name: "搜索" }).click();

    await page.waitForURL(/\/search\?q=redis/);
    await expect(page.getByLabel("搜索帖子")).toHaveValue("redis");
    await expect(page.locator("main")).toBeVisible();
  });

  test("home hero search is visible and routes to search", async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, "baseURL is required");

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("首页搜索帖子")).toBeVisible();
    await page.getByLabel("首页搜索帖子").fill("python");
    await page.getByRole("button", { name: "搜索首页帖子" }).click();

    await page.waitForURL(/\/search\?q=python/);
    await expect(page.locator("main")).toBeVisible();
  });
});
