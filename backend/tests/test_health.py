from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

import em_api.routes.health as health_mod
from em_api.deps import get_chain
from em_api.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(health_mod, "get_supabase", lambda: None)

    def _fake_chain():
        m = MagicMock()
        m.healthy = lambda: True
        return m

    app.dependency_overrides[get_chain] = _fake_chain
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health_ok(client: TestClient):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["supabase"] == "skipped"
    assert body["rpc_opbnb"] == "ok"
    assert body["status"] == "ok"
