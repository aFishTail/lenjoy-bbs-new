import { uniqueTitle } from "./helpers/data";
import {
  createPostViaApi,
  getWalletSummary,
  submitCommentViaApi,
} from "./helpers/api";
import { expect, test } from "./fixtures/auth.fixture";

test.describe("bounty flow", { tag: ["@p0", "@core", "@wallet"] }, () => {
  test("user A publishes bounty, user B answers, user A accepts and wallets settle", async ({
    baseURL,
    request,
    createRoleSession,
    getSession,
  }, testInfo) => {
    test.skip(!baseURL, "baseURL is required");

    const authA = getSession("user_a");
    const authB = getSession("user_b");
    test.skip(!authA || !authB, "missing session: user_a or user_b");

    // Check user A has enough coins for bounty
    const walletABefore = await getWalletSummary(request, authA!);
    test.skip(walletABefore.availableCoins < 5, `user_a only has ${walletABefore.availableCoins} coins, need >= 5`);

    const walletBBefore = await getWalletSummary(request, authB!);

    // --- User A creates bounty post via API ---
    const title = uniqueTitle(testInfo, "E2E Bounty");
    const post = await createPostViaApi(request, authA!, {
      postType: "BOUNTY",
      title,
      content: `<p>${title} question</p>`,
      bountyAmount: 5,
      bountyExpireAt: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    });

    // --- Verify frozen coins after bounty creation ---
    const walletAAfterCreate = await getWalletSummary(request, authA!);
    expect(walletAAfterCreate.frozenCoins).toBe(walletABefore.frozenCoins + 5);
    expect(walletAAfterCreate.availableCoins).toBe(walletABefore.availableCoins - 5);

    // --- User B opens bounty detail and submits answer via page ---
    const { page: pageB } = await createRoleSession("user_b");
    await pageB.goto(`/posts/${post.id}`, { waitUntil: "domcontentloaded" });
    await expect(pageB.getByRole("heading", { name: title })).toBeVisible();
    await expect(pageB.getByText("悬赏 进行中")).toBeVisible();

    // Fill the answer editor
    const answerContent = `Bounty answer ${Date.now()}`;
    await pageB.locator(".tiptap.ProseMirror").first().click();
    await pageB.locator(".tiptap.ProseMirror").first().fill(answerContent);
    await pageB.getByRole("button", { name: "提交答案" }).click();

    // Wait for toast
    await expect(pageB.getByText("评论已提交").or(pageB.getByText("回复已发送"))).toBeVisible();

    // --- User A opens the bounty and sees the answer ---
    const { page: pageA } = await createRoleSession("user_a");
    await pageA.goto(`/posts/${post.id}`, { waitUntil: "domcontentloaded" });
    await expect(pageA.getByText(answerContent)).toBeVisible();

    // --- User A accepts the answer ---
    await pageA.getByRole("button", { name: "采纳答案" }).click();
    await expect(pageA.getByText("已采纳该答案，悬赏已完成结算")).toBeVisible();
    await expect(pageA.getByText("已采纳")).toBeVisible();

    // Verify bounty status changed
    await pageA.reload({ waitUntil: "domcontentloaded" });
    await expect(pageA.getByText("悬赏 已采纳")).toBeVisible();

    // --- API double-check: wallet settlement ---
    const walletAAfterAccept = await getWalletSummary(request, authA!);
    expect(walletAAfterAccept.frozenCoins).toBe(walletABefore.frozenCoins);
    expect(walletAAfterAccept.availableCoins).toBe(walletABefore.availableCoins - 5);
    expect(walletAAfterAccept.totalCoins).toBe(walletABefore.totalCoins - 5);

    const walletBAfterAccept = await getWalletSummary(request, authB!);
    expect(walletBAfterAccept.availableCoins).toBe(walletBBefore.availableCoins + 5);
  });
});
