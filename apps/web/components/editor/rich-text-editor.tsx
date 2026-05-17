"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { uploadImage } from "@/lib/upload-client";
import styles from "./rich-text.module.css";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeightClassName = "min-h-[220px]",
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        defaultProtocol: "https",
      }),
      Image,
      Placeholder.configure({
        placeholder: placeholder || "请输入内容...",
      }),
    ],
    content: value || "",
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `${styles.content} ${minHeightClassName}`,
      },
    },
  });

  const handleImageUpload = useCallback(async () => {
    setUploadError("");
    const file = fileInputRef.current?.files?.[0];
    if (!file || !editor) {
      return;
    }
    try {
      const imageUrl = await uploadImage(file);
      editor.chain().focus().setImage({ src: imageUrl }).run();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "上传图片失败");
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const current = editor.getHTML();
    if (current === (value || "")) {
      return;
    }
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  const setLink = useCallback(() => {
    if (!editor) {
      return;
    }
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("输入链接地址", prev || "https://");
    if (url === null) {
      return;
    }
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();
  }, [editor]);

  if (!editor) {
    return (
      <div className="rounded-xl border border-(--border-medium) bg-white/50 px-4 py-3 text-(--text-muted)">
        编辑器加载中...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-(--border-medium) bg-white/50 overflow-hidden">
      <div className={styles.toolbar}>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? styles.isActive : ""}
        >
          粗体
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? styles.isActive : ""}
        >
          斜体
        </button>
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={
            editor.isActive("heading", { level: 2 }) ? styles.isActive : ""
          }
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive("bulletList") ? styles.isActive : ""}
        >
          列表
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive("blockquote") ? styles.isActive : ""}
        >
          引用
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive("codeBlock") ? styles.isActive : ""}
        >
          代码块
        </button>
        <button
          type="button"
          onClick={setLink}
          className={editor.isActive("link") ? styles.isActive : ""}
        >
          链接
        </button>
        <label className={styles.uploadButton}>
          图片
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={() => {
              void handleImageUpload();
            }}
          />
        </label>
      </div>
      <EditorContent editor={editor} />
      {uploadError && (
        <div className="px-3 pb-3 text-sm text-red-600">{uploadError}</div>
      )}
    </div>
  );
}
