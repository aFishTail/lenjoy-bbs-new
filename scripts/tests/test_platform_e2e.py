import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from scripts.platform_e2e import (
    AcceptanceReport,
    E2EConfig,
    PlatformAcceptance,
    load_env_file,
    poll_until,
    redact,
)


class E2EConfigTest(unittest.TestCase):
    def test_smoke_config_only_requires_internal_token(self) -> None:
        config = E2EConfig.from_env(
            {"INTERNAL_SERVICE_TOKEN": "internal"},
            require_full=False,
        )

        self.assertEqual(config.internal_service_token, "internal")
        self.assertEqual(config.resource_url, "")

    def test_from_env_parses_resource_post_configuration(self) -> None:
        config = E2EConfig.from_env({
            "E2E_RESOURCE_URL": "https://pan.quark.cn/s/example",
            "E2E_FORUM_AUTHOR_BINDING_CODE": "author",
            "E2E_FORUM_CATEGORY_ID": "7",
            "E2E_FORUM_TAG_IDS": "1,2",
            "E2E_FORUM_HIDDEN_CONTENT": "hidden",
            "E2E_FORUM_PRICE": "9",
            "INTERNAL_SERVICE_TOKEN": "internal",
            "FORUM_API_KEY": "forum",
        })

        self.assertEqual(config.forum_category_id, 7)
        self.assertEqual(config.forum_tag_ids, [1, 2])
        self.assertEqual(config.forum_price, 9)

    def test_env_file_does_not_override_process_environment(self) -> None:
        with TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            path.write_text("FORUM_API_KEY=file-key\nE2E_FORUM_PRICE=9\n", encoding="utf-8")

            values = load_env_file(path, {"FORUM_API_KEY": "process-key"})

        self.assertEqual(values["FORUM_API_KEY"], "process-key")
        self.assertEqual(values["E2E_FORUM_PRICE"], "9")


class PollUntilTest(unittest.TestCase):
    def test_retries_configured_transient_exception(self) -> None:
        attempts = iter([RuntimeError("starting"), {"status": "ok"}])

        def fetch():
            value = next(attempts)
            if isinstance(value, Exception):
                raise value
            return value

        result = poll_until(
            fetch,
            is_success=lambda value: value["status"] == "ok",
            is_failure=lambda value: False,
            timeout_seconds=5,
            interval_seconds=0,
            retry_exceptions=(RuntimeError,),
            monotonic=iter([0, 1, 2]).__next__,
            sleep=lambda _: None,
        )

        self.assertEqual(result["status"], "ok")

    def test_returns_first_terminal_success(self) -> None:
        values = iter([{"status": "queued"}, {"status": "success"}])

        result = poll_until(
            lambda: next(values),
            is_success=lambda value: value["status"] == "success",
            is_failure=lambda value: value["status"] == "failed",
            timeout_seconds=5,
            interval_seconds=0,
            monotonic=iter([0, 1, 2]).__next__,
            sleep=lambda _: None,
        )

        self.assertEqual(result["status"], "success")

    def test_raises_on_timeout(self) -> None:
        with self.assertRaises(TimeoutError):
            poll_until(
                lambda: {"status": "queued"},
                is_success=lambda value: False,
                is_failure=lambda value: False,
                timeout_seconds=1,
                interval_seconds=0,
                monotonic=iter([0, 2]).__next__,
                sleep=lambda _: None,
            )


class RedactionTest(unittest.TestCase):
    def test_redacts_nested_secret_values(self) -> None:
        value = {"token": "secret", "nested": ["prefix-secret-suffix"]}

        self.assertEqual(
            redact(value, {"secret"}),
            {"token": "***", "nested": ["prefix-***-suffix"]},
        )


class FakePlatform:
    def __init__(self) -> None:
        self.deleted_post_ids = []
        self.create_count = 0

    def run_smoke(self) -> None:
        return None

    def create_task(self, payload):
        self.create_count += 1
        if self.create_count == 1:
            return {
                "task_id": "task-1",
                "status": "running",
                "items": [{
                    "item_id": "item-1",
                    "status": "transfer_queued",
                    "transfer_task_id": "transfer-1",
                    "forum_post_id": None,
                }],
            }
        raise RuntimeError("replay failed")

    def get_task(self, task_id):
        return {
            "task_id": task_id,
            "status": "success",
            "items": [{
                "item_id": "item-1",
                "status": "success",
                "transfer_task_id": "transfer-1",
                "forum_post_id": "42",
            }],
        }

    def restart_automation(self) -> None:
        return None

    def delete_post(self, post_id: str) -> None:
        self.deleted_post_ids.append(post_id)

    def post_exists(self, post_id: str) -> bool:
        return True


class PlatformAcceptanceTest(unittest.TestCase):
    def test_payload_uses_run_specific_transfer_target_path(self) -> None:
        config = E2EConfig.from_env({
            "E2E_RESOURCE_URL": "https://pan.quark.cn/s/example",
            "E2E_FORUM_AUTHOR_BINDING_CODE": "author",
            "E2E_FORUM_CATEGORY_ID": "7",
            "E2E_FORUM_HIDDEN_CONTENT": "hidden",
            "E2E_FORUM_PRICE": "9",
            "INTERNAL_SERVICE_TOKEN": "internal",
            "FORUM_API_KEY": "forum",
        })
        acceptance = PlatformAcceptance(config, FakePlatform(), AcceptanceReport())

        payload = acceptance._payload()

        self.assertEqual(payload["transfer_target_path"][:2], ["resource-transfer", "e2e"])
        self.assertEqual(payload["transfer_target_path"][2], payload["idempotency_scope"])

    def test_full_flow_attempts_cleanup_after_published_failure(self) -> None:
        config = E2EConfig.from_env({
            "E2E_RESOURCE_URL": "https://pan.quark.cn/s/example",
            "E2E_FORUM_AUTHOR_BINDING_CODE": "author",
            "E2E_FORUM_CATEGORY_ID": "7",
            "E2E_FORUM_HIDDEN_CONTENT": "hidden",
            "E2E_FORUM_PRICE": "9",
            "INTERNAL_SERVICE_TOKEN": "internal",
            "FORUM_API_KEY": "forum",
        })
        platform = FakePlatform()
        acceptance = PlatformAcceptance(
            config,
            platform,
            AcceptanceReport(),
            poll=lambda fetch, **_: fetch(),
        )

        with self.assertRaisesRegex(RuntimeError, "replay failed"):
            acceptance.run_full()

        self.assertEqual(platform.deleted_post_ids, ["42"])


if __name__ == "__main__":
    unittest.main()
