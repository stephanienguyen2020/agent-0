"""GET /api/v1/executors — validation and unavailable Supabase."""

import pytest
from fastapi.testclient import TestClient

from em_api.deps import get_chain
from em_api.main import app


@pytest.fixture
def client503(monkeypatch):
    monkeypatch.setattr("em_api.routes.executors.get_supabase", lambda: None)

    def _fake_chain():
        from unittest.mock import MagicMock

        m = MagicMock()
        m.healthy = lambda: True
        return m

    app.dependency_overrides[get_chain] = _fake_chain
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_list_executors_bad_type_returns_400(client503: TestClient):
    r = client503.get("/api/v1/executors", params={"type": "nope"})
    assert r.status_code == 400


def test_list_executors_no_supabase_returns_503(client503: TestClient):
    r = client503.get("/api/v1/executors")
    assert r.status_code == 503
