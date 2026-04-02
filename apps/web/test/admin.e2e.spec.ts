import { expect, test } from "@playwright/test";

import { ADMIN_ROUTES } from "./helpers/prd-fixtures";
import { applySession } from "./helpers/sessions";
import { expectAdminSession, requireSession, sessions } from "./helpers/session-checks";

test.describe("PRD admin flow", () => {
  test.skip(
    !sessions.user_a || !sessions.admin,
    "user_a and admin sessions are required for admin flow",
  );

  test("admin pages and APIs respond", async ({ browser, baseURL }) => {
    test.skip(!baseURL, "baseURL is required");

    const admin = requireSession("admin");
    expectAdminSession(admin);

    for (const path of ADMIN_ROUTES) {
      const adminPage = await browser.newPage();
      await applySession(adminPage.context(), baseURL, admin);
      await adminPage.goto(path, { waitUntil: "domcontentloaded" });
      await adminPage.waitForLoadState("networkidle");
      await expect(adminPage).not.toHaveURL(/\/auth/);
      await expect(adminPage.locator(".admin-shell")).toBeVisible();
      await expect(adminPage.locator("body")).toContainText("Lenjoy Admin");
      await adminPage.close();
    }
  });

  test("guest and non-admin cannot see admin shell", async ({ browser, baseURL }) => {
    test.skip(!baseURL, "baseURL is required");

    const user = requireSession("user_a");

    for (const path of ADMIN_ROUTES) {
      const guestPage = await browser.newPage();
      await guestPage.goto(path, { waitUntil: "domcontentloaded" });
      await expect(guestPage).toHaveURL(/\/auth$/);
      await expect(guestPage.locator(".admin-shell")).toHaveCount(0);
      await guestPage.close();

      const userPage = await browser.newPage();
      await applySession(userPage.context(), baseURL, user);
      await userPage.goto(path, { waitUntil: "domcontentloaded" });
      await expect(userPage).toHaveURL(/\/auth$/);
      await expect(userPage.locator(".admin-shell")).toHaveCount(0);
      await userPage.close();
    }
  });
});
