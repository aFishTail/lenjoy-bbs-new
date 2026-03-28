import { FormEvent } from "react";

import { CaptchaField } from "@/components/auth/captcha-field";

type LoginFormValue = {
  account: string;
  password: string;
  captchaCode: string;
};

type LoginFormProps = {
  value: LoginFormValue;
  onChange: (next: LoginFormValue) => void;
  submitting: boolean;
  refreshingCaptcha: boolean;
  captchaId: string;
  captchaImageSrc: string;
  captchaExpireText: string;
  onRefreshCaptcha: () => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function LoginForm({
  value,
  onChange,
  submitting,
  refreshingCaptcha,
  captchaId,
  captchaImageSrc,
  captchaExpireText,
  onRefreshCaptcha,
  onSubmit,
}: LoginFormProps) {
  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <div className="grid gap-4">
        <div className="form-group">
          <label className="form-label" htmlFor="account">
            账号（邮箱/手机号/用户名）
          </label>
          <input
            id="account"
            className="form-input"
            required
            placeholder="name@example.com 或 13800138000"
            value={value.account}
            onChange={(e) => onChange({ ...value, account: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">
            密码
          </label>
          <input
            id="password"
            className="form-input"
            required
            type="password"
            minLength={6}
            placeholder="请输入密码"
            value={value.password}
            onChange={(e) => onChange({ ...value, password: e.target.value })}
          />
        </div>

        <CaptchaField
          captchaId={captchaId}
          captchaImageSrc={captchaImageSrc}
          captchaCode={value.captchaCode}
          captchaExpireText={captchaExpireText}
          refreshingCaptcha={refreshingCaptcha}
          onCaptchaCodeChange={(captchaCode) =>
            onChange({ ...value, captchaCode })
          }
          onRefresh={onRefreshCaptcha}
        />

        <button
          className="btn btn-primary"
          disabled={submitting || refreshingCaptcha}
          type="submit"
        >
          {submitting ? (
            <>
              <div className="spinner" style={{ width: "16px", height: "16px" }}></div>
              登录中...
            </>
          ) : (
            <>
              <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
              </svg>
              登录
            </>
          )}
        </button>
      </div>
    </form>
  );
}
