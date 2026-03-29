import type { AuthData } from "@/components/post/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AuthSessionCardProps = {
  auth: AuthData;
  onLogout: () => void;
};

export function AuthSessionCard({ auth, onLogout }: AuthSessionCardProps) {
  return (
    <Card className="mt-5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">当前登录信息</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1.5 text-sm text-slate-700">
        <p>用户：{auth.user.username}</p>
        <p>邮箱：{auth.user.email || "未绑定"}</p>
        <p>手机：{auth.user.phone || "未绑定"}</p>
        <p>令牌类型：{auth.tokenType}</p>
        <p>有效期：{auth.expiresIn} 秒</p>
        <div className="pt-2">
          <Button type="button" variant="outline" onClick={onLogout}>
            退出登录
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
