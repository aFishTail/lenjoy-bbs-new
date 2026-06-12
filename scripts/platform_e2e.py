from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable, Mapping


class AcceptanceError(RuntimeError):
    pass


def load_env_file(path: Path, base: Mapping[str, str]) -> dict[str, str]:
    values = dict(base)
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values.setdefault(key.strip(), value.strip())
    return values


@dataclass(frozen=True)
class E2EConfig:
    resource_url: str
    forum_author_binding_code: str
    forum_category_id: int
    forum_tag_ids: list[int]
    forum_hidden_content: str
    forum_price: int
    internal_service_token: str
    forum_api_key: str
    timeout_seconds: float = 900
    poll_interval_seconds: float = 3

    @classmethod
    def from_env(
        cls,
        env: Mapping[str, str],
        *,
        require_full: bool = True,
    ) -> "E2EConfig":
        required = ["INTERNAL_SERVICE_TOKEN"]
        if require_full:
            required.extend([
            "E2E_RESOURCE_URL",
            "E2E_FORUM_AUTHOR_BINDING_CODE",
            "E2E_FORUM_CATEGORY_ID",
            "E2E_FORUM_HIDDEN_CONTENT",
            "E2E_FORUM_PRICE",
            "FORUM_API_KEY",
            ])
        missing = [name for name in required if not env.get(name, "").strip()]
        if missing:
            raise AcceptanceError(
                f"Missing required environment variables: {', '.join(missing)}"
            )
        tag_ids = [
            int(value.strip())
            for value in env.get("E2E_FORUM_TAG_IDS", "").split(",")
            if value.strip()
        ]
        return cls(
            resource_url=env.get("E2E_RESOURCE_URL", "").strip(),
            forum_author_binding_code=env.get("E2E_FORUM_AUTHOR_BINDING_CODE", "").strip(),
            forum_category_id=int(env.get("E2E_FORUM_CATEGORY_ID", "0")),
            forum_tag_ids=tag_ids,
            forum_hidden_content=env.get("E2E_FORUM_HIDDEN_CONTENT", ""),
            forum_price=int(env.get("E2E_FORUM_PRICE", "0")),
            internal_service_token=env["INTERNAL_SERVICE_TOKEN"],
            forum_api_key=env.get("FORUM_API_KEY", ""),
            timeout_seconds=float(env.get("E2E_TIMEOUT_SECONDS", "900")),
            poll_interval_seconds=float(env.get("E2E_POLL_INTERVAL_SECONDS", "3")),
        )


def poll_until(
    fetch: Callable[[], Any],
    *,
    is_success: Callable[[Any], bool],
    is_failure: Callable[[Any], bool],
    timeout_seconds: float,
    interval_seconds: float,
    retry_exceptions: tuple[type[Exception], ...] = (),
    monotonic: Callable[[], float] = time.monotonic,
    sleep: Callable[[float], None] = time.sleep,
) -> Any:
    started = monotonic()
    while True:
        try:
            value = fetch()
        except retry_exceptions:
            if monotonic() - started >= timeout_seconds:
                raise TimeoutError(f"Timed out after {timeout_seconds} seconds")
            sleep(interval_seconds)
            continue
        if is_success(value):
            return value
        if is_failure(value):
            raise AcceptanceError(f"Terminal failure: {value}")
        if monotonic() - started >= timeout_seconds:
            raise TimeoutError(f"Timed out after {timeout_seconds} seconds")
        sleep(interval_seconds)


def redact(value: Any, secrets: set[str]) -> Any:
    active = {secret for secret in secrets if secret}
    if isinstance(value, dict):
        return {key: redact(item, active) for key, item in value.items()}
    if isinstance(value, list):
        return [redact(item, active) for item in value]
    if isinstance(value, str):
        result = value
        for secret in active:
            result = result.replace(secret, "***")
        return result
    return value


@dataclass
class AcceptanceReport:
    started_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    finished_at: str | None = None
    success: bool = False
    task_id: str | None = None
    item_id: str | None = None
    transfer_task_id: str | None = None
    forum_post_id: str | None = None
    automation_restarted: bool = False
    replay_duplicate: bool = False
    cleanup_attempted: bool = False
    cleanup_succeeded: bool = False
    events: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None

    def event(self, name: str, **details: Any) -> None:
        self.events.append({
            "timestamp": datetime.now(UTC).isoformat(),
            "name": name,
            **details,
        })

    def finish(self, *, success: bool, error: str | None = None) -> None:
        self.finished_at = datetime.now(UTC).isoformat()
        self.success = success
        self.error = error

    def write(self, path: Path, secrets: set[str]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(redact(asdict(self), secrets), indent=2, ensure_ascii=True),
            encoding="utf-8",
        )


class ComposeClient:
    _HTTP_SCRIPT = """
import base64,json,sys,urllib.error,urllib.request
method,url,headers_raw,payload_raw=sys.argv[1:5]
headers=json.loads(base64.b64decode(headers_raw))
payload=None if payload_raw == '-' else base64.b64decode(payload_raw)
request=urllib.request.Request(url,data=payload,headers=headers,method=method)
try:
    response=urllib.request.urlopen(request,timeout=30)
    status=response.status
    body=response.read().decode()
except urllib.error.HTTPError as exc:
    status=exc.code
    body=exc.read().decode()
print(json.dumps({"status":status,"body":body}))
""".strip()

    def __init__(self, root: Path, compose_file: Path, env_file: Path) -> None:
        self.root = root
        self.compose_file = compose_file
        self.env_file = env_file

    def run(self, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
        command = [
            "docker",
            "compose",
            "--env-file",
            str(self.env_file),
            "-f",
            str(self.compose_file),
            *args,
        ]
        return subprocess.run(
            command,
            cwd=self.root,
            check=check,
            capture_output=True,
            text=True,
        )

    def request(
        self,
        service: str,
        url: str,
        *,
        method: str = "GET",
        headers: dict[str, str] | None = None,
        payload: dict[str, Any] | None = None,
    ) -> tuple[int, Any]:
        request_headers = dict(headers or {})
        payload_bytes = None
        if payload is not None:
            request_headers["Content-Type"] = "application/json"
            payload_bytes = json.dumps(payload).encode()
        encoded_headers = base64.b64encode(json.dumps(request_headers).encode()).decode()
        encoded_payload = (
            base64.b64encode(payload_bytes).decode() if payload_bytes is not None else "-"
        )
        result = self.run(
            "exec",
            "-T",
            service,
            "python",
            "-c",
            self._HTTP_SCRIPT,
            method,
            url,
            encoded_headers,
            encoded_payload,
        )
        envelope = json.loads(result.stdout)
        body = envelope["body"]
        try:
            body = json.loads(body)
        except json.JSONDecodeError:
            pass
        return int(envelope["status"]), body


class ComposePlatform:
    def __init__(self, config: E2EConfig, compose: ComposeClient, report: AcceptanceReport) -> None:
        self.config = config
        self.compose = compose
        self.report = report
        self.internal_headers = {"X-Service-Token": config.internal_service_token}

    @staticmethod
    def _require_status(status: int, expected: int, body: Any) -> Any:
        if status != expected:
            raise AcceptanceError(f"Expected HTTP {expected}, got {status}: {body}")
        return body

    def run_smoke(self) -> None:
        self.compose.run("config", "--quiet")
        checks = [
            ("api", "http://127.0.0.1:8080/api/v1/health", {}),
            ("automation-service", "http://127.0.0.1:8010/api/v1/health", {}),
            ("transfer-service", "http://127.0.0.1:8008/api/v1/health", {}),
        ]
        for service, url, headers in checks:
            status, body = poll_until(
                lambda: self.compose.request(service, url, headers=headers),
                is_success=lambda result: result[0] == 200,
                is_failure=lambda _: False,
                timeout_seconds=self.config.timeout_seconds,
                interval_seconds=self.config.poll_interval_seconds,
                retry_exceptions=(subprocess.CalledProcessError,),
            )
            self._require_status(status, 200, body)
        for service, url in [
            ("automation-service", "http://127.0.0.1:8010/api/v1/automation/tasks"),
            ("transfer-service", "http://127.0.0.1:8008/api/v1/resource/transfer"),
        ]:
            status, _ = self.compose.request(service, url)
            if status != 401:
                raise AcceptanceError(f"{service} accepted unauthenticated management request")
        status, body = self.compose.request(
            "transfer-service",
            "http://127.0.0.1:8008/api/v1/auth/quark/status",
            headers=self.internal_headers,
        )
        self._require_status(status, 200, body)
        if body.get("status") != "authenticated":
            raise AcceptanceError(f"Quark authentication is not ready: {body.get('status')}")
        self.report.event("smoke_passed")

    def create_task(self, payload: dict[str, Any]) -> dict[str, Any]:
        status, body = self.compose.request(
            "automation-service",
            "http://127.0.0.1:8010/api/v1/automation/tasks",
            method="POST",
            headers=self.internal_headers,
            payload=payload,
        )
        return self._require_status(status, 201, body)

    def get_task(self, task_id: str) -> dict[str, Any]:
        status, body = self.compose.request(
            "automation-service",
            f"http://127.0.0.1:8010/api/v1/automation/tasks/{task_id}",
            headers=self.internal_headers,
        )
        return self._require_status(status, 200, body)

    def restart_automation(self) -> None:
        self.compose.run("restart", "automation-service")

    def delete_post(self, post_id: str) -> None:
        status, body = self.compose.request(
            "api",
            f"http://127.0.0.1:8080/api/v1/open/posts/{post_id}",
            method="DELETE",
            headers={"X-API-Key": self.config.forum_api_key},
        )
        self._require_status(status, 200, body)

    def post_exists(self, post_id: str) -> bool:
        status, _ = self.compose.request(
            "api",
            f"http://127.0.0.1:8080/api/v1/posts/{post_id}",
        )
        return status == 200


class PlatformAcceptance:
    def __init__(
        self,
        config: E2EConfig,
        platform: Any,
        report: AcceptanceReport,
        *,
        poll: Callable[..., Any] = poll_until,
    ) -> None:
        self.config = config
        self.platform = platform
        self.report = report
        self.poll = poll

    def _payload(self) -> dict[str, Any]:
        run_id = datetime.now(UTC).strftime("%Y%m%d-%H%M%S-%f")
        return {
            "source_type": "e2e",
            "idempotency_scope": run_id,
            "transfer_target_path": ["resource-transfer", "e2e", run_id],
            "forum_post_type": "RESOURCE",
            "forum_author_binding_code": self.config.forum_author_binding_code,
            "forum_category_id": self.config.forum_category_id,
            "forum_tag_ids": self.config.forum_tag_ids,
            "items": [{
                "source_url": self.config.resource_url,
                "parsed_title": f"[E2E][{run_id}] Platform acceptance",
                "parsed_content": "Automated platform acceptance post.",
                "forum_hidden_content": self.config.forum_hidden_content,
                "forum_price": self.config.forum_price,
            }],
        }

    @staticmethod
    def _item(task: dict[str, Any]) -> dict[str, Any]:
        items = task.get("items") or []
        if len(items) != 1:
            raise AcceptanceError(f"Expected one task item, got {len(items)}")
        return items[0]

    def run_smoke(self) -> None:
        self.platform.run_smoke()

    def run_full(self) -> None:
        payload = self._payload()
        try:
            self.run_smoke()
            task = self.platform.create_task(payload)
            item = self._item(task)
            self.report.task_id = task["task_id"]
            self.report.item_id = item["item_id"]
            self.report.transfer_task_id = item.get("transfer_task_id")
            self.report.event("task_created", status=item["status"])

            self.poll(
                lambda: self.platform.get_task(task["task_id"]),
                is_success=lambda value: self._item(value)["status"] != "pending",
                is_failure=lambda value: self._item(value)["status"]
                in {"transfer_failed", "post_failed", "cancelled"},
                timeout_seconds=self.config.timeout_seconds,
                interval_seconds=self.config.poll_interval_seconds,
            )
            self.platform.restart_automation()
            self.report.automation_restarted = True
            self.report.event("automation_restarted")

            completed = self.poll(
                lambda: self.platform.get_task(task["task_id"]),
                is_success=lambda value: self._item(value)["status"] == "success",
                is_failure=lambda value: self._item(value)["status"]
                in {"transfer_failed", "post_failed", "cancelled"},
                timeout_seconds=self.config.timeout_seconds,
                interval_seconds=self.config.poll_interval_seconds,
            )
            completed_item = self._item(completed)
            self.report.transfer_task_id = completed_item.get("transfer_task_id")
            self.report.forum_post_id = completed_item.get("forum_post_id")
            if not self.report.forum_post_id:
                raise AcceptanceError("Successful task did not produce forum_post_id")

            replay = self.platform.create_task(payload)
            if self._item(replay)["status"] != "duplicate":
                raise AcceptanceError(f"Replay was not duplicate: {replay}")
            self.report.replay_duplicate = True
            self.report.event("replay_verified")

            self._cleanup()
            if self.platform.post_exists(self.report.forum_post_id):
                raise AcceptanceError("Forum post still exists after cleanup")
            self.report.finish(success=True)
        except Exception as exc:
            if self.report.forum_post_id and not self.report.cleanup_succeeded:
                try:
                    self._cleanup()
                except Exception as cleanup_exc:
                    self.report.event("cleanup_failed", error=str(cleanup_exc))
            self.report.finish(success=False, error=str(exc))
            raise

    def _cleanup(self) -> None:
        if not self.report.forum_post_id:
            return
        self.report.cleanup_attempted = True
        self.platform.delete_post(self.report.forum_post_id)
        self.report.cleanup_succeeded = True
        self.report.event("forum_post_deleted", post_id=self.report.forum_post_id)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Lenjoy platform E2E acceptance runner")
    parser.add_argument("mode", choices=["smoke", "full"], nargs="?", default="full")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--compose-file", type=Path, default=Path("infra/docker/docker-compose.yml"))
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    parser.add_argument("--report", type=Path, default=Path("artifacts/platform-e2e-report.json"))
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = args.root.resolve()
    env_file = (root / args.env_file).resolve()
    config = E2EConfig.from_env(
        load_env_file(env_file, os.environ),
        require_full=args.mode == "full",
    )
    compose = ComposeClient(
        root,
        (root / args.compose_file).resolve(),
        env_file,
    )
    report = AcceptanceReport()
    platform = ComposePlatform(config, compose, report)
    acceptance = PlatformAcceptance(config, platform, report)
    try:
        acceptance.run_smoke() if args.mode == "smoke" else acceptance.run_full()
        if args.mode == "smoke":
            report.finish(success=True)
        return_code = 0
    except Exception as exc:
        if report.finished_at is None:
            report.finish(success=False, error=str(exc))
        print(f"E2E acceptance failed: {exc}", file=sys.stderr)
        return_code = 1
    report.write(
        (root / args.report).resolve(),
        {
            config.internal_service_token,
            config.forum_api_key,
            config.forum_hidden_content,
        },
    )
    return return_code


if __name__ == "__main__":
    raise SystemExit(main())
