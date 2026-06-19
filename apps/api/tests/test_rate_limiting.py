"""Tests for rate limiting on auth endpoints."""

from fastapi.testclient import TestClient


def test_captcha_rate_limit_returns_429():
    """Sending more than 20 captcha requests per minute should trigger a 429.

    Uses the GET /captcha endpoint (no request body required) so that
    rate limiting is the only factor — invalid payloads don't cause 422
    validation errors before the rate limit is checked.
    """
    from lenjoy_bbs.core.config import get_settings

    get_settings.cache_clear()
    from lenjoy_bbs.main import create_app

    app = create_app()
    client = TestClient(app)

    # The captcha endpoint is limited to 20/minute.
    # Send 25 rapid requests — at least one should be 429.
    responses = []
    for _ in range(25):
        resp = client.get("/api/v1/auth/captcha")
        responses.append(resp.status_code)

    assert 429 in responses, f"Expected 429 in responses, got {responses}"


def test_health_not_rate_limited():
    """The health endpoint should never be rate limited."""
    from lenjoy_bbs.core.config import get_settings

    get_settings.cache_clear()
    from lenjoy_bbs.main import create_app

    app = create_app()
    client = TestClient(app)

    for _ in range(30):
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
