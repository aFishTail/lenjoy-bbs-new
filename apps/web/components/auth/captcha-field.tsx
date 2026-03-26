import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CaptchaFieldProps = {
  captchaId: string;
  captchaImageSrc: string;
  captchaCode: string;
  captchaExpireText: string;
  refreshingCaptcha: boolean;
  onCaptchaCodeChange: (value: string) => void;
  onRefresh: () => Promise<void>;
};

export function CaptchaField({
  captchaId,
  captchaImageSrc,
  captchaCode,
  captchaExpireText,
  refreshingCaptcha,
  onCaptchaCodeChange,
  onRefresh,
}: CaptchaFieldProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="captchaCode">图形验证码</Label>
        <Input
          id="captchaCode"
          required
          placeholder="请输入图中字符"
          value={captchaCode}
          onChange={(e) => onCaptchaCodeChange(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <div className="grid min-h-[68px] place-items-center overflow-hidden rounded-md border border-dashed border-slate-300 bg-slate-50">
          {captchaImageSrc ? (
            <img
              src={captchaImageSrc}
              alt="图形验证码"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-sm text-slate-500">验证码加载中</span>
          )}
        </div>
        <div className="grid content-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => void onRefresh()}
          >
            {refreshingCaptcha ? "刷新中..." : "刷新验证码"}
          </Button>
          <small className="text-xs text-slate-500">
            captchaId: {captchaId || "-"}
          </small>
          <small className="text-xs text-slate-500">
            过期时间: {captchaExpireText}
          </small>
        </div>
      </div>
    </div>
  );
}
