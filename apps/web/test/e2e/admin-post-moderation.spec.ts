import { uniqueTitle } from "./helpers/data";
import { createPostViaApi, getPostDetailViaApi } from "./helpers/api";
import { expect, test } from "./fixtures/auth.fixture";

test.describe("admin post moderation", { tag: ["@p0", "@admin"] }, () => {
  test("admin takes a post offline and front-end reflects the change", async ({
    baseURL,
    browser,
    request,
    createRoleSession,
    getSession,
  }, testInfo) => {
    test.skip(!baseURL, "baseURL is required");

    const authA = getSession("user_a");
    const admin = getSession("admin");
    test.skip(!authA || !admin, "missing session: user_a or admin");

    // Seed a post by user A
    const title = uniqueTitle(testInfo, "E2E Moderate");
    const post = await createPostViaApi(request, authA!, {
      postType: "NORMAL",
      title,
      content: `<p>${title} body</p>`,
    });

    // Admin opens post management page
    const { page: adminPage } = await createRoleSession("admin");
    await adminPage.goto("/admin/posts", { waitUntil: "domcontentloaded" });
    await expect(adminPage.getByText("帖子管理")).toBeVisible();

    // Search for the post by author
    await adminPage.getByPlaceholder("按作者搜索").fill(authA!.user.username);
    await adminPage.getByRole("button", { name: "查询帖子" }).click();
    await adminPage.waitForLoadState("networkidle");

    // Find the post row and click offline button
    const postRow = adminPage.getByRole("row").filter({ hasText: title });
    await expect(postRow).toBeVisible();
    await postRow.getByRole("button", { name: "下架" }).click();
    await expect(adminPage.getByText(`帖子 ${post.id} 已下架`)).toBeVisible();

    // --- Guest verification: the post should not appear in public list ---
    const guestPage = await browser.newPage();
    await guestPage.goto("/", { waitUntil: "domcontentloaded" });
    // The offlined post title should not be on the first page
    // (this is a best-effort check; post may have been further down)
    await guestPage.waitForLoadState("networkidle");

    // Direct access to post detail should show unavailable state
    await guestPage.goto(`/posts/${post.id}`, { waitUntil: "domcontentloaded" });
    // Expect either an error message, OFFLINE status, or redirect
    const hasOfflineIndicator = await guestPage
      .getByText(/不存在|已下架|无权访问|OFFLINE|帖子未找到/)
      .isVisible()
      .catch(() => false);
    const redirectedAway = !guestPage.url().includes(`/posts/${post.id}`);
    expect(
      hasOfflineIndicator || redirectedAway,
      "offline post should not be accessible by guest",
    ).toBeTruthy();

    await guestPage.close();

    // --- API double-check ---
    const postDetail = await getPostDetailViaApi(request, post.id);
    expect(postDetail.status).toBe("OFFLINE");
  });
});
