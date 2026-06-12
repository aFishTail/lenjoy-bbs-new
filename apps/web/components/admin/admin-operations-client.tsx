"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { requestApiData } from "@/components/post/client-helpers";

type AutomationItem = {
  item_id: string;
  status: string;
  parsed_title: string;
  last_error_message: string | null;
};

type AutomationTask = {
  task_id: string;
  status: string;
  item_count: number;
  success_count: number;
  created_at: string;
  items: AutomationItem[];
};

type AutomationList = { items: AutomationTask[]; total: number };

type TransferTask = {
  task_id: string;
  status: string;
  resource_title: string;
  saved_drive_path: string | null;
  error_message: string | null;
  webhook_status: string | null;
  webhook_attempt_count: number;
  created_at: string;
};

type TransferList = { items: TransferTask[]; total: number };

type QuarkStatus = {
  status: string;
  nickname: string | null;
  message: string | null;
};

function badgeClass(status: string) {
  if (status === "success" || status === "authenticated") return "is-active";
  if (status === "failed" || status.endsWith("_failed")) return "is-banned";
  return "is-muted";
}

export function AdminOperationsClient() {
  const [automation, setAutomation] = useState<AutomationList | null>(null);
  const [transfer, setTransfer] = useState<TransferList | null>(null);
  const [quark, setQuark] = useState<QuarkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [automationData, transferData, quarkData] = await Promise.all([
        requestApiData<AutomationList>(
          "/api/admin/operations/automation/automation/tasks?limit=50",
          { withAuth: true, cache: "no-store" },
        ),
        requestApiData<TransferList>(
          "/api/admin/operations/transfer/resource/transfer?limit=50",
          { withAuth: true, cache: "no-store" },
        ),
        requestApiData<QuarkStatus>(
          "/api/admin/operations/transfer/auth/quark/status",
          { withAuth: true, cache: "no-store" },
        ),
      ]);
      setAutomation(automationData);
      setTransfer(transferData);
      setQuark(quarkData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "任务中心加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function retry(path: string, id: string) {
    setBusyId(id);
    try {
      await requestApiData(path, { method: "POST", withAuth: true });
      toast.success("已提交重试");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重试失败");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="admin-main">
      <section className="admin-toolbar">
        <div>
          <h2>任务中心</h2>
          <p>统一查看自动化编排、网盘转存和账号状态。</p>
        </div>
        <button className="admin-btn" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} /> 刷新
        </button>
      </section>

      <section className="admin-kpi-grid">
        <article className="admin-kpi-card">
          <h3>自动化任务</h3>
          <p>{automation?.total ?? 0}</p>
        </article>
        <article className="admin-kpi-card">
          <h3>转存任务</h3>
          <p>{transfer?.total ?? 0}</p>
        </article>
        <article className="admin-kpi-card">
          <h3>夸克账号</h3>
          <p>{quark?.nickname || quark?.status || "未知"}</p>
          <span className={`admin-badge ${badgeClass(quark?.status || "")}`}>
            {quark?.status || "unknown"}
          </span>
        </article>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head"><h2>自动化编排</h2></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>任务</th><th>状态</th><th>进度</th><th>创建时间</th><th>操作</th></tr></thead>
            <tbody>
              {(automation?.items ?? []).map((task) => {
                const failed = task.items.find((item) =>
                  item.status === "transfer_failed" || item.status === "post_failed");
                return <tr key={task.task_id}>
                  <td>{task.task_id.slice(0, 12)}</td>
                  <td><span className={`admin-badge ${badgeClass(task.status)}`}>{task.status}</span></td>
                  <td>{task.success_count} / {task.item_count}</td>
                  <td>{new Date(task.created_at).toLocaleString()}</td>
                  <td>{failed && <button className="admin-btn" disabled={busyId === failed.item_id}
                    onClick={() => void retry(
                      `/api/admin/operations/automation/automation/items/${failed.item_id}/${failed.status === "post_failed" ? "retry-post" : "retry-transfer"}`,
                      failed.item_id,
                    )}><RotateCcw size={15} /> 重试</button>}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-head"><h2>网盘转存</h2></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>资源</th><th>状态</th><th>回调</th><th>目标路径</th><th>创建时间</th><th>操作</th></tr></thead>
            <tbody>
              {(transfer?.items ?? []).map((task) => <tr key={task.task_id}>
                <td>{task.resource_title}</td>
                <td><span className={`admin-badge ${badgeClass(task.status)}`}>{task.status}</span></td>
                <td>{task.webhook_status || "-"}{task.webhook_attempt_count ? ` (${task.webhook_attempt_count})` : ""}</td>
                <td>{task.saved_drive_path || "-"}</td>
                <td>{new Date(task.created_at).toLocaleString()}</td>
                <td>{task.status === "failed" && <button className="admin-btn" disabled={busyId === task.task_id}
                  onClick={() => void retry(`/api/admin/operations/transfer/resource/transfer/${task.task_id}/retry`, task.task_id)}>
                  <RotateCcw size={15} /> 重试
                </button>}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
