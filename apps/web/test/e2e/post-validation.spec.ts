import { uniqueTitle } from "./helpers/data";
import { expect, test } from "./fixtures/auth.fixture";

test.describe("post validation", { tag: ["@p0", "@core"] }, () => {
  test("empty title or content shows validation error and prevents submission", async ({
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

    // Attempt to submit with empty title
    await page.getByRole("button", { name: "发布帖子" }).click();

    // Should stay on the create page — no navigation to detail
    await expect(page).toHaveURL(/\/posts\/new/);

    // Fill title but leave body empty, then submit
    const title = uniqueTitle(testInfo, "E2E Validation");
    await page.getByLabel("标题").fill(title);
    await page.getByRole("button", { name: "发布帖子" }).click();

    // Should still not navigate away (content required)
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/posts\/new/);
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

    // Intercept and count publish requests
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
    // Double-click quickly
    await publishButton.dblclick();

    // Wait for navigation to detail page
    await expect(page).toHaveURL(/\/posts\/\d+$/, { timeout: 15_000 });

    // Only one successful publish should have occurred
    expect(publishCount).toBe(1);
  });
});
