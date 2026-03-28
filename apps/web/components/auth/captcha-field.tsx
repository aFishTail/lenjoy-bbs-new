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
    <div className="form-group">
      <label className="form-label" htmlFor="captchaCode">
        图形验证码
      </label>
      <input
        id="captchaCode"
        className="form-input"
        required
        placeholder="请输入图中字符"
        value={captchaCode}
        onChange={(e) => onCaptchaCodeChange(e.target.value)}
      />

      <div className="grid gap-3" style={{ gridTemplateColumns: "180px 1fr" }}>
        <div
          className="captcha-image-wrap"
          style={{ minHeight: "68px" }}
        >
          {captchaImageSrc ? (
            <img
              src={captchaImageSrc}
              alt="图形验证码"
              className="captcha-image"
            />
          ) : (
            <span className="text-muted text-sm">验证码加载中</span>
          )}
        </div>
        <div className="captcha-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void onRefresh()}
            disabled={refreshingCaptcha}
          >
            {refreshingCaptcha ? "刷新中..." : "刷新验证码"}
          </button>
          <small className="text-muted">
            ID: {captchaId || "-"}
          </small>
          <small className="text-muted">
            过期: {captchaExpireText}
          </small>
        </div>
      </div>
    </div>
  );
}
