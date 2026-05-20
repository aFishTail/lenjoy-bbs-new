import { expect, test } from "./fixtures/auth.fixture";

test.describe("auth profile", { tag: ["@p0", "@auth", "@core"] }, () => {
  test("authenticated user can open profile and logout", async ({
    baseURL,
    createRoleSession,
    getSession,
  }) => {
    test.skip(!baseURL, "baseURL is required");

    const auth = getSession("user_a");
    test.skip(!auth, "missing session: user_a");

    const { page } = await createRoleSession("user_a");

    await page.goto("/my", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "个人中心" })).toBeVisible();
    await expect(page.getByText(auth.user.username, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "钱包详情" })).toBeVisible();
    await expect(page.getByRole("link", { name: "进入消息中心" })).toBeVisible();

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: auth.user.username }).click();
    await page.getByRole("button", { name: "退出登录" }).click();

    await expect(page).toHaveURL(/\/$/);
    const loginLink = page
      .getByRole("navigation")
      .getByRole("link", { name: "登录 / 注册" });
    await expect(loginLink).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(loginLink).toBeVisible();
  });
});