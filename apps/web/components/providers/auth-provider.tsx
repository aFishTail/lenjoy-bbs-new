"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getStoredAuth, queryKeys } from "@/components/post/client-helpers";
import type { AuthData } from "@/components/post/types";

type AuthContextType = {
  authData: AuthData | null;
  user: AuthData["user"] | null;
  hasAuth: boolean;
  clearAuth: () => void;
  setAuth: (data: AuthData) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "lenjoy.auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [authData, setAuthData] = useState<AuthData | null>(null);

  useEffect(() => {
    // Initial hydration loop to sync local storage with React state
    setAuthData(getStoredAuth());

    const handleStorageChange = () => {
      const nextAuthData = getStoredAuth();
      setAuthData(nextAuthData);
      if (nextAuthData?.token) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
      } else {
        queryClient.removeQueries({ queryKey: queryKeys.unreadCount });
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [queryClient]);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthData(null);
    queryClient.removeQueries({ queryKey: queryKeys.unreadCount });
    // Dispatch a storage event yourself so other tabs and components are made aware
    window.dispatchEvent(new Event("storage"));
  }, [queryClient]);

  const handleSetAuth = useCallback((data: AuthData) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
    setAuthData(data);
    window.dispatchEvent(new Event("storage"));
  }, []);

  const value = {
    authData,
    user: authData?.user ?? null,
    hasAuth: !!authData?.token,
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
