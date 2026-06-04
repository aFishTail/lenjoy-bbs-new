"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, LogInIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { CaptchaField } from "@/components/auth/captcha-field";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const loginFormSchema = z.object({
  account: z
    .string()
    .trim()
    .min(1, "请输入账号")
    .max(32, "账号不能超过 32 个字符"),
  password: z.string().min(1, "请输入密码").max(24, "密码不能超过 24 个字符"),
  captchaCode: z
    .string()
    .trim()
    .min(1, "请输入图形验证码")
    .max(4, "图形验证码不能超过 4 个字符"),
});

export type LoginFormValue = {
  account: string;
  password: string;
  captchaCode: string;
};

type LoginFormProps = {
  submitting: boolean;
  refreshingCaptcha: boolean;
  captchaId: string;
  captchaImageSrc: string;
  captchaExpireText: string;
  captchaResetKey: number;
  onRefreshCaptcha: () => Promise<void>;
  onSubmit: (values: LoginFormValue) => Promise<void>;
};

export function LoginForm({
  submitting,
  refreshingCaptcha,
  captchaId,
  captchaImageSrc,
  captchaExpireText,
  captchaResetKey,
  onRefreshCaptcha,
  onSubmit,
}: LoginFormProps) {
  const {
    control,
    handleSubmit,
    register,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValue>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      account: "",
      password: "",
      captchaCode: "",
    },
    reValidateMode: "onChange",
    shouldFocusError: true,
  });

  useEffect(() => {
    resetField("captchaCode");
  }, [captchaResetKey, resetField]);

  const busy = submitting || refreshingCaptcha || isSubmitting;

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
      <FieldGroup>
        <Field data-invalid={!!errors.account || undefined}>
          <FieldLabel htmlFor="account">
            账号（邮箱 / 手机号 / 用户名）
          </FieldLabel>
          <Input
            id="account"
            placeholder="name@example.com 或 13800138000"
            aria-invalid={!!errors.account}
            {...register("account")}
          />
          {errors.account?.message ? (
            <FieldError>{errors.account.message}</FieldError>
          ) : null}
        </Field>

        <Field data-invalid={!!errors.password || undefined}>
          <FieldLabel htmlFor="password">密码</FieldLabel>
          <Input
            id="password"
            type="password"
            placeholder="请输入密码"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password?.message ? (
            <FieldError>{errors.password.message}</FieldError>
          ) : null}
        </Field>

        <Controller
          name="captchaCode"
          control={control}
          render={({ field }) => (
            <CaptchaField
              captchaId={captchaId}
              captchaImageSrc={captchaImageSrc}
              captchaCode={field.value}
              captchaExpireText={captchaExpireText}
              refreshingCaptcha={refreshingCaptcha}
              invalid={!!errors.captchaCode}
              errorMessage={errors.captchaCode?.message}
              onCaptchaCodeChange={field.onChange}
              onRefresh={onRefreshCaptcha}
            />
          )}
        />

        <Button className="w-full" disabled={busy} type="submit">
          {submitting || isSubmitting ? (
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
