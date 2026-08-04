"use client";
import { useState, type ChangeEvent } from "react";
import { imageUrl } from "@/lib/utils";

/**
 * 商品图片上传：上传到 R2 取回 object key 写入隐藏 input（随商品表单提交），
 * 同时保留「粘贴外链 URL」的兼容输入。imageKey 存 key 或 http(s) 外链均可。
 */
export function ImageUpload({ name, defaultValue }: { name: string; defaultValue?: string | null }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { key?: string; error?: string };
      if (!res.ok || !data.key) setError(data.error || "上传失败");
      else setValue(data.key);
    } catch {
      setError("上传失败，请重试");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="mt-1 space-y-2">
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(value)}
            alt="预览"
            className="h-24 w-24 rounded-lg border object-cover"
          />
        ) : (
          <div className="grid h-24 w-24 place-items-center rounded-lg border text-3xl text-[var(--fg-muted)]">
            🖼️
          </div>
        )}
        <div className="space-y-2">
          <label className="btn-brand inline-flex h-9 cursor-pointer items-center rounded-lg px-3 text-xs font-medium">
            {uploading ? "上传中…" : "上传图片"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={onFile}
              disabled={uploading}
            />
          </label>
          {value && (
            <button
              type="button"
              onClick={() => setValue("")}
              className="ml-2 rounded-lg border px-3 py-1.5 text-xs hover:bg-[var(--bg-soft)]"
            >
              移除
            </button>
          )}
          <p className="text-xs text-[var(--fg-muted)]">支持 PNG/JPEG/WebP，≤5MB</p>
        </div>
      </div>
      <input
        className="input-base w-full px-3 py-2 text-sm"
        placeholder="或粘贴外部图片 URL"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
