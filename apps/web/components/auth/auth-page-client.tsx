"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { AuthSessionCard } from "@/components/auth/auth-session-card";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import {
  type ApiResponse,
  type AuthData,
  type CaptchaMetadata,
  type Mode,
} from "@/components/auth/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const AUTH_STORAGE_KEY = "lenjoy.auth";

async function readApi<T>(response: Response): Promise<ApiResponse<T>> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "请求失败");
  }
  return payload;
}

function readError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "请求失败，请稍后重试";
}

export function AuthPageClient() {
  const [mode, setMode] = useState<Mode>("login");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaStamp, setCaptchaStamp] = useState<number>(Date.now());
  const [captchaExpiresAt, setCaptchaExpiresAt] = useState<number>(0);

  const [submitting, setSubmitting] = useState(false);
  const [refreshingCaptcha, setRefreshingCaptcha] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [auth, setAuth] = useState<AuthData | null>(null);

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
    void refreshCaptcha({ clearError: false });
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      setAuth(JSON.parse(raw) as AuthData);
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, []);

  async function refreshCaptcha(options?: { clearError?: boolean }) {
    setRefreshingCaptcha(true);
    if (options?.clearError ?? true) {
      setErrorText("");
    }

    try {
      const resp = await fetch("/api/auth/captcha", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await readApi<CaptchaMetadata>(resp);
      setCaptchaId(payload.data.captchaId);
      setCaptchaExpiresAt(payload.data.expireAt);
      setCaptchaStamp(Date.now());
      setLoginForm((prev) => ({ ...prev, captchaCode: "" }));
      setRegisterForm((prev) => ({ ...prev, captchaCode: "" }));
    } catch (error) {
      setErrorText(readError(error));
    } finally {
      setRefreshingCaptcha(false);
    }
  }

  function saveAuth(data: AuthData) {
    setAuth(data);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
  }

  function logout() {
    setAuth(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setSuccessText("已退出登录");
    setErrorText("");
  }

  async function onSubmitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captchaId) {
      setErrorText("验证码尚未准备好，请刷新重试");
      return;
    }

    setSubmitting(true);
    setErrorText("");
    setSuccessText("");

    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: loginForm.account.trim(),
          password: loginForm.password,
          captchaId,
          captchaCode: loginForm.captchaCode.trim(),
        }),
      });
      const payload = await readApi<AuthData>(resp);
      saveAuth(payload.data);
      setSuccessText("登录成功，已获得访问令牌");
      await refreshCaptcha();
      setLoginForm((prev) => ({ ...prev, password: "", captchaCode: "" }));
    } catch (error) {
      setErrorText(readError(error));
      await refreshCaptcha({ clearError: false });
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captchaId) {
      setErrorText("验证码尚未准备好，请刷新重试");
      return;
    }

    setSubmitting(true);
    setErrorText("");
    setSuccessText("");

    try {
      const resp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: registerForm.username.trim(),
          password: registerForm.password,
          email: registerForm.email.trim(),
          phone: registerForm.phone.trim(),
          captchaId,
          captchaCode: registerForm.captchaCode.trim(),
        }),
      });
      const payload = await readApi<AuthData>(resp);
      saveAuth(payload.data);
      setSuccessText("注册成功，已自动登录");
      await refreshCaptcha();
      setRegisterForm((prev) => ({ ...prev, password: "", captchaCode: "" }));
      setMode("login");
    } catch (error) {
      setErrorText(readError(error));
      await refreshCaptcha({ clearError: false });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto grid w-[min(1000px,94vw)] gap-6 py-10 sm:py-14">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          US-A02 · 账户与身份
        </p>
        <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-5xl">
          登录 / 注册
        </h1>
        <p className="text-sm text-slate-600 sm:text-base">
          支持邮箱、手机号、用户名登录。注册与登录均需图形验证码校验，并可随时刷新验证码。
        </p>
      </header>

      <Card className="border-slate-200/90 bg-white/85 backdrop-blur">
        <CardHeader className="space-y-4">
          <div className="inline-flex rounded-md border border-slate-200 p-1">
            <Button
              type="button"
              variant={mode === "login" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("login")}
            >
              登录
            </Button>
            <Button
              type="button"
              variant={mode === "register" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("register")}
            >
              注册
            </Button>
          </div>
          <div>
            <CardTitle className="text-lg">
              {mode === "login" ? "欢迎回来" : "创建账号"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "输入账号与密码，完成验证码后登录。"
                : "完成基础信息填写后即可注册并自动登录。"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
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

          {errorText ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {errorText}
            </p>
          ) : null}

          {successText ? (
            <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              {successText}
            </p>
          ) : null}

          {auth ? <AuthSessionCard auth={auth} onLogout={logout} /> : null}
        </CardContent>
      </Card>
    </main>
  );
}
