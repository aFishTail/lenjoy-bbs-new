"use client";

/**
 * Read-only banner that ships with every page of the legacy
 * BBS admin shell during the migration window.
 *
 * The unified administration plane (`admin-web` in the platform
 * repo) now owns the operator UI; the BBS service is the data
 * owner. The legacy admin is kept mounted for one release cycle
 * to support the cutover, but every page must carry this banner
 * so operators land on the new admin (`/ops/`) for any state
 * change.
 *
 * The banner is read-only; the underlying BBS service endpoints
 * are still reachable (so operators can read history), but the
 * plan (`bbs-admin-migration` MB7) marks this surface as
 * "read-only" in the parity doc and removes the standalone
 * mount once the platform-cutover plan flips the flag.
 */
import Link from "next/link";
import styles from "./admin-shell.module.css";

export function AdminReadOnlyBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className={styles.readOnlyBanner}
      data-testid="admin-read-only-banner"
    >
      <div>
        <strong>本面板已迁移。</strong>
        所有变更请在新的统一后台 <code>/ops/</code> 完成；本页面仅用于只读审计。
      </div>
      <Link
        href="/ops/overview/dashboard"
        className={styles.readOnlyBannerLink}
      >
        前往新后台 →
      </Link>
    </div>
  );
}
