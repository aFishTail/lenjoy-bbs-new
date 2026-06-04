import { RotateCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type CaptchaFieldProps = {
  captchaId: string;
  captchaImageSrc: string;
  captchaCode: string;
  captchaExpireText: string;
  refreshingCaptcha: boolean;
  invalid?: boolean;
  errorMessage?: string;
  onCaptchaCodeChange: (value: string) => void;
  onRefresh: () => Promise<void>;
};

export function CaptchaField({
  captchaId,
  captchaImageSrc,
  captchaCode,
  captchaExpireText,
  refreshingCaptcha,
  invalid,
  errorMessage,
  onCaptchaCodeChange,
  onRefresh,
}: CaptchaFieldProps) {
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor="captchaCode">图形验证码</FieldLabel>
      <Input
        id="captchaCode"
        aria-invalid={invalid}
        placeholder="请输入图中字符"
        value={captchaCode}
        onChange={(e) => onCaptchaCodeChange(e.target.value)}
      />
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}

      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <div className="flex min-h-[68px] items-center justify-center rounded-md border border-slate-200 bg-slate-50">
          {captchaImageSrc ? (
            <img
              src={captchaImageSrc}
              alt="图形验证码"
              className="h-[68px] w-full rounded-md object-contain"
            />
          ) : (
            <span className="text-sm text-slate-500">验证码加载中</span>
          )}
        </div>
        <FieldGroup className="gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void onRefresh()}
            disabled={refreshingCaptcha}
            className="w-fit"
          >
            <RotateCwIcon data-icon="inline-start" />
            {refreshingCaptcha ? "刷新中..." : "刷新验证码"}
          </Button>
          <FieldDescription>ID: {captchaId || "-"}</FieldDescription>
          <FieldDescription>过期: {captchaExpireText}</FieldDescription>
        </FieldGroup>
      </div>
    </Field>
  );
}
