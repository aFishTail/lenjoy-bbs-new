import { uniqueTitle } from "./helpers/data";
import {
  acceptAnswerViaApi,
  createPostViaApi,
  getPostCommentsViaApi,
  submitCommentViaApi,
} from "./helpers/api";
import { expect, test } from "./fixtures/auth.fixture";

test.describe("bounty visibility", { tag: ["@p0", "@core"] }, () => {
  test("answers are masked by viewer role before and after acceptance", async ({
    baseURL,
    browser,
    request,
    createRoleSession,
    getSession,
  }, testInfo) => {
    test.skip(!baseURL, "baseURL is required");

    const authA = getSession("user_a");
    const authB = getSession("user_b");
    const authC = getSession("user_c");
    test.skip(!authA || !authB, "missing session: user_a or user_b");
    test.skip(!authC, "missing session: user_c (needed for bounty visibility)");

    // --- Seed bounty post ---
    const title = uniqueTitle(testInfo, "E2E BountyVis");
    const post = await createPostViaApi(request, authA!, {
      postType: "BOUNTY",
      title,
      content: `<p>${title} question</p>`,
      bountyAmount: 5,
      bountyExpireAt: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    });

    // User B and User C submit answers via API
    const answerB = await submitCommentViaApi(
      request, authB!, post.id, `<p>Answer from B ${Date.now()}</p>`,
    );
    const answerC = await submitCommentViaApi(
      request, authC!, post.id, `<p>Answer from C ${Date.now()}</p>`,
    );

    // --- API-level visibility check (before acceptance) ---

    // Author (user A) sees all answers
    const commentsAsA = await getPostCommentsViaApi(request, post.id, authA!);
    expect(commentsAsA.length).toBe(2);

    // Answerer B sees only their own answer
    const commentsAsB = await getPostCommentsViaApi(request, post.id, authB!);
    expect(commentsAsB.length).toBe(1);
    expect(commentsAsB[0].id).toBe(answerB.id);

    // Guest sees no answers
    const commentsAsGuest = await getPostCommentsViaApi(request, post.id);
    expect(commentsAsGuest.length).toBe(0);

    // --- Page-level visibility check ---

    // User A page: can see both answers
    const { page: pageA } = await createRoleSession("user_a");
    await pageA.goto(`/posts/${post.id}`, { waitUntil: "domcontentloaded" });
    await expect(pageA.getByText("2 条一级答案")).toBeVisible();

    // User B page: sees only their own answer
    const { page: pageB } = await createRoleSession("user_b");
    await pageB.goto(`/posts/${post.id}`, { waitUntil: "domcontentloaded" });
    // User B should see a hint about answer count
    await expect(pageB.getByText(/2 人参与回答/)).toBeVisible();

    // Guest page: sees answer count hint but no answer content
    const guestPage = await browser.newPage();
    await guestPage.goto(`/posts/${post.id}`, { waitUntil: "domcontentloaded" });
    await expect(guestPage.getByText(/2 人参与回答/)).toBeVisible();
    await expect(guestPage.getByText("当前暂无你可查看的答案")).toBeVisible();

    // --- Accept user B's answer ---
    await acceptAnswerViaApi(request, authA!, post.id, answerB.id);

    // --- Post-acceptance visibility ---

    // Guest: sees accepted answer stub with "被采纳" but no full content
    await guestPage.reload({ waitUntil: "domcontentloaded" });
    const resolvedGuestComments = await getPostCommentsViaApi(request, post.id);
    expect(resolvedGuestComments.length).toBe(1);
    expect(resolvedGuestComments[0].id).toBe(answerB.id);
    expect(resolvedGuestComments[0].canViewContent).toBe(false);
    expect(resolvedGuestComments[0].maskedSummary).toContain("被采纳");

    await guestPage.close();
  });
});
