import { uniqueTitle } from "./helpers/data";
import { expect, test } from "./fixtures/auth.fixture";

test.describe("post create", { tag: ["@p0", "@core"] }, () => {
  test("authenticated user can publish a normal post and land on its detail page", async ({
    baseURL,
    createRoleSession,
    getSession,
  }, testInfo) => {
    test.skip(!baseURL, "baseURL is required");

    const auth = getSession("user_a");
    if (!auth) {
      test.skip(true, "missing session: user_a");
      return;
    }

    const { page } = await createRoleSession("user_a");
    const title = uniqueTitle(testInfo, "E2E Normal Post");

    await page.goto("/posts/new", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "发布新帖子" })).toBeVisible();

    await page.getByLabel("标题").fill(title);
    await page
      .getByLabel("详细描述帖子内容...")
      .fill(`这是 ${title} 的正文内容。`);

    const publishResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/posts"),
    );
    await page.getByRole("button", { name: "发布帖子" }).click();

    const publishResponse = await publishResponsePromise;
    let publishPayload: unknown = null;
    try {
      publishPayload = await publishResponse.json();
    } catch {
      publishPayload = null;
    }
    expect(
      publishResponse.ok(),
      `publish response failed: ${publishResponse.status()} ${JSON.stringify(publishPayload)}`,
    ).toBeTruthy();

    await expect(page.getByText("发布成功")).toBeVisible();
    await expect(page).toHaveURL(/\/posts\/\d+$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(
      page.getByRole("main").getByText(auth.user.username, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(`这是 ${title} 的正文内容。`)).toBeVisible();
  });
});
