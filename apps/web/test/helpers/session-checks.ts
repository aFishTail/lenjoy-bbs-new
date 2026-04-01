import { expect } from "@playwright/test";

import { loadSessions, readJwtClaims } from "./sessions";
import type { AuthData } from "./types";

export const sessions = loadSessions();

export function requireSession(key: keyof typeof sessions): AuthData {
  const session = sessions[key];
  if (!session) {
    throw new Error(`missing session: ${key}`);
  }
  return session;
}

export function expectSessionIdentity(auth: AuthData, key: string): void {
  const claims = readJwtClaims(auth);
  expect(claims, `${key} token is not a valid JWT`).toBeTruthy();

  const subjectId = Number(claims?.sub);
  expect(
    subjectId,
    `${key} token sub does not match auth-sessions.json user.id`,
  ).toBe(auth.user.id);
}

export function expectAdminSession(auth: AuthData): void {
  expectSessionIdentity(auth, "admin");

  const claims = readJwtClaims(auth);
  const roles = claims?.roles || [];
  expect(
    roles.some((role) => role === "ADMIN" || role === "ROLE_ADMIN"),
    `admin token roles ${JSON.stringify(roles)} do not include ADMIN`,
  ).toBeTruthy();
}
