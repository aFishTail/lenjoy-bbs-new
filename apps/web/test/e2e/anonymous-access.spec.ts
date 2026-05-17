import { PUBLIC_ROUTES } from "../helpers/prd-fixtures";
import { expect, test } from "./fixtures/auth.fixture";

test.describe("anonymous access", { tag: ["@p0", "@core"] }, () => {
  test("visitor can browse public routes and is redirected from protected pages", async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, "baseURL is required");

    for (const path of PUBLIC_ROUTES) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("main")).toBeVisible();
    }

    await page.goto("/posts/new", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/auth/);

    await page.goto("/my", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/auth/);
  });
});