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

  const payload = await readApi<{ imageUrl: string }>(response);
  return payload.data.imageUrl;
}
