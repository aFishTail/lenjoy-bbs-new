import ast
from pathlib import Path

from fastapi.testclient import TestClient

from lenjoy_bbs.main import create_app


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = PROJECT_ROOT / "lenjoy_bbs"


def _api_error_calls_with_literal_message() -> list[tuple[Path, int]]:
    violations: list[tuple[Path, int]] = []
    for path in SOURCE_ROOT.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            if not isinstance(node.func, ast.Name) or node.func.id != "ApiError":
                continue
            if node.args and isinstance(node.args[0], ast.Constant):
                violations.append((path.relative_to(PROJECT_ROOT), node.lineno))
    return violations


def test_api_errors_use_centralized_messages():
    assert _api_error_calls_with_literal_message() == []


def test_validation_error_top_level_message_is_chinese():
    app = create_app()
    with TestClient(app) as client:
        response = client.post("/api/v1/auth/login", json={})

    payload = response.json()
    assert response.status_code == 422
    assert payload["error"]["code"] == "VALIDATION_ERROR"
    assert payload["error"]["message"] == "请求参数校验失败"
    assert payload["meta"]["details"]


def test_not_found_route_message_is_chinese():
    app = create_app()
    with TestClient(app) as client:
        response = client.get("/api/v1/not-exists")

    payload = response.json()
    assert response.status_code == 404
    assert payload["error"]["code"] == "NOT_FOUND"
    assert payload["error"]["message"] == "接口不存在"


def test_auth_required_message_is_chinese():
    app = create_app()
    with TestClient(app) as client:
        response = client.get("/api/v1/users/me")

    payload = response.json()
    assert response.status_code == 401
    assert payload["error"]["code"] == "UNAUTHORIZED"
    assert payload["error"]["message"] == "请先登录"
