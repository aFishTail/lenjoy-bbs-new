"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { uploadImage } from "@/lib/upload-client";
import {
  authHeaders,
  getStoredAuth,
  readApi,
  readError,
} from "@/components/post/client-helpers";
import type { AuthData, MyProfile } from "@/components/post/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AUTH_STORAGE_KEY = "lenjoy.auth";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-slate-200 bg-white/95">
      <CardContent className="p-4">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}

export function MyProfileClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");

  const avatarPreview = useMemo(() => {
    const trimmed = avatarUrl.trim();
    return trimmed || "";
  }, [avatarUrl]);

  function syncAuthUser(nextProfile: MyProfile) {
    const current = getStoredAuth();
    if (!current) {
      return;
    }
    const nextAuth: AuthData = {
      ...current,
      user: {
        ...current.user,
        username: nextProfile.username,
        avatarUrl: nextProfile.avatarUrl ?? null,
        bio: nextProfile.bio ?? null,
      },
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
    window.dispatchEvent(
      new StorageEvent("storage", { key: AUTH_STORAGE_KEY }),
    );
  }

  async function loadProfile() {
    setLoading(true);
    try {
      const response = await fetch("/api/users/me", {
        headers: authHeaders(),
        cache: "no-store",
      });
      const payload = await readApi<MyProfile>(response);
      setProfile(payload.data);
      setUsername(payload.data.username || "");
      setAvatarUrl(payload.data.avatarUrl || "");
      setBio(payload.data.bio || "");
    } catch (error) {
      toast.error(readError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  async function onUploadAvatar(file: File) {
    setUploading(true);
    try {
      const imageUrl = await uploadImage(file);
      setAvatarUrl(imageUrl);
      toast.success("头像上传成功");
    } catch (error) {
      toast.error(readError(error));
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    const normalizedName = username.trim();
    if (normalizedName.length < 2 || normalizedName.length > 20) {
      toast.error("昵称长度需为 2-20 个字符");
      return;
    }
    if (!/^[\p{Script=Han}A-Za-z0-9_]+$/u.test(normalizedName)) {
      toast.error("昵称仅支持中文、字母、数字和下划线");
      return;
    }
    if (bio.trim().length > 200) {
      toast.error("简介最多 200 字");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          username: normalizedName,
          avatarUrl: avatarUrl.trim(),
          bio: bio.trim(),
        }),
      });
      const payload = await readApi<MyProfile>(response);
      setProfile(payload.data);
      setUsername(payload.data.username || "");
      setAvatarUrl(payload.data.avatarUrl || "");
      setBio(payload.data.bio || "");
      syncAuthUser(payload.data);
      toast.success("个人资料已保存");
    } catch (error) {
      toast.error(readError(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Card>
          <CardContent className="p-8 text-sm text-slate-500">
            加载个人资料中...
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <section className="rounded-2xl border border-slate-200 bg-linear-to-r from-emerald-50 via-white to-cyan-50 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">
          Personal Center
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">个人中心</h1>
        <p className="mt-2 text-sm text-slate-600">
          查看并编辑你的头像、昵称与简介。
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="发帖数" value={profile?.postCount ?? 0} />
        <StatCard label="关注数" value={profile?.followingCount ?? 0} />
        <StatCard label="粉丝数" value={profile?.followerCount ?? 0} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>编辑资料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="头像"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-slate-500">
                  {(username || profile?.username || "?")
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}
            </div>
            <div className="w-full space-y-2">
              <Label htmlFor="avatar-url">头像地址</Label>
              <Input
                id="avatar-url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.png"
              />
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <label className="cursor-pointer text-emerald-700 hover:text-emerald-800">
                  {uploading ? "上传中..." : "上传本地头像"}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void onUploadAvatar(file);
                      }
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                <span>支持 png/jpg/webp</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">昵称</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
            />
            <p className="text-xs text-slate-500">
              2-20 个字符，仅支持中文、字母、数字、下划线。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">简介</Label>
            <textarea
              id="bio"
              className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all placeholder:text-slate-400 focus-visible:border-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-700/20"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
              placeholder="介绍一下你自己吧"
            />
            <p className="text-right text-xs text-slate-500">
              {bio.length}/200
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">邮箱</p>
              <p>{profile?.email || "未绑定"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">手机号</p>
              <p>{profile?.phone || "未绑定"}</p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || uploading}
          >
            {saving ? "保存中..." : "保存资料"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
