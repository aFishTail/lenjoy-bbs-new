import { expect, test } from "./fixtures/auth.fixture";

test.describe("admin access", { tag: ["@p0", "@admin", "@core"] }, () => {
  test("guest and non-admin cannot access admin, but admin can", async ({
    baseURL,
    browser,
    createRoleSession,
    getSession,
  }) => {
    test.skip(!baseURL, "baseURL is required");

    const guestPage = await browser.newPage();
    await guestPage.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(guestPage).toHaveURL(/\/auth$/);
    await expect(guestPage.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
    await guestPage.close();

    const user = getSession("user_b");
    test.skip(!user, "missing session: user_b");
    const userSession = await createRoleSession("user_b");
    await userSession.page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(userSession.page).toHaveURL(/\/$/);
    await expect(userSession.page.getByText("你没有管理员权限")).toBeVisible();
    await expect(userSession.page.locator(".admin-shell")).toHaveCount(0);

    const admin = getSession("admin");
    test.skip(!admin, "missing session: admin");
    const adminSession = await createRoleSession("admin");
    await adminSession.page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(adminSession.page).toHaveURL(/\/admin$/);
    await expect(adminSession.page.getByRole("heading", { name: "管理后台" })).toBeVisible();
    await expect(adminSession.page.getByText("Lenjoy Admin")).toBeVisible();
  });
});