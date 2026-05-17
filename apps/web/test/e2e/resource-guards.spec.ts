import { uniqueTitle } from "./helpers/data";
import {
  createPostViaApi,
  getPostDetailViaApi,
  getWalletSummary,
  purchaseResourceViaApi,
} from "./helpers/api";
import { expect, test } from "./fixtures/auth.fixture";

test.describe("resource guards", { tag: ["@p0", "@core"] }, () => {
  test("duplicate purchase is blocked and author cannot buy own resource", async ({
    baseURL,
    request,
    createRoleSession,
    getSession,
  }, testInfo) => {
    test.skip(!baseURL, "baseURL is required");

    const authA = getSession("user_a");
    const authB = getSession("user_b");
    test.skip(!authA || !authB, "missing session: user_a or user_b");

    const walletB = await getWalletSummary(request, authB!);
    test.skip(walletB.availableCoins < 3, `user_b only has ${walletB.availableCoins} coins, need >= 3`);

    // Seed resource post and complete first purchase via API
    const title = uniqueTitle(testInfo, "E2E Guard");
    const post = await createPostViaApi(request, authA!, {
      postType: "RESOURCE",
      title,
      content: `<p>${title} public</p>`,
      hiddenContent: `<p>guard-secret</p>`,
      price: 3,
    });

    // First purchase should succeed
    const firstPurchase = await purchaseResourceViaApi(request, authB!, post.id);
    expect(firstPurchase.ok).toBeTruthy();

    // Record buyer wallet after first purchase
    const walletBAfterFirst = await getWalletSummary(request, authB!);

    // --- Duplicate purchase via API should fail ---
    const dupPurchase = await purchaseResourceViaApi(request, authB!, post.id);
    expect(dupPurchase.ok).toBeFalsy();
    expect(dupPurchase.status).toBe(400);

    // Buyer wallet should NOT change
    const walletBAfterDup = await getWalletSummary(request, authB!);
    expect(walletBAfterDup.availableCoins).toBe(walletBAfterFirst.availableCoins);

    // --- User B opens the post: should see "已解锁", no purchase button ---
    const { page: pageB } = await createRoleSession("user_b");
    await pageB.goto(`/posts/${post.id}`, { waitUntil: "domcontentloaded" });
    await expect(pageB.getByText("已解锁")).toBeVisible();
    // The purchase button (金币购买) should NOT be visible
    await expect(pageB.getByRole("button", { name: /金币购买/ })).toHaveCount(0);

    // --- Author (user A) opens own resource: no purchase button ---
    const { page: pageA } = await createRoleSession("user_a");
    await pageA.goto(`/posts/${post.id}`, { waitUntil: "domcontentloaded" });
    // Author should see hidden content directly (they're the owner)
    await expect(pageA.getByText("guard-secret")).toBeVisible();
    // Author should NOT see a purchase button
    await expect(pageA.getByRole("button", { name: /金币购买/ })).toHaveCount(0);

    // --- Self-purchase via API should also fail ---
    const selfPurchase = await purchaseResourceViaApi(request, authA!, post.id);
    expect(selfPurchase.ok).toBeFalsy();
    expect(selfPurchase.status).toBe(400);
  });
});
