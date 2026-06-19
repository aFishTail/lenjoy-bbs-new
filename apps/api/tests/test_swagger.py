"""Tests for Swagger/OpenAPI docs availability.

In development mode, /docs, /redoc, and /openapi.json should be accessible.
In production mode (APP_ENV != development), they must return 404 to avoid
exposing the API structure to potential attackers.
"""

from __future__ import annotations

import os

# Set env vars BEFORE importing the app
os.environ.setdefault("APP_ENV", "production")
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")
os.environ.setdefault("JWT_SECRET", "test-secret-that-is-at-least-32-chars-long-enough")
os.environ.setdefault("INTERNAL_SERVICE_TOKEN", "test-internal-token")

import pytest
from fastapi.testclient import TestClient


def _create_production_app():
    """Create app with APP_ENV=production — docs must be disabled."""
    os.environ["APP_ENV"] = "production"
    # Force re-import of settings with production env
    from lenjoy_bbs.core.config import get_settings
    get_settings.cache_clear()
    from lenjoy_bbs.main import create_app
    return create_app()


def _create_development_app():
    """Create app with APP_ENV=development — docs must be enabled."""
    os.environ["APP_ENV"] = "development"
    from lenjoy_bbs.core.config import get_settings
    get_settings.cache_clear()
    from lenjoy_bbs.main import create_app
    return create_app()


class TestSwaggerProduction禁用:
    def test_docs_returns_404_in_production(self):
        app = _create_production_app()
        client = TestClient(app)
        response = client.get("/docs")
        assert response.status_code == 404

    def test_redoc_returns_404_in_production(self):
        app = _create_production_app()
        client = TestClient(app)
        response = client.get("/redoc")
        assert response.status_code == 404

    def test_openapi_json_returns_404_in_production(self):
        app = _create_production_app()
        client = TestClient(app)
        response = client.get("/openapi.json")
        assert response.status_code == 404

    def test_docs_returns_200_in_development(self):
        app = _create_development_app()
        client = TestClient(app)
        response = client.get("/docs")
        assert response.status_code == 200

    def test_health_still_works_in_production(self):
        """Docs being disabled must not affect other endpoints."""
        app = _create_production_app()
        client = TestClient(app)
        response = client.get("/api/v1/health")
        assert response.status_code == 200
