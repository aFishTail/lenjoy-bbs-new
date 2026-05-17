"use client";

import { useEffect, useId } from "react";

import { Button } from "@/components/ui/button";
import styles from "./confirm-dialog.module.css";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  confirmBusy?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  confirmDisabled = false,
  confirmBusy = false,
  onConfirm,
  onOpenChange,
  children,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !confirmBusy) {
        onOpenChange(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmBusy, onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.backdrop}
      onClick={() => {
        if (!confirmBusy) {
          onOpenChange(false);
        }
      }}
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 id={titleId} className={styles.title}>
            {title}
          </h3>
          {description ? (
            <p id={descriptionId} className={styles.description}>
              {description}
            </p>
          ) : null}
        </div>

        {children ? <div className={styles.body}>{children}</div> : null}

        <div className={styles.actions}>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirmBusy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled || confirmBusy}
          >
            {confirmBusy ? "提交中..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
