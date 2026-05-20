import { uniqueTitle } from "./helpers/data";
import {
  createPostViaApi,
  getMessages,
  getUnreadCount,
  getWalletSummary,
  markAllMessagesRead,
  purchaseResourceViaApi,
} from "./helpers/api";
import { expect, test } from "./fixtures/auth.fixture";

test.describe("messages", { tag: ["@p0", "@core"] }, () => {
  test("resource purchase generates notifications for buyer and seller", async ({
    baseURL,
    request,
    createRoleSession,
    getSession,
  }, testInfo) => {
    test.skip(!baseURL, "baseURL is required");

    const authA = getSession("user_a");
    const authB = getSession("user_b");
    test.skip(!authA || !authB, "missing session: user_a or user_b");

    const walletBefore = await getWalletSummary(request, authB!);
    test.skip(walletBefore.availableCoins < 3, `user_b only has ${walletBefore.availableCoins} coins, need >= 3`);

    // Clear existing unread messages for both users
    await markAllMessagesRead(request, authA!);
    await markAllMessagesRead(request, authB!);

    // Seed a resource post and have user B purchase it
    const title = uniqueTitle(testInfo, "E2E Msg");
    const post = await createPostViaApi(request, authA!, {
      postType: "RESOURCE",
      title,
      content: `<p>${title} public</p>`,
      hiddenContent: `<p>msg-secret</p>`,
      price: 3,
    });

    const purchase = await purchaseResourceViaApi(request, authB!, post.id);
    expect(purchase.ok, `purchase failed with status ${purchase.status}`).toBeTruthy();

    // --- Check seller (user A) messages ---
    const sellerMessages = await getMessages(request, authA!);
    const sellerSaleMsg = sellerMessages.find(
      (m) => m.messageType === "RESOURCE_SOLD" || m.messageType === "RESOURCE_PURCHASE",
    );
    expect(sellerSaleMsg, "seller should receive sale notification").toBeTruthy();

    const sellerUnread = await getUnreadCount(request, authA!);
    expect(sellerUnread).toBeGreaterThan(0);

    // --- Check buyer (user B) messages ---
    const buyerMessages = await getMessages(request, authB!);
    const buyerPurchaseMsg = buyerMessages.find(
      (m) => m.messageType === "RESOURCE_PURCHASED" || m.messageType === "RESOURCE_PURCHASE",
    );
    expect(buyerPurchaseMsg, "buyer should receive purchase notification").toBeTruthy();

    // --- Page-level: user A opens messages page ---
    const { page: pageA } = await createRoleSession("user_a");
    await pageA.goto("/my/messages", { waitUntil: "domcontentloaded" });
    await expect(pageA.getByRole("main")).toBeVisible();

    // --- Page-level: user B opens messages page ---
    const { page: pageB } = await createRoleSession("user_b");
    await pageB.goto("/my/messages", { waitUntil: "domcontentloaded" });
    await expect(pageB.getByRole("main")).toBeVisible();

    // --- Mark all read and verify count drops to 0 ---
    await markAllMessagesRead(request, authA!);
    const sellerUnreadAfter = await getUnreadCount(request, authA!);
    expect(sellerUnreadAfter).toBe(0);
  });
});
