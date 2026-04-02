"use client";

import { useMemo, useState } from "react";

import type { TagSummary } from "@/components/post/types";

type TagPickerProps = {
  tags: TagSummary[];
  selectedTagIds: number[];
  onChange: (next: number[]) => void;
  maxTags?: number;
};

export function TagPicker({
  tags,
  selectedTagIds,
  onChange,
  maxTags = 5,
}: TagPickerProps) {
  const [keyword, setKeyword] = useState("");

  const filteredTags = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return tags;
    }
    return tags.filter((tag) => tag.name.toLowerCase().includes(normalized));
  }, [keyword, tags]);

  function toggleTag(tagId: number) {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
      return;
    }
    if (selectedTagIds.length >= maxTags) {
      return;
    }
    onChange([...selectedTagIds, tagId]);
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full px-4 py-3 rounded-xl border border-[var(--border-medium)] bg-white/60 text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
        placeholder="搜索标签"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {filteredTags.map((tag) => {
          const active = selectedTagIds.includes(tag.id);
          const disabled = !active && selectedTagIds.length >= maxTags;
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              disabled={disabled}
              className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                active
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                  : "bg-white text-[var(--text-sub)] border-[var(--border-medium)] hover:border-[var(--color-primary)]"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {tag.name}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        已选 {selectedTagIds.length}/{maxTags}
      </p>
    </div>
  );
}
