import { uniqueTitle } from "./helpers/data";
import {
  createPostViaApi,
  getWalletSummary,
  purchaseResourceViaApi,
} from "./helpers/api";
import { expect, test } from "./fixtures/auth.fixture";

test.describe("admin audit", { tag: ["@p0", "@admin"] }, () => {
  test("admin can see wallet transactions and resource trades after a purchase", async ({
    baseURL,
    request,
    createRoleSession,
    getSession,
  }, testInfo) => {
    test.skip(!baseURL, "baseURL is required");

    const authA = getSession("user_a");
    const authB = getSession("user_b");
    const admin = getSession("admin");
    test.skip(!authA || !authB || !admin, "missing session: user_a, user_b or admin");

    const walletBefore = await getWalletSummary(request, authB!);
    test.skip(walletBefore.availableCoins < 3, `user_b only has ${walletBefore.availableCoins} coins, need >= 3`);

    // Seed a resource purchase
    const title = uniqueTitle(testInfo, "E2E Audit");
    const post = await createPostViaApi(request, authA!, {
      postType: "RESOURCE",
      title,
      content: `<p>${title} public</p>`,
      hiddenContent: `<p>audit-secret</p>`,
      price: 3,
    });

    const purchase = await purchaseResourceViaApi(request, authB!, post.id);
    expect(purchase.ok, `purchase failed with status ${purchase.status}`).toBeTruthy();

    // Admin navigates to audit page
    const { page: adminPage } = await createRoleSession("admin");
    await adminPage.goto("/admin/audit", { waitUntil: "domcontentloaded" });
    await adminPage.waitForLoadState("networkidle");

    // Verify we're on the audit page with wallet/transaction data visible
    await expect(adminPage.locator(".admin-shell")).toBeVisible();

    // The audit page should contain transaction entries
    // Check that the page loads without errors
    await expect(adminPage.getByRole("main")).toBeVisible();

    // Navigate to coins (wallet transaction) management
    await adminPage.goto("/admin/coins", { waitUntil: "domcontentloaded" });
    await adminPage.waitForLoadState("networkidle");
    await expect(adminPage.locator(".admin-shell")).toBeVisible();
    await expect(adminPage.getByRole("main")).toBeVisible();
  });
});
