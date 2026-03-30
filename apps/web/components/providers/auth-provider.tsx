"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setCookie, deleteCookie } from "cookies-next";
import { getStoredAuth, queryKeys } from "@/components/post/client-helpers";
import type { AuthData } from "@/components/post/types";
import { AUTH_STORAGE_KEY } from "@/components/post/client-helpers";

type AuthContextType = {
  authData: AuthData | null;
  user: AuthData["user"] | null;
  hasAuth: boolean;
  authReady: boolean;
  clearAuth: () => void;
  setAuth: (data: AuthData) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ 
  children, 
  initialAuth 
}: { 
  children: ReactNode;
  initialAuth: AuthData | null;
}) {
  const queryClient = useQueryClient();
  const [authData, setAuthData] = useState<AuthData | null>(initialAuth);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // Always sync once from the client cookie so CSR navigation sees the
    // current auth state even when SSR could not provide a session.
    setAuthData(getStoredAuth());
    setAuthReady(true);

    const channel = new BroadcastChannel("lenjoy-auth-sync");
    
    channel.onmessage = (event) => {
      if (event.data === "auth-changed") {
        const nextAuthData = getStoredAuth();
        setAuthData(nextAuthData);
        if (nextAuthData?.token) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
        } else {
          queryClient.removeQueries({ queryKey: queryKeys.unreadCount });
        }
      }
    };

    return () => channel.close();
  }, [queryClient, initialAuth]);

  const clearAuth = useCallback(() => {
    deleteCookie(AUTH_STORAGE_KEY);
    setAuthData(null);
    queryClient.removeQueries({ queryKey: queryKeys.unreadCount });
    const channel = new BroadcastChannel("lenjoy-auth-sync");
    channel.postMessage("auth-changed");
    channel.close();
  }, [queryClient]);

  const handleSetAuth = useCallback((data: AuthData) => {
    const maxAgeParams = data.expiresIn ? { maxAge: data.expiresIn } : {};
    setCookie(AUTH_STORAGE_KEY, JSON.stringify(data), {
      path: "/",
      ...maxAgeParams,
      sameSite: "lax",
    });
    setAuthData(data);
    const channel = new BroadcastChannel("lenjoy-auth-sync");
    channel.postMessage("auth-changed");
    channel.close();
  }, []);

  const value = {
    authData,
    user: authData?.user ?? null,
    hasAuth: !!authData?.token,
    authReady,
    clearAuth,
    setAuth: handleSetAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
