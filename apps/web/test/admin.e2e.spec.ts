import { expect, test } from "@playwright/test";

import { ADMIN_ROUTES } from "./helpers/prd-fixtures";
import { applySession } from "./helpers/sessions";
import { expectAdminSession, requireSession, sessions } from "./helpers/session-checks";

test.describe("PRD admin flow", () => {
  test.skip(
    !sessions.user_a || !sessions.admin,
    "user_a and admin sessions are required for admin flow",
  );

  test("admin pages and APIs respond", async ({ browser, baseURL }) => {
    test.skip(!baseURL, "baseURL is required");
    const resolvedBaseURL = baseURL!;

    const admin = requireSession("admin");
    expectAdminSession(admin);

    for (const path of ADMIN_ROUTES) {
      const adminPage = await browser.newPage();
      await applySession(adminPage.context(), resolvedBaseURL, admin);
      await adminPage.goto(path, { waitUntil: "domcontentloaded" });
      await adminPage.waitForLoadState("networkidle");
      await expect(adminPage).not.toHaveURL(/\/auth/);
      await expect(adminPage.locator(".admin-shell")).toBeVisible();
      await expect(adminPage.locator("body")).toContainText("Lenjoy Admin");
      await adminPage.close();
    }
  });

  test("guest and non-admin cannot see admin shell", async ({ browser, baseURL }) => {
    test.skip(!baseURL, "baseURL is required");
    const resolvedBaseURL = baseURL!;

    const user = requireSession("user_a");

    for (const path of ADMIN_ROUTES) {
      const guestPage = await browser.newPage();
      await guestPage.goto(path, { waitUntil: "domcontentloaded" });
      await expect(guestPage).toHaveURL(/\/auth$/);
      await expect(guestPage.locator(".admin-shell")).toHaveCount(0);
      await guestPage.close();

      const userPage = await browser.newPage();
      await applySession(userPage.context(), resolvedBaseURL, user);
      await userPage.goto(path, { waitUntil: "domcontentloaded" });
      await expect(userPage).toHaveURL(/\/auth$/);
      await expect(userPage.locator(".admin-shell")).toHaveCount(0);
      await userPage.close();
    }
  });

  /**
   * MB7 — every admin page now carries the read-only banner.
   * Operators who land on a legacy BBS admin URL see a
   * prominent pointer to the new platform admin at `/ops/`.
   * The banner is rendered for authenticated admins regardless
   * of the underlying page; mutations are off the table.
   */
  test("every admin page renders the read-only banner pointing to /ops/", async ({
    browser,
    baseURL
  }) => {
    test.skip(!baseURL, "baseURL is required");
    const resolvedBaseURL = baseURL!;
    const admin = requireSession("admin");
    expectAdminSession(admin);

    for (const path of ADMIN_ROUTES) {
      const adminPage = await browser.newPage();
      await applySession(adminPage.context(), resolvedBaseURL, admin);
      await adminPage.goto(path, { waitUntil: "domcontentloaded" });
      await adminPage.waitForLoadState("networkidle");
      const banner = adminPage.getByTestId("admin-read-only-banner");
      await expect(banner).toBeVisible();
      await expect(banner).toContainText("本面板已迁移");
      await expect(banner).toContainText("/ops/");
      await adminPage.close();
    }
  });

  /**
   * MB7 server-side enforcement — clicking a mutation control on a
   * legacy admin page must NOT result in a successful state change.
   *
   * With ``LEGACY_ADMIN_MUTATIONS_ENABLED=false`` (the production
   * default), every legacy admin mutation returns a stable
   * ``LEGACY_ADMIN_READ_ONLY`` error from the BBS service. The UI
   * surfaces that error via the existing toast helper and the page
   * stays unchanged. Operators must use the new ``/ops/`` plane for
   * any state change.
   */
  test("legacy admin mutation attempts cannot succeed and surface the read-only error", async ({
    browser,
    baseURL,
  }) => {
    test.skip(!baseURL, "baseURL is required");
    const resolvedBaseURL = baseURL!;
    const admin = requireSession("admin");
    expectAdminSession(admin);

    const adminPage = await browser.newPage();
    await applySession(adminPage.context(), resolvedBaseURL, admin);
    await adminPage.goto("/admin/users", { waitUntil: "domcontentloaded" });
    await adminPage.waitForLoadState("networkidle");

    // The banner must be present before any attempt to mutate.
    const banner = adminPage.getByTestId("admin-read-only-banner");
    await expect(banner).toBeVisible();

    // Snapshot the user list state before we attempt the mutation.
    const rowsBefore = await adminPage.locator(".admin-table tbody tr").count();

    // Track the PATCH call the admin UI fires when the operator
    // submits the action dialog. The server-side gate must respond
    // with a 410 Gone and the stable LEGACY_ADMIN_READ_ONLY code.
    const mutationPromise = adminPage.waitForResponse((response) => {
      const url = response.url();
      return (
        response.request().method() === "PATCH" &&
        /\/api\/v1\/admin\/users\/\d+\/status/.test(url)
      );
    });

    // Open the "Mute" dialog for the first user, fill the required
    // reason, and click confirm.
    const muteButtons = adminPage
      .locator(".admin-table tbody tr")
      .first()
      .locator("button.cat-btn-disable");
    await muteButtons.click();
    await adminPage.locator(".coin-modal-field input").fill("e2e mute reason");
    await adminPage.getByRole("button", { name: "禁言" }).last().click();

    const mutationResponse = await mutationPromise;
    expect(mutationResponse.status()).toBe(410);

    const mutationPayload = await mutationResponse.json();
    expect(mutationPayload.error?.code).toBe("LEGACY_ADMIN_READ_ONLY");
    expect(mutationPayload.error?.message ?? "").toContain("/ops/");

    // The table state must be unchanged: no row was created or
    // updated as a side effect of the rejected mutation.
    await adminPage.waitForLoadState("networkidle");
    const rowsAfter = await adminPage.locator(".admin-table tbody tr").count();
    expect(rowsAfter).toBe(rowsBefore);

    // The banner must still be visible — operators land on /ops/
    // for any real state change.
    await expect(banner).toBeVisible();
    await adminPage.close();
  });
});
