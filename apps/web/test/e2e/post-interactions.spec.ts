import { uniqueTitle } from "./helpers/data";
import { createPostViaApi } from "./helpers/api";
import { expect, test } from "./fixtures/auth.fixture";

test.describe("post interactions", { tag: ["@p0", "@core"] }, () => {
  test("user B can comment, like and favorite user A's post, then undo", async ({
    baseURL,
    request,
    createRoleSession,
    getSession,
  }, testInfo) => {
    test.skip(!baseURL, "baseURL is required");

    const authA = getSession("user_a");
    const authB = getSession("user_b");
    test.skip(!authA || !authB, "missing session: user_a or user_b");

    // Seed a normal post via API
    const title = uniqueTitle(testInfo, "E2E Interact");
    const post = await createPostViaApi(request, authA!, {
      postType: "NORMAL",
      title,
      content: `<p>${title} body</p>`,
    });

    // User B opens the post detail
    const { page } = await createRoleSession("user_b");
    await page.goto(`/posts/${post.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    // --- Comment ---
    const commentContent = `E2E comment ${Date.now()}`;
    await page.getByLabel("详细描述帖子内容...").or(page.locator(".tiptap.ProseMirror")).first().click();
    await page.locator(".tiptap.ProseMirror").first().fill(commentContent);
    await page.getByRole("button", { name: "发表评论" }).click();
    await expect(page.getByText("评论已提交")).toBeVisible();
    await expect(page.getByText(commentContent)).toBeVisible();

    // --- Like ---
    const likeButton = page.getByRole("button", { name: /点赞/ }).first();
    await likeButton.click();
    await expect(likeButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("已赞")).toBeVisible();

    // --- Favorite ---
    const favButton = page.getByRole("button", { name: /收藏/ }).first();
    await favButton.click();
    await expect(page.getByText("已收藏")).toBeVisible();

    // --- Refresh and verify persistence ---
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(commentContent)).toBeVisible();
    await expect(page.getByText("已赞")).toBeVisible();
    await expect(page.getByText("已收藏")).toBeVisible();

    // --- Undo like and favorite ---
    await page.getByRole("button", { name: /点赞/ }).first().click();
    await expect(page.getByText("已赞")).toHaveCount(0);

    await page.getByRole("button", { name: /收藏/ }).first().click();
    await expect(page.getByText("已收藏")).toHaveCount(0);
  });
});
