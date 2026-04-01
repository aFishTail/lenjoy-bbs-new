export function fixtureTitles() {
  const stamp = Date.now();
  return {
    normalTitle: `E2E Normal ${stamp}`,
    resourceTitle: `E2E Resource ${stamp}`,
    bountyTitle: `E2E Bounty ${stamp}`,
    hiddenSecret: `E2E-SECRET-${stamp}`,
    answerContent: `E2E answer ${stamp}`,
  };
}

export const PUBLIC_ROUTES = ["/", "/discussions", "/resources", "/bounties", "/auth"];

export const USER_ROUTES = [
  "/",
  "/my",
  "/my/wallet",
  "/my/posts",
  "/my/purchases",
  "/my/sales",
  "/my/messages",
  "/posts/new",
];

export const ADMIN_ROUTES = [
  "/admin",
  "/admin/users",
  "/admin/posts",
  "/admin/audit",
  "/admin/coins",
  "/admin/appeals",
  "/admin/bounties",
  "/admin/reports",
];
