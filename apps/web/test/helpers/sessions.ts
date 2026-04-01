import fs from "node:fs";
import path from "node:path";

import type { BrowserContext } from "@playwright/test";

import type { AuthData, Sessions } from "./types";

export const AUTH_COOKIE_NAME = "lenjoy.auth";

export function getSessionsFilePath(): string {
  return path.resolve(process.cwd(), "test", "testdata", "auth-sessions.json");
}

export function loadSessions(): Sessions {
  const filePath = getSessionsFilePath();
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Sessions;
}

export type JwtClaims = {
  sub?: string;
  username?: string;
  roles?: string[];
  exp?: number;
  iat?: number;
};

export function readJwtClaims(auth: AuthData): JwtClaims | null {
  const parts = auth.token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as JwtClaims;
  } catch {
    return null;
  }
}

export async function applySession(
  context: BrowserContext,
  baseURL: string,
  auth: AuthData,
): Promise<void> {
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: AUTH_COOKIE_NAME,
      value: JSON.stringify(auth),
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ]);
}
