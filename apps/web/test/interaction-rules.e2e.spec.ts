import { expect, test } from "@playwright/test";

import { apiData, apiResponse } from "./helpers/api";
import { fixtureTitles } from "./helpers/prd-fixtures";
import { expectSessionIdentity, requireSession, sessions } from "./helpers/session-checks";

type SiteMessage = {
  id: number;
  messageType: string;
  read: boolean;
  actionUrl?: string | null;
};

test.describe("PRD interaction and edge rules", () => {
  test.skip(
    !sessions.user_a || !sessions.user_b,
    "auth-sessions.json is required for interaction rules",
  );

  test("message read flow, self-purchase, self-follow and repeat-purchase guards", async ({
    request,
  }) => {
    const userA = requireSession("user_a");
    const userB = requireSession("user_b");
    expectSessionIdentity(userA, "user_a");
    expectSessionIdentity(userB, "user_b");

    const titles = fixtureTitles();

    const resource = await apiData<{ id: number }>(request, "/api/posts", {
      method: "POST",
      auth: userA,
      data: {
        postType: "RESOURCE",
        title: `${titles.resourceTitle} Guards`,
        content: `<p>${titles.resourceTitle} guards public content</p>`,
        hiddenContent: `<p>${titles.hiddenSecret}-guards</p>`,
        price: 3,
      },
    });

    const selfPurchase = await apiResponse<unknown>(request, `/api/posts/${resource.id}/purchase`, {
      method: "POST",
      auth: userA,
    });
    expect(selfPurchase.ok).toBeFalsy();
    expect(selfPurchase.status).toBe(400);
    expect(selfPurchase.payload.code).toBe("INVALID_OPERATION");

    await apiData(request, `/api/posts/${resource.id}/purchase`, {
      method: "POST",
      auth: userB,
    });

    const duplicatePurchase = await apiResponse<unknown>(request, `/api/posts/${resource.id}/purchase`, {
      method: "POST",
      auth: userB,
    });
    expect(duplicatePurchase.ok).toBeFalsy();
    expect(duplicatePurchase.status).toBe(400);
    expect(duplicatePurchase.payload.code).toBe("RESOURCE_ALREADY_PURCHASED");

    const selfFollow = await apiResponse<unknown>(request, `/api/users/${userB.user.id}/follow/toggle`, {
      method: "POST",
      auth: userB,
    });
    expect(selfFollow.ok).toBeFalsy();
    expect(selfFollow.status).toBe(400);

    await apiData(request, `/api/posts/${resource.id}/likes/toggle`, {
      method: "POST",
      auth: userB,
    });
    await apiData(request, `/api/posts/${resource.id}/favorites/toggle`, {
      method: "POST",
      auth: userB,
    });

    const unreadBefore = await apiData<number>(request, "/api/users/me/messages/unread-count", {
      auth: userA,
    });
    expect(unreadBefore).toBeGreaterThan(0);

    const messages = await apiData<SiteMessage[]>(request, "/api/users/me/messages?limit=20", {
      auth: userA,
    });
    expect(messages.length).toBeGreaterThan(0);
    expect(
      messages.some(
        (item) =>
          item.messageType === "POST_LIKED" || item.messageType === "POST_FAVORITED",
      ),
    ).toBeTruthy();

    const unreadMessage = messages.find((item) => !item.read) || messages[0];
    await apiData<SiteMessage>(request, `/api/users/me/messages/${unreadMessage.id}/read`, {
      method: "PATCH",
      auth: userA,
    });

    const markAll = await apiData<number>(request, "/api/users/me/messages/read-all", {
      method: "PATCH",
      auth: userA,
    });
    expect(markAll).toBeGreaterThanOrEqual(0);

    const unreadAfter = await apiData<number>(request, "/api/users/me/messages/unread-count", {
      auth: userA,
    });
    expect(unreadAfter).toBe(0);
  });
});
