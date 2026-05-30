import { uniqueTitle } from "./helpers/data";
import {
  createPostViaApi,
  getPostDetailViaApi,
  getWalletSummary,
} from "./helpers/api";
import { expect, test } from "./fixtures/auth.fixture";

test.describe("resource purchase", { tag: ["@p0", "@core", "@wallet"] }, () => {
  test("user B purchases user A's resource post and unlocks hidden content", async ({
    baseURL,
    request,
    createRoleSession,
    getSession,
  }, testInfo) => {
    test.skip(!baseURL, "baseURL is required");

    const authA = getSession("user_a");
    const authB = getSession("user_b");
    test.skip(!authA || !authB, "missing session: user_a or user_b");

    // Check buyer has enough coins
    const walletBefore = await getWalletSummary(request, authB!);
    test.skip(walletBefore.availableCoins < 5, `user_b only has ${walletBefore.availableCoins} coins, need >= 5`);

    const walletABefore = await getWalletSummary(request, authA!);

    // Seed resource post via API
    const title = uniqueTitle(testInfo, "E2E Resource");
    const hiddenSecret = `SECRET-${Date.now()}`;
    const post = await createPostViaApi(request, authA!, {
      postType: "RESOURCE",
      title,
      content: `<p>${title} public content</p>`,
      hiddenContent: `<p>${hiddenSecret}</p>`,
      price: 5,
    });

    // User B opens resource detail — hidden content should NOT be visible
    const { page: pageB } = await createRoleSession("user_b");
    await pageB.goto(`/posts/${post.id}`, { waitUntil: "domcontentloaded" });
    await expect(pageB.getByRole("heading", { name: title })).toBeVisible();
    await expect(pageB.getByText("购买可见")).toBeVisible();
    await expect(pageB.getByText(hiddenSecret)).toHaveCount(0);

    // Click purchase button → confirm dialog
    await pageB.getByRole("button", { name: /金币购买/ }).click();
    await expect(pageB.getByText("确认购买资源")).toBeVisible();
    await pageB.getByRole("button", { name: /确认支付/ }).click();

    // Wait for purchase success
    await expect(pageB.getByText("购买成功，隐藏内容已解锁")).toBeVisible();

    // Hidden content should now be visible
    await expect(pageB.getByText(hiddenSecret)).toBeVisible();
    await expect(pageB.getByText("已解锁")).toBeVisible();

    // Refresh to confirm persistence
    await pageB.reload({ waitUntil: "domcontentloaded" });
    await expect(pageB.getByText(hiddenSecret)).toBeVisible();

    // --- API double-check: wallet balances ---
    const walletBAfter = await getWalletSummary(request, authB!);
    expect(walletBAfter.availableCoins).toBe(walletBefore.availableCoins - 5);

    const walletAAfter = await getWalletSummary(request, authA!);
    expect(walletAAfter.availableCoins).toBe(walletABefore.availableCoins + 5);

    // --- Check buyer's purchase records page ---
    await pageB.goto("/my/purchases", { waitUntil: "domcontentloaded" });
    await expect(pageB.getByText(title)).toBeVisible();

    // --- Check seller's sales records page ---
    const { page: pageA } = await createRoleSession("user_a");
    await pageA.goto("/my/sales", { waitUntil: "domcontentloaded" });
    await expect(pageA.getByText(title)).toBeVisible();
  });
});
