import { expect, test } from "@playwright/test";

import { apiData } from "./helpers/api";
import { fixtureTitles, USER_ROUTES } from "./helpers/prd-fixtures";
import { applySession } from "./helpers/sessions";
import { expectSessionIdentity, requireSession, sessions } from "./helpers/session-checks";
import type { PostComment, PostDetail } from "./helpers/types";

test.describe("PRD authenticated flows", () => {
  test.skip(
    !sessions.user_a || !sessions.user_b,
    "auth-sessions.json is required for authenticated flows",
  );

  test("user pages, posts, resource flow, bounty flow, messages, reports", async ({
    browser,
    request,
    baseURL,
  }) => {
    test.skip(!baseURL, "baseURL is required");

    const userA = requireSession("user_a");
    const userB = requireSession("user_b");
    expectSessionIdentity(userA, "user_a");
    expectSessionIdentity(userB, "user_b");
    const titles = fixtureTitles();

    const userAPage = await browser.newPage();
    const userBPage = await browser.newPage();
    await applySession(userAPage.context(), baseURL, userA);
    await applySession(userBPage.context(), baseURL, userB);

    for (const path of USER_ROUTES) {
      await userAPage.goto(path, { waitUntil: "domcontentloaded" });
      await expect(userAPage.locator("main")).toBeVisible();
    }

    const normal = await apiData<{ id: number }>(request, "/api/posts", {
      method: "POST",
      auth: userA,
      data: {
        postType: "NORMAL",
        title: titles.normalTitle,
        content: `<p>${titles.normalTitle} content</p>`,
      },
    });
    const resource = await apiData<{ id: number }>(request, "/api/posts", {
      method: "POST",
      auth: userA,
      data: {
        postType: "RESOURCE",
        title: titles.resourceTitle,
        content: `<p>${titles.resourceTitle} public content</p>`,
        hiddenContent: `<p>${titles.hiddenSecret}</p>`,
        price: 5,
      },
    });
    const bounty = await apiData<{ id: number }>(request, "/api/posts", {
      method: "POST",
      auth: userA,
      data: {
        postType: "BOUNTY",
        title: titles.bountyTitle,
        content: `<p>${titles.bountyTitle} question content</p>`,
        bountyAmount: 5,
        bountyExpireAt: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
      },
    });

    for (const postId of [normal.id, resource.id, bounty.id]) {
      await userAPage.goto(`/posts/${postId}`, { waitUntil: "domcontentloaded" });
      await expect(userAPage.locator("main")).toBeVisible();
    }

    const prePurchase = await apiData<PostDetail>(request, `/api/posts/${resource.id}`, {
      auth: userB,
    });
    expect(prePurchase.purchased).not.toBeTruthy();
    expect(prePurchase.hiddenContent || "").not.toContain(titles.hiddenSecret);

    await apiData<PostDetail>(request, `/api/posts/${resource.id}/purchase`, {
      method: "POST",
      auth: userB,
    });
    const postPurchase = await apiData<PostDetail>(request, `/api/posts/${resource.id}`, {
      auth: userB,
    });
    expect(postPurchase.purchased).toBeTruthy();
    expect(postPurchase.hiddenContent || "").toContain(titles.hiddenSecret);

    await userBPage.goto(`/posts/${resource.id}`, { waitUntil: "domcontentloaded" });
    await expect(userBPage.locator("body")).toContainText(titles.hiddenSecret);
    await userBPage.goto("/my/purchases", { waitUntil: "domcontentloaded" });
    await expect(userBPage.locator("body")).toContainText(titles.resourceTitle);

    await userAPage.goto("/my/sales", { waitUntil: "domcontentloaded" });
    await expect(userAPage.locator("body")).toContainText(titles.resourceTitle);

    const createdAnswer = await apiData<PostComment>(request, `/api/posts/${bounty.id}/comments`, {
      method: "POST",
      auth: userB,
      data: { parentId: null, content: titles.answerContent },
    });
    expect(createdAnswer.id).toBeGreaterThan(0);

    const comments = await apiData<PostComment[]>(request, `/api/posts/${bounty.id}/comments`, {
      auth: userA,
    });
    const candidate = comments.find((item) => item.id === createdAnswer.id);
    expect(candidate).toBeTruthy();

    await apiData(request, `/api/posts/${bounty.id}/comments/${candidate!.id}/accept`, {
      method: "POST",
      auth: userA,
    });
    const bountyDetail = await apiData<PostDetail>(request, `/api/posts/${bounty.id}`, {
      auth: userA,
    });
    expect(bountyDetail.bountyStatus).toBe("RESOLVED");
    expect(bountyDetail.acceptedCommentId).toBe(candidate!.id);

    await apiData(request, `/api/posts/${normal.id}/likes/toggle`, {
      method: "POST",
      auth: userB,
    });
    await apiData(request, `/api/posts/${normal.id}/favorites/toggle`, {
      method: "POST",
      auth: userB,
    });
    await apiData(request, `/api/posts/${resource.id}/reports`, {
      method: "POST",
      auth: userB,
      data: { reason: "RESOURCE_INVALID", detail: "E2E generated report" },
    });
    await apiData(request, `/api/comments/${candidate!.id}/reports`, {
      method: "POST",
      auth: userA,
      data: { reason: "OTHER", detail: "E2E generated comment report" },
    });
    await apiData(request, `/api/resource-purchases/${postPurchase.purchaseId}/appeal`, {
      method: "POST",
      auth: userB,
      data: { reason: "E2E appeal", detail: "Generated by automation" },
    });

    await userAPage.goto("/my/messages", { waitUntil: "domcontentloaded" });
    await expect(userAPage.locator("main")).toBeVisible();
    await userBPage.goto("/my/messages", { waitUntil: "domcontentloaded" });
    await expect(userBPage.locator("main")).toBeVisible();

    await userAPage.close();
    await userBPage.close();
  });
});
