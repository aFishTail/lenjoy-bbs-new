import { FormEvent } from "react";
import { Loader2Icon, LogInIcon } from "lucide-react";

import { CaptchaField } from "@/components/auth/captcha-field";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="account">
            账号（邮箱 / 手机号 / 用户名）
          </FieldLabel>
          <Input
            id="account"
            required
            placeholder="name@example.com 或 13800138000"
            value={value.account}
            onChange={(e) => onChange({ ...value, account: e.target.value })}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">密码</FieldLabel>
          <Input
            id="password"
            required
            type="password"
            minLength={6}
            placeholder="请输入密码"
            value={value.password}
            onChange={(e) => onChange({ ...value, password: e.target.value })}
          />
        </Field>

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

        <Button
          className="w-full"
          disabled={submitting || refreshingCaptcha}
          type="submit"
        >
          {submitting ? (
            <>
              <Loader2Icon data-icon="inline-start" className="animate-spin" />
              登录中...
            </>
          ) : (
            <>
              <LogInIcon data-icon="inline-start" />
              登录
            </>
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
