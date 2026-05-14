import json
import logging

from fastapi.testclient import TestClient

from lenjoy_bbs.core.logging import RequestContextFilter, get_logger
from lenjoy_bbs.main import create_app


class JsonCaptureHandler(logging.Handler):
    def __init__(self) -> None:
        super().__init__()
        self.messages: list[dict] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.messages.append(json.loads(self.format(record)))


def attach_json_handler() -> tuple[logging.Logger, JsonCaptureHandler]:
    root = logging.getLogger()
    handler = JsonCaptureHandler()
    handler.setFormatter(root.handlers[0].formatter)
    handler.addFilter(RequestContextFilter())
    root.addHandler(handler)
    return root, handler


def find_event(messages: list[dict], event: str) -> dict:
    for message in messages:
        if message.get("event") == event:
            return message
    raise AssertionError(f"missing log event: {event}")


def register_user(client: TestClient, username: str) -> str:
    captcha = client.get("/api/v1/auth/captcha").json()["data"]
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "password": "correct horse battery staple",
            "email": f"{username}@example.com",
            "captchaId": captcha["captchaId"],
            "captchaCode": captcha["debugCode"],
        },
    )
    assert response.status_code == 201
    return response.json()["data"]["accessToken"]


def test_request_id_is_generated_and_logged():
    app = create_app()
    root, handler = attach_json_handler()

    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/auth/captcha")
    finally:
        root.removeHandler(handler)

    request_log = find_event(handler.messages, "http.request")

    assert response.status_code == 200
    assert response.headers["X-Request-Id"]
    assert request_log["request_id"] == response.headers["X-Request-Id"]
    assert request_log["path"] == "/api/v1/auth/captcha"
    assert request_log["method"] == "GET"
    assert request_log["status_code"] == 200


def test_request_id_header_is_preserved_when_provided():
    app = create_app()
    root, handler = attach_json_handler()

    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/auth/captcha", headers={"X-Request-Id": "external-123"})
    finally:
        root.removeHandler(handler)

    request_log = find_event(handler.messages, "http.request")

    assert response.headers["X-Request-Id"] == "external-123"
    assert request_log["request_id"] == "external-123"


def test_validation_error_logs_warning_without_stack():
    app = create_app()
    root, handler = attach_json_handler()

    try:
        with TestClient(app) as client:
            response = client.post("/api/v1/auth/login", json={})
    finally:
        root.removeHandler(handler)

    error_log = find_event(handler.messages, "request.validation_error")

    assert response.status_code == 422
    assert error_log["level"] == "WARNING"
    assert "exception" not in error_log


def test_unhandled_exception_logs_stack_and_request_id():
    app = create_app()
    root, handler = attach_json_handler()

    @app.get("/boom")
    async def boom():
        raise RuntimeError("boom")

    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.get("/boom")
    finally:
        root.removeHandler(handler)

    error_log = find_event(handler.messages, "request.unhandled_exception")

    assert response.status_code == 500
    assert response.headers["X-Request-Id"]
    assert error_log["level"] == "ERROR"
    assert error_log["request_id"] == response.headers["X-Request-Id"]
    assert "RuntimeError: boom" in error_log["exception"]


def test_formatter_redacts_sensitive_fields():
    app = create_app()
    root, handler = attach_json_handler()
    logger = get_logger("lenjoy_bbs.tests")

    @app.get("/redact")
    async def redact():
        logger.info(
            "redaction.check",
            extra={
                "event": "redaction.check",
                "password": "plain-secret",
                "token": "jwt-token",
                "authorization": "Bearer abc",
                "captcha_code": "1234",
            },
        )
        return {"ok": True}

    try:
        with TestClient(app) as client:
            response = client.get("/redact")
    finally:
        root.removeHandler(handler)

    redaction_log = find_event(handler.messages, "redaction.check")

    assert response.status_code == 200
    assert redaction_log["password"] == "[REDACTED]"
    assert redaction_log["token"] == "[REDACTED]"
    assert redaction_log["authorization"] == "[REDACTED]"
    assert redaction_log["captcha_code"] == "[REDACTED]"


def test_authenticated_request_log_contains_user_id():
    app = create_app()
    root, handler = attach_json_handler()

    try:
        with TestClient(app) as client:
            token = register_user(client, "log-user")
            response = client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    finally:
        root.removeHandler(handler)

    request_log = find_event([message for message in handler.messages if message.get("path") == "/api/v1/me"], "http.request")

    assert response.status_code == 200
    assert request_log["user_id"] > 0


def test_login_failure_emits_business_log_without_password():
    app = create_app()
    root, handler = attach_json_handler()

    try:
        with TestClient(app) as client:
            captcha = client.get("/api/v1/auth/captcha").json()["data"]
            response = client.post(
                "/api/v1/auth/login",
                json={
                    "account": "nobody",
                    "password": "wrong-secret",
                    "captchaId": captcha["captchaId"],
                    "captchaCode": captcha["debugCode"],
                },
            )
    finally:
        root.removeHandler(handler)

    login_log = find_event(handler.messages, "auth.login_failed")

    assert response.status_code == 401
    assert login_log["reason"] == "bad_credentials"
    assert "password" not in login_log
