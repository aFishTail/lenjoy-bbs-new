import { FormEvent } from "react";
import { Loader2Icon, UserPlusIcon } from "lucide-react";

import { CaptchaField } from "@/components/auth/captcha-field";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="username">用户名</FieldLabel>
          <Input
            id="username"
            required
            minLength={3}
            maxLength={64}
            pattern="[A-Za-z0-9_-]+"
            title="用户名只能包含字母、数字、下划线和短横线"
            placeholder="3-64 位，仅支持字母、数字、下划线和短横线"
            value={value.username}
            onChange={(e) => onChange({ ...value, username: e.target.value })}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="registerPassword">密码</FieldLabel>
          <Input
            id="registerPassword"
            required
            type="password"
            minLength={8}
            maxLength={128}
            placeholder="8-128 位"
            value={value.password}
            onChange={(e) => onChange({ ...value, password: e.target.value })}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="email">邮箱</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="可选，邮箱或手机号至少填一项"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="phone">手机号</FieldLabel>
          <Input
            id="phone"
            maxLength={32}
            placeholder="可选，邮箱或手机号至少填一项"
            value={value.phone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
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
              注册中...
            </>
          ) : (
            <>
              <UserPlusIcon data-icon="inline-start" />
              注册
            </>
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
