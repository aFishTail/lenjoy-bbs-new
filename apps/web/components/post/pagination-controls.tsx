"use client";

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
  disabled?: boolean;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  page,
  totalPages,
  total,
  pageSize,
  hasNext,
  hasPrevious,
  disabled = false,
  onPageChange,
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="card mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          第 {page} / {totalPages} 页，显示 {start}-{end} 条，共 {total} 条
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={disabled || !hasPrevious}
            onClick={() => onPageChange(page - 1)}
          >
            上一页
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={disabled || !hasNext}
            onClick={() => onPageChange(page + 1)}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
