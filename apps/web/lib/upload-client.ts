import { authHeaders, readApi } from "@/components/post/client-helpers";

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/files/images", {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });

  const payload = await readApi<{ url?: string; imageUrl?: string }>(response);
  const imageUrl = payload.data.url || payload.data.imageUrl;
  if (!imageUrl) {
    throw new Error("上传成功，但未返回图片地址");
  }
  return imageUrl;
}
