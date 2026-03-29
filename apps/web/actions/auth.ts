"use server";

import { cookies } from "next/headers";

import type { AuthData } from "@/components/post/types";
import { AUTH_STORAGE_KEY } from "@/components/post/client-helpers";

export async function setAuthAction(authData: AuthData) {
  const cookieStore = await cookies();
  const maxAgeParams = authData.expiresIn ? { maxAge: authData.expiresIn } : {};
  
  cookieStore.set(AUTH_STORAGE_KEY, JSON.stringify(authData), {
    path: "/",
    ...maxAgeParams,
    // httpOnly: false is necessary because the frontend client-helpers 
    // needs to read the token to pass it into Authorization header for API proxy endpoints.
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}

export async function clearAuthAction() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_STORAGE_KEY);
}

export async function getAuthSession(): Promise<AuthData | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_STORAGE_KEY)?.value;
  
  if (!raw) {
    return null;
  }
  
  try {
    return JSON.parse(raw) as AuthData;
  } catch {
    return null;
  }
}
