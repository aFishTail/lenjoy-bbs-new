import { FormEvent } from "react";

import { CaptchaField } from "@/components/auth/captcha-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <form
      className="mt-5 grid gap-4"
      onSubmit={(event) => void onSubmit(event)}
    >
      <div className="space-y-2">
        <Label htmlFor="account">账号（邮箱/手机号/用户名）</Label>
        <Input
          id="account"
          required
          placeholder="name@example.com 或 13800138000 或 username"
          value={value.account}
          onChange={(e) => onChange({ ...value, account: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">密码</Label>
        <Input
          id="password"
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

      <Button disabled={submitting || refreshingCaptcha} type="submit">
        {submitting ? "提交中..." : "登录"}
      </Button>
    </form>
  );
}
