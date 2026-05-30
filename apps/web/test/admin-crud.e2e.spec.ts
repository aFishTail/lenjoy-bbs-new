import { expect, test } from "@playwright/test";

import { apiData } from "./helpers/api";
import { applySession } from "./helpers/sessions";
import { expectAdminSession, requireSession, sessions } from "./helpers/session-checks";

type CategorySummary = {
  id: number;
  name: string;
  contentType: string;
  status: string;
  sort: number;
};

type TagSummary = {
  id: number;
  name: string;
  status: string;
};

type AdminUserSummary = {
  id: number;
  username: string;
  status: string;
};

type PostSummary = {
  id: number;
  title: string;
  status: string;
};

type OpenApiClientSummary = {
  id: number;
  name: string;
  status: string;
  bindingCount: number;
};

type OpenApiBindingSummary = {
  id: number;
  bindingCode: string;
  userId: number;
  status: string;
};

test.describe("admin CRUD modules", () => {
  test.skip(!sessions.admin, "auth-sessions.json admin session is required");

  test("admin can manage taxonomy, posts, users, coins, audit, and Open API", async ({
    page,
    request,
    baseURL,
    }) => {
    test.skip(!baseURL, "baseURL is required");
    const resolvedBaseURL = baseURL!;

    const admin = requireSession("admin");
    expectAdminSession(admin);
    const stamp = Date.now();
    const cleanup: Array<() => Promise<unknown>> = [];

    try {
    await applySession(page.context(), resolvedBaseURL, admin);
    await page.goto("/admin/posts", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".admin-shell")).toBeVisible();
    await expect(page.locator("body")).toContainText("帖子管理");

    const categoryName = `E2E Category ${stamp}`;
    const category = await apiData<CategorySummary>(request, "/api/admin/categories", {
      method: "POST",
      auth: admin,
      data: {
        name: categoryName,
        slug: `e2e-category-${stamp}`,
        contentType: "NORMAL",
        parentId: 0,
        sort: 10,
        isLeaf: true,
      },
    });
    cleanup.push(() =>
      apiData(request, `/api/admin/categories/${category.id}`, {
        method: "DELETE",
        auth: admin,
      }),
    );
    expect(category.name).toBe(categoryName);
    const normalCategories = await apiData<CategorySummary[]>(
      request,
      "/api/admin/categories?contentType=NORMAL",
      { auth: admin },
    );
    expect(normalCategories.some((item) => item.id === category.id)).toBeTruthy();
    const resourceCategories = await apiData<CategorySummary[]>(
      request,
      "/api/admin/categories?contentType=RESOURCE",
      { auth: admin },
    );
    expect(resourceCategories.some((item) => item.id === category.id)).toBeFalsy();

    const updatedCategory = await apiData<CategorySummary>(
      request,
      `/api/admin/categories/${category.id}`,
      {
        method: "PUT",
        auth: admin,
        data: {
          name: `${categoryName} Updated`,
          slug: `e2e-category-${stamp}-updated`,
          contentType: "NORMAL",
          parentId: 0,
          sort: 20,
          isLeaf: true,
        },
      },
    );
    expect(updatedCategory.sort).toBe(20);

    const inactiveCategory = await apiData<CategorySummary>(
      request,
      `/api/admin/categories/${category.id}/status`,
      {
        method: "PATCH",
        auth: admin,
        data: { status: "INACTIVE" },
      },
    );
    expect(inactiveCategory.status).toBe("INACTIVE");

    const tagName = `e2e-tag-${stamp}`;
    const targetTag = await apiData<TagSummary>(request, "/api/admin/tags", {
      method: "POST",
      auth: admin,
      data: { name: `${tagName}-target`, slug: `${tagName}-target` },
    });
    cleanup.push(() => apiData(request, `/api/admin/tags/${targetTag.id}`, { method: "DELETE", auth: admin }));
    const tag = await apiData<TagSummary>(request, "/api/admin/tags", {
      method: "POST",
      auth: admin,
      data: { name: tagName, slug: tagName },
    });
    cleanup.push(() => apiData(request, `/api/admin/tags/${tag.id}`, { method: "DELETE", auth: admin }));
    expect(tag.name).toBe(tagName);
    const matchingTags = await apiData<TagSummary[]>(
      request,
      `/api/admin/tags?keyword=${encodeURIComponent(tagName)}`,
      { auth: admin },
    );
    expect(matchingTags.some((item) => item.id === tag.id)).toBeTruthy();

    const updatedTag = await apiData<TagSummary>(request, `/api/admin/tags/${tag.id}`, {
      method: "PUT",
      auth: admin,
      data: { name: `${tagName}-updated`, slug: `${tagName}-updated` },
    });
    expect(updatedTag.name).toBe(`${tagName}-updated`);

    const inactiveTag = await apiData<TagSummary>(request, `/api/admin/tags/${tag.id}/status`, {
      method: "PATCH",
      auth: admin,
      data: { status: "INACTIVE" },
    });
    expect(inactiveTag.status).toBe("INACTIVE");

    const mergedTag = await apiData<TagSummary>(request, `/api/admin/tags/${tag.id}/merge`, {
      method: "POST",
      auth: admin,
      data: { targetTagId: targetTag.id },
    });
    expect(mergedTag.status).toBe("MERGED");

    const postTitle = `E2E Admin Post ${stamp}`;
    const post = await apiData<PostSummary>(request, "/api/posts", {
      method: "POST",
      auth: admin,
      data: {
        postType: "NORMAL",
        title: postTitle,
        content: `<p>${postTitle}</p>`,
        categoryId: category.id,
        tagIds: [targetTag.id],
      },
    });
    cleanup.push(() => apiData(request, `/api/posts/${post.id}`, { method: "DELETE", auth: admin }));
    expect(post.id).toBeGreaterThan(0);
    const matchingPosts = await apiData<PostSummary[]>(
      request,
      `/api/admin/posts?status=PUBLISHED&postType=NORMAL&author=${encodeURIComponent(admin.user.username)}&categoryId=${category.id}&tagId=${targetTag.id}`,
      { auth: admin },
    );
    expect(matchingPosts.some((item) => item.id === post.id)).toBeTruthy();
    const excludedPosts = await apiData<PostSummary[]>(
      request,
      `/api/admin/posts?postType=RESOURCE&categoryId=${category.id}`,
      { auth: admin },
    );
    expect(excludedPosts.some((item) => item.id === post.id)).toBeFalsy();

    const updatedPost = await apiData<PostSummary>(request, `/api/posts/${post.id}`, {
      method: "PUT",
      auth: admin,
      data: { title: `${postTitle} Updated`, content: `<p>${postTitle} updated</p>` },
    });
    expect(updatedPost.title).toBe(`${postTitle} Updated`);

    await apiData(request, `/api/admin/posts/${post.id}/offline`, {
      method: "PATCH",
      auth: admin,
      data: { reason: "E2E admin CRUD" },
    });
    await apiData(request, `/api/admin/posts/${post.id}/online`, {
      method: "PATCH",
      auth: admin,
    });

    const bountyTitle = `E2E Admin Bounty ${stamp}`;
    const bounty = await apiData<PostSummary>(request, "/api/posts", {
      method: "POST",
      auth: admin,
      data: {
        postType: "BOUNTY",
        title: bountyTitle,
        content: `<p>${bountyTitle}</p>`,
        bountyAmount: 1,
        bountyExpireAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      },
    });
    cleanup.push(() => apiData(request, `/api/posts/${bounty.id}`, { method: "DELETE", auth: admin }));
    const matchingBounties = await apiData<PostSummary[]>(
      request,
      `/api/admin/bounties?status=ACTIVE&keyword=${encodeURIComponent(bountyTitle)}`,
      { auth: admin },
    );
    expect(matchingBounties.some((item) => item.id === bounty.id)).toBeTruthy();

    const users = await apiData<AdminUserSummary[]>(request, "/api/admin/users", {
      auth: admin,
    });
    const adminUser = users.find((user) => user.id === admin.user.id) ?? users[0];
    expect(adminUser.id).toBeGreaterThan(0);
    const matchingUsers = await apiData<AdminUserSummary[]>(
      request,
      `/api/admin/users?status=${adminUser.status}&keyword=${encodeURIComponent(adminUser.username)}`,
      { auth: admin },
    );
    expect(matchingUsers.some((user) => user.id === adminUser.id)).toBeTruthy();
    const excludedUsers = await apiData<AdminUserSummary[]>(
      request,
      `/api/admin/users?status=BANNED&keyword=${encodeURIComponent(adminUser.username)}`,
      { auth: admin },
    );
    expect(excludedUsers.some((user) => user.id === adminUser.id)).toBeFalsy();

    await apiData(request, `/api/admin/users/${adminUser.id}/status`, {
      method: "PATCH",
      auth: admin,
      data: { status: "MUTED", reason: "E2E status update" },
    });
    await apiData(request, `/api/admin/users/${adminUser.id}/status`, {
      method: "PATCH",
      auth: admin,
      data: { status: "ACTIVE", reason: "E2E status restore" },
    });

    await apiData(request, `/api/admin/coins/users/${adminUser.id}`, {
      method: "PATCH",
      auth: admin,
      data: { amount: 1, reason: "E2E coin adjustment" },
    });
    cleanup.push(() =>
      apiData(request, `/api/admin/coins/users/${adminUser.id}`, {
        method: "PATCH",
        auth: admin,
        data: { amount: -1, reason: "E2E coin adjustment rollback" },
      }),
    );
    const matchingCoinUsers = await apiData<AdminUserSummary[]>(
      request,
      `/api/admin/coins/users?status=ACTIVE&keyword=${encodeURIComponent(adminUser.username)}`,
      { auth: admin },
    );
    expect(matchingCoinUsers.some((user) => user.id === adminUser.id)).toBeTruthy();
    await expect(
      apiData<unknown[]>(
        request,
        `/api/admin/audit/wallet-ledger?userId=${adminUser.id}&bizType=ADMIN_ADJUST&limit=1`,
        { auth: admin },
      ),
    ).resolves.toHaveLength(1);
    await expect(
      apiData<unknown[]>(request, `/api/admin/audit/resource-trades?userId=${adminUser.id}&limit=1`, {
        auth: admin,
      }),
    ).resolves.toBeTruthy();
    const clientName = `E2E Client ${stamp}`;
    const client = await apiData<OpenApiClientSummary>(
      request,
      "/api/admin/open-api/clients",
      {
        method: "POST",
        auth: admin,
        data: { name: clientName, remark: "created by e2e", status: "ACTIVE" },
      },
    );
    cleanup.push(() => apiData(request, `/api/admin/open-api/clients/${client.id}`, { method: "DELETE", auth: admin }));
    expect(client.name).toBe(clientName);

    const updatedClient = await apiData<OpenApiClientSummary>(
      request,
      `/api/admin/open-api/clients/${client.id}`,
      {
        method: "PUT",
        auth: admin,
        data: { name: `${clientName} Updated`, remark: "updated by e2e", status: "ACTIVE" },
      },
    );
    expect(updatedClient.name).toBe(`${clientName} Updated`);

    const inactiveClient = await apiData<OpenApiClientSummary>(
      request,
      `/api/admin/open-api/clients/${client.id}/status`,
      {
        method: "PATCH",
        auth: admin,
        data: { status: "INACTIVE" },
      },
    );
    expect(inactiveClient.status).toBe("INACTIVE");

    const binding = await apiData<OpenApiBindingSummary>(
      request,
      `/api/admin/open-api/clients/${client.id}/bindings`,
      {
        method: "POST",
        auth: admin,
        data: {
          bindingCode: `e2e-binding-${stamp}`,
          userId: adminUser.id,
          remark: "created by e2e",
          status: "ACTIVE",
        },
      },
    );
    cleanup.push(() =>
      apiData(request, `/api/admin/open-api/clients/${client.id}/bindings/${binding.id}`, {
        method: "DELETE",
        auth: admin,
      }),
    );
    expect(binding.userId).toBe(adminUser.id);

    const updatedBinding = await apiData<OpenApiBindingSummary>(
      request,
      `/api/admin/open-api/clients/${client.id}/bindings/${binding.id}`,
      {
        method: "PUT",
        auth: admin,
        data: {
          bindingCode: `e2e-binding-${stamp}-updated`,
          userId: adminUser.id,
          remark: "updated by e2e",
          status: "ACTIVE",
        },
      },
    );
    expect(updatedBinding.bindingCode).toBe(`e2e-binding-${stamp}-updated`);

    await apiData(request, `/api/admin/open-api/clients/${client.id}/bindings/${binding.id}`, {
      method: "DELETE",
      auth: admin,
    });
    await apiData(request, `/api/admin/open-api/clients/${client.id}`, {
      method: "DELETE",
      auth: admin,
    });
    await apiData(request, `/api/posts/${post.id}`, { method: "DELETE", auth: admin });
    await apiData(request, `/api/posts/${bounty.id}`, { method: "DELETE", auth: admin });
    await apiData(request, `/api/admin/tags/${tag.id}`, { method: "DELETE", auth: admin });
    await apiData(request, `/api/admin/tags/${targetTag.id}`, { method: "DELETE", auth: admin });
    await apiData(request, `/api/admin/categories/${category.id}`, {
      method: "DELETE",
      auth: admin,
    });
    } finally {
      for (const action of cleanup.reverse()) {
        await action().catch(() => undefined);
      }
    }
  });
});
