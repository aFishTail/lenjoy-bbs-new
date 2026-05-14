import { FormEvent } from "react";

import { CaptchaField } from "@/components/auth/captcha-field";

type RegisterFormValue = {
  username: string;
  password: string;
  email: string;
  phone: string;
  captchaCode: string;
};

type RegisterFormProps = {
  value: RegisterFormValue;
  onChange: (next: RegisterFormValue) => void;
  submitting: boolean;
  refreshingCaptcha: boolean;
  captchaId: string;
  captchaImageSrc: string;
  captchaExpireText: string;
  onRefreshCaptcha: () => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function RegisterForm({
  value,
  onChange,
  submitting,
  refreshingCaptcha,
  captchaId,
  captchaImageSrc,
  captchaExpireText,
  onRefreshCaptcha,
  onSubmit,
}: RegisterFormProps) {
  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <div className="grid gap-4">
        <div className="form-group">
          <label className="form-label" htmlFor="username">
            用户名
          </label>
          <input
            id="username"
            className="form-input"
            required
            minLength={3}
            maxLength={64}
            pattern="[A-Za-z0-9_-]+"
            title="用户名只能包含字母、数字、下划线和短横线"
            placeholder="3-64 位，仅支持字母、数字、下划线和短横线"
            value={value.username}
            onChange={(e) => onChange({ ...value, username: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="registerPassword">
            密码
          </label>
          <input
            id="registerPassword"
            className="form-input"
            required
            type="password"
            minLength={8}
            maxLength={128}
            placeholder="8-128 位"
            value={value.password}
            onChange={(e) => onChange({ ...value, password: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="email">
            邮箱
          </label>
          <input
            id="email"
            className="form-input"
            type="email"
            placeholder="可选，邮箱或手机号至少填一项"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="phone">
            手机号
          </label>
          <input
            id="phone"
            className="form-input"
            maxLength={32}
            placeholder="可选，邮箱或手机号至少填一项"
            value={value.phone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
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
              <div
                className="spinner"
                style={{ width: "16px", height: "16px" }}
              ></div>
              注册中...
            </>
          ) : (
            <>
              <svg
                className="icon-sm"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              注册
            </>
          )}
        </button>
      </div>
    </form>
  );
}
