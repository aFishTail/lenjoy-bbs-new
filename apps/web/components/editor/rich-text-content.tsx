"use client";

import purify from "dompurify";
const DOMPurify = (purify as any).default || purify;
import { useMemo } from "react";

type Props = {
  html?: string;
  className?: string;
};

export function RichTextContent({ html, className }: Props) {
  const safeHtml = useMemo(() => {
    const rawHtml = html || "";
    return DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "strong",
        "em",
        "u",
        "s",
        "blockquote",
        "code",
        "pre",
        "ul",
        "ol",
        "li",
        "a",
        "img",
        "br",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "title"],
      ALLOW_DATA_ATTR: false,
    });
  }, [html]);

  if (!safeHtml) {
    return null;
  }

  return (
    <div
      className={`rich-editor-render ${className || ""}`}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
