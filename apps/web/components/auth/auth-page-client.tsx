"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  startTransition,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AuthSessionCard } from "@/components/auth/auth-session-card";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import {
  type CaptchaMetadata,
  type Mode,
} from "@/components/auth/types";
import type { AuthData } from "@/components/post/types";
import {
  queryKeys,
  readError,
  requestApiData,
} from "@/components/post/client-helpers";
import { useAuth } from "@/components/providers/auth-provider";

export function AuthPageClient() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [captchaStamp, setCaptchaStamp] = useState<number>(Date.now());
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const { authData: auth, setAuth: saveAuth, clearAuth: handleClearAuth } = useAuth();

  const [loginForm, setLoginForm] = useState({
    account: "",
    password: "",
    captchaCode: "",
  });

  const [registerForm, setRegisterForm] = useState({
    username: "",
    password: "",
    email: "",
    phone: "",
    captchaCode: "",
  });

  const captchaQuery = useQuery({
    queryKey: queryKeys.captcha,
    queryFn: () =>
      requestApiData<CaptchaMetadata>("/api/auth/captcha", {
        method: "GET",
        cache: "no-store",
      }),
  });

  const loginMutation = useMutation({
    mutationFn: (payload: {
      account: string;
      password: string;
      captchaId: string;
      captchaCode: string;
    }) =>
      requestApiData<AuthData>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
  });

  const registerMutation = useMutation({
    mutationFn: (payload: {
      username: string;
      password: string;
      email: string;
      phone: string;
      captchaId: string;
      captchaCode: string;
    }) =>
      requestApiData<AuthData>("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
  });

  const captchaId = captchaQuery.data?.captchaId ?? "";
  const captchaExpiresAt = captchaQuery.data?.expireAt ?? 0;
  const submitting = loginMutation.isPending || registerMutation.isPending;
  const refreshingCaptcha = captchaQuery.isFetching;

  const captchaImageSrc = useMemo(() => {
    if (!captchaId) {
      return "";
    }
    return `/api/auth/captcha/${captchaId}/image?t=${captchaStamp}`;
  }, [captchaId, captchaStamp]);

  const captchaExpireText = captchaExpiresAt
    ? new Date(captchaExpiresAt).toLocaleString("zh-CN", { hour12: false })
    : "-";

  useEffect(() => {
    if (!captchaQuery.data) {
      return;
    }
    setCaptchaStamp(Date.now());
    setLoginForm((prev) => ({ ...prev, captchaCode: "" }));
    setRegisterForm((prev) => ({ ...prev, captchaCode: "" }));
  }, [captchaQuery.data]);

  useEffect(() => {
    // Relying on useAuth hydration instead of manual parse
  }, []);

  async function refreshCaptcha(options?: { clearError?: boolean }) {
    if (options?.clearError ?? true) {
      setErrorText("");
    }

    try {
      await captchaQuery.refetch();
    } catch (error) {
      setErrorText(readError(error));
    }
  }

  // saveAuth is provided by useAuth

  function logout() {
    handleClearAuth();
    setSuccessText("已退出登录");
    setErrorText("");
  }

  async function onSubmitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captchaId) {
      setErrorText("验证码尚未准备好，请刷新重试");
      return;
    }

    setErrorText("");
    setSuccessText("");

    try {
      const payload = await loginMutation.mutateAsync({
        account: loginForm.account.trim(),
        password: loginForm.password,
        captchaId,
        captchaCode: loginForm.captchaCode.trim(),
      });
      saveAuth(payload);
      setSuccessText("登录成功，正在跳转...");
      startTransition(() => {
        router.replace("/");
      });
    } catch (error) {
      setErrorText(readError(error));
      await refreshCaptcha({ clearError: false });
    }
  }

  async function onSubmitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captchaId) {
      setErrorText("验证码尚未准备好，请刷新重试");
      return;
    }

    setErrorText("");
    setSuccessText("");

    try {
      const payload = await registerMutation.mutateAsync({
        username: registerForm.username.trim(),
        password: registerForm.password,
        email: registerForm.email.trim(),
        phone: registerForm.phone.trim(),
        captchaId,
        captchaCode: registerForm.captchaCode.trim(),
      });
      saveAuth(payload);
      setSuccessText("注册成功，正在跳转...");
      startTransition(() => {
        router.replace("/");
      });
    } catch (error) {
      setErrorText(readError(error));
      await refreshCaptcha({ clearError: false });
    }
  }

  return (
    <main className="page">
      <div style={{ maxWidth: "500px", margin: "0 auto" }}>
        {/* Header */}
        <div className="text-center mb-6">
          <div
            className="avatar avatar-lg mx-auto mb-4"
            style={{ margin: "0 auto" }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "'Newsreader', serif" }}
          >
            {mode === "login" ? "欢迎回来" : "创建账号"}
          </h1>
          <p className="text-muted mt-2">
            {mode === "login"
              ? "输入账号与密码，完成验证码后登录"
              : "完成基础信息填写后即可注册并自动登录"}
          </p>
        </div>

        {/* Auth Card */}
        <div className="card">
          {/* Tabs */}
          <div className="tabs mb-4" style={{ width: "100%" }}>
            <button
              type="button"
              className={`tab ${mode === "login" ? "active" : ""}`}
              onClick={() => setMode("login")}
              style={{ flex: 1 }}
            >
              登录
            </button>
            <button
              type="button"
              className={`tab ${mode === "register" ? "active" : ""}`}
              onClick={() => setMode("register")}
              style={{ flex: 1 }}
            >
              注册
            </button>
          </div>

          {/* Form */}
          {mode === "login" ? (
            <LoginForm
              value={loginForm}
              onChange={setLoginForm}
              submitting={submitting}
              refreshingCaptcha={refreshingCaptcha}
              captchaId={captchaId}
              captchaImageSrc={captchaImageSrc}
              captchaExpireText={captchaExpireText}
              onRefreshCaptcha={() => refreshCaptcha()}
              onSubmit={onSubmitLogin}
            />
          ) : (
            <RegisterForm
              value={registerForm}
              onChange={setRegisterForm}
              submitting={submitting}
              refreshingCaptcha={refreshingCaptcha}
              captchaId={captchaId}
              captchaImageSrc={captchaImageSrc}
              captchaExpireText={captchaExpireText}
              onRefreshCaptcha={() => refreshCaptcha()}
              onSubmit={onSubmitRegister}
            />
          )}

          {/* Messages */}
          {errorText && (
            <div className="banner banner-error mt-4">
              <svg
                className="icon-sm"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {errorText}
            </div>
          )}

          {successText && (
            <div className="banner banner-success mt-4">
              <svg
                className="icon-sm"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              {successText}
            </div>
          )}

          {auth && <AuthSessionCard auth={auth} onLogout={logout} />}
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link href="/" className="nav-link">
            <svg
              className="icon-sm"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ display: "inline", marginRight: "4px" }}
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}
