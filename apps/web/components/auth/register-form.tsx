"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, UserPlusIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { CaptchaField } from "@/components/auth/captcha-field";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const optionalEmailSchema = z
  .string()
  .trim()
  .refine((value) => !value || z.email().safeParse(value).success, {
    message: "请输入有效的邮箱地址",
  });

const registerFormSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "用户名至少 3 个字符")
    .max(32, "用户名不能超过 32 个字符"),
  password: z
    .string()
    .min(8, "密码至少 8 个字符")
    .max(24, "密码不能超过 24 个字符"),
  email: optionalEmailSchema,
  phone: z.string().trim().max(32, "手机号不能超过 32 个字符"),
  captchaCode: z
    .string()
    .trim()
    .min(1, "请输入图形验证码")
    .max(4, "图形验证码不能超过 4 个字符"),
});

export type RegisterFormValue = {
  username: string;
  password: string;
  email: string;
  phone: string;
  captchaCode: string;
};

type RegisterFormProps = {
  submitting: boolean;
  refreshingCaptcha: boolean;
  captchaId: string;
  captchaImageSrc: string;
  captchaExpireText: string;
  captchaResetKey: number;
  onRefreshCaptcha: () => Promise<void>;
  onSubmit: (values: RegisterFormValue) => Promise<void>;
};

export function RegisterForm({
  submitting,
  refreshingCaptcha,
  captchaId,
  captchaImageSrc,
  captchaExpireText,
  captchaResetKey,
  onRefreshCaptcha,
  onSubmit,
}: RegisterFormProps) {
  const {
    control,
    handleSubmit,
    register,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValue>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      phone: "",
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
        <Field data-invalid={!!errors.username || undefined}>
          <FieldLabel htmlFor="username">用户名</FieldLabel>
          <Input
            id="username"
            maxLength={32}
            placeholder="3-32 位"
            aria-invalid={!!errors.username}
            {...register("username")}
          />
          {errors.username?.message ? (
            <FieldError>{errors.username.message}</FieldError>
          ) : null}
        </Field>

        <Field data-invalid={!!errors.password || undefined}>
          <FieldLabel htmlFor="registerPassword">密码</FieldLabel>
          <Input
            id="registerPassword"
            type="password"
            maxLength={24}
            placeholder="8-24 位"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password?.message ? (
            <FieldError>{errors.password.message}</FieldError>
          ) : null}
        </Field>

        <Field data-invalid={!!errors.email || undefined}>
          <FieldLabel htmlFor="email">邮箱</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="可选，邮箱或手机号至少填一项"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          {errors.email?.message ? (
            <FieldError>{errors.email.message}</FieldError>
          ) : null}
        </Field>

        <Field data-invalid={!!errors.phone || undefined}>
          <FieldLabel htmlFor="phone">手机号</FieldLabel>
          <Input
            id="phone"
            maxLength={32}
            placeholder="可选，邮箱或手机号至少填一项"
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
          {errors.phone?.message ? (
            <FieldError>{errors.phone.message}</FieldError>
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

        <Button
          className="w-full"
          disabled={busy}
          type="submit"
        >
          {submitting || isSubmitting ? (
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
