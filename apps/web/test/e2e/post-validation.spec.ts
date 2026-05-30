import { uniqueTitle } from "./helpers/data";
import { expect, test } from "./fixtures/auth.fixture";

test.describe("post validation", { tag: ["@p0", "@core"] }, () => {
  test("empty fields show field-level validation errors and prevent submission", async ({
    baseURL,
    createRoleSession,
    getSession,
  }, testInfo) => {
    test.skip(!baseURL, "baseURL is required");

    const auth = getSession("user_a");
    test.skip(!auth, "missing session: user_a");

    const { page } = await createRoleSession("user_a");

    await page.goto("/posts/new", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "发布新帖子" })).toBeVisible();

    await page.getByRole("button", { name: "发布帖子" }).click();
    await expect(page).toHaveURL(/\/posts\/new/);
    await expect(page.getByText("请输入标题")).toBeVisible();

    const title = uniqueTitle(testInfo, "E2E Validation");
    await page.getByLabel("标题").fill(title);
    await page.getByRole("button", { name: "发布帖子" }).click();

    await expect(page).toHaveURL(/\/posts\/new/);
    await expect(page.getByText("请输入正文")).toBeVisible();

    await page
      .getByLabel("详细描述帖子内容...")
      .fill(`${title} body content`);
    await page.getByRole("button", { name: /资源帖/ }).click();
    await page.getByRole("button", { name: "发布帖子" }).click();

    await expect(page).toHaveURL(/\/posts\/new/);
    await expect(page.getByText("请填写资源隐藏内容")).toBeVisible();
    await expect(page.getByText("请设置资源售价")).toBeVisible();

    await page.getByRole("button", { name: /悬赏帖/ }).click();
    await page.getByRole("button", { name: "发布帖子" }).click();

    await expect(page).toHaveURL(/\/posts\/new/);
    await expect(page.getByText("请设置悬赏金额")).toBeVisible();
    await expect(page.getByText("请设置截止时间")).toBeVisible();
  });

  test("rapid double-click only creates one post", async ({
    baseURL,
    createRoleSession,
    getSession,
  }, testInfo) => {
    test.skip(!baseURL, "baseURL is required");

    const auth = getSession("user_a");
    test.skip(!auth, "missing session: user_a");

    const { page } = await createRoleSession("user_a");
    const title = uniqueTitle(testInfo, "E2E DoubleSubmit");

    await page.goto("/posts/new", { waitUntil: "domcontentloaded" });
    await page.getByLabel("标题").fill(title);
    await page
      .getByLabel("详细描述帖子内容...")
      .fill(`${title} body content`);

    let publishCount = 0;
    page.on("response", (response) => {
      if (
        response.request().method() === "POST" &&
        response.url().includes("/api/posts") &&
        !response.url().includes("/comments") &&
        !response.url().includes("/purchase") &&
        !response.url().includes("/likes") &&
        !response.url().includes("/favorites") &&
        !response.url().includes("/views")
      ) {
        publishCount++;
      }
    });

    const publishButton = page.getByRole("button", { name: "发布帖子" });
    await publishButton.dblclick();

    await expect(page).toHaveURL(/\/posts\/\d+$/, { timeout: 15_000 });
    expect(publishCount).toBe(1);
  });
});
