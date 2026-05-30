import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

import { applySession, loadSessions } from "../../helpers/sessions";
import type { AuthData } from "../../helpers/types";

type SessionKey = "user_a" | "user_b" | "user_c" | "admin";

type RoleSession = {
  auth: AuthData;
  context: BrowserContext;
  page: Page;
};

type Fixtures = {
  sessionMap: ReturnType<typeof loadSessions>;
  createRoleSession: (key: SessionKey) => Promise<RoleSession>;
  getSession: (key: SessionKey) => AuthData | null;
};

export const test = base.extend<Fixtures>({
  sessionMap: async ({}, use) => {
    await use(loadSessions());
  },

  getSession: async ({ sessionMap }, use) => {
    await use((key) => sessionMap[key] ?? null);
  },

  createRoleSession: async ({ browser, baseURL, sessionMap }, use) => {
    const contexts: BrowserContext[] = [];

    await use(async (key) => {
      const auth = sessionMap[key];
      expect(baseURL, "baseURL is required for role sessions").toBeTruthy();
      expect(auth, `missing session: ${key}`).toBeTruthy();

      const context = await browser.newContext();
      contexts.push(context);
      await applySession(context, baseURL!, auth!);
      const page = await context.newPage();

      return {
        auth: auth!,
        context,
        page,
      };
    });

    await Promise.all(contexts.map((context) => context.close()));
  },
});

export { expect } from "@playwright/test";