import { FormEvent } from "react";

import { CaptchaField } from "@/components/auth/captcha-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <form
      className="mt-5 grid gap-4"
      onSubmit={(event) => void onSubmit(event)}
    >
      <div className="space-y-2">
        <Label htmlFor="username">用户名</Label>
        <Input
          id="username"
          required
          minLength={3}
          maxLength={32}
          placeholder="3-32 位，不可重复"
          value={value.username}
          onChange={(e) => onChange({ ...value, username: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="registerPassword">密码</Label>
        <Input
          id="registerPassword"
          required
          type="password"
          minLength={6}
          maxLength={64}
          placeholder="至少 6 位"
          value={value.password}
          onChange={(e) => onChange({ ...value, password: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          type="email"
          placeholder="可选，邮箱或手机号至少填一项"
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">手机号</Label>
        <Input
          id="phone"
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

      <Button disabled={submitting || refreshingCaptcha} type="submit">
        {submitting ? "提交中..." : "注册"}
      </Button>
    </form>
  );
}
