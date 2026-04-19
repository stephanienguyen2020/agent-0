"""POST /api/v1/tasks/{task_id}/resolve-dispute — operator key, state, idempotency."""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from em_api.config import settings
from em_api.deps import get_chain
from em_api.main import app


@pytest.fixture
def resolve_key(monkeypatch):
    monkeypatch.setattr(settings, "em_resolve_api_key", "test-secret-resolve-key")
    yield
    monkeypatch.setattr(settings, "em_resolve_api_key", "")


@pytest.fixture
def client_resolve(resolve_key, monkeypatch):
    task = {
        "task_id": "task-1",
        "status": "disputed",
        "agent_id": "agent-uuid",
        "executor_id": "exec-uuid",
        "category": "physical_presence",
        "bounty_micros": 1_000_000,
    }

    def table(name: str):
        tb = MagicMock()
        if name == "tasks":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=task)
            tb.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{}])
        elif name == "disputes":
            tb.select.return_value.eq.return_value.in_.return_value.order.return_value.limit.return_value.execute.return_value = (
                MagicMock(data=[{"id": "disp-uuid", "status": "open"}])
            )
            tb.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{}])
        elif name == "executors":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(
                data={"erc8004_agent_id": 1}
            )
        elif name == "reputation_events":
            tb.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[]
            )
            tb.insert.return_value.execute.return_value = MagicMock(data=[{"id": "re-1"}])
        return tb

    supa = MagicMock()
    supa.table.side_effect = table
    monkeypatch.setattr("em_api.routes.tasks.get_supabase", lambda: supa)

    def _fake_chain():
        m = MagicMock()
        m.healthy = lambda: True
        m.escrow_task_status_uint = lambda _: 6
        m.resolve_dispute = lambda *a, **k: "0x" + "ee" * 32
        m.wait_for_transaction = lambda h: None
        return m

    app.dependency_overrides[get_chain] = _fake_chain
    yield TestClient(app), supa
    app.dependency_overrides.clear()


def test_resolve_em_resolve_key_not_configured_returns_503(monkeypatch):
    monkeypatch.setattr(settings, "em_resolve_api_key", "")
    monkeypatch.setattr("em_api.routes.tasks.get_supabase", lambda: MagicMock())

    def _fake_chain():
        return MagicMock(healthy=lambda: True)

    app.dependency_overrides[get_chain] = _fake_chain
    try:
        c = TestClient(app)
        r = c.post(
            "/api/v1/tasks/x/resolve-dispute",
            json={"executor_wins": True},
            headers={"X-EM-RESOLVE-KEY": "any"},
        )
        assert r.status_code == 503
    finally:
        app.dependency_overrides.clear()


def test_resolve_missing_header_returns_401(resolve_key, monkeypatch):
    monkeypatch.setattr("em_api.routes.tasks.get_supabase", lambda: MagicMock())

    def _fake_chain():
        m = MagicMock()
        m.healthy = lambda: True
        return m

    app.dependency_overrides[get_chain] = _fake_chain
    try:
        c = TestClient(app)
        r = c.post("/api/v1/tasks/x/resolve-dispute", json={"executor_wins": True})
        assert r.status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_resolve_wrong_key_returns_403(resolve_key, monkeypatch):
    monkeypatch.setattr("em_api.routes.tasks.get_supabase", lambda: MagicMock())

    def _fake_chain():
        m = MagicMock()
        m.healthy = lambda: True
        return m

    app.dependency_overrides[get_chain] = _fake_chain
    try:
        c = TestClient(app)
        r = c.post(
            "/api/v1/tasks/x/resolve-dispute",
            json={"executor_wins": True},
            headers={"X-EM-RESOLVE-KEY": "wrong"},
        )
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_resolve_executor_wins_ok(client_resolve):
    c, _ = client_resolve
    r = c.post(
        "/api/v1/tasks/task-1/resolve-dispute",
        json={"executor_wins": True},
        headers={"X-EM-RESOLVE-KEY": "test-secret-resolve-key"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["task_id"] == "task-1"
    assert body["executor_wins"] is True
    assert body["dispute_status"] == "resolved_executor"


def test_resolve_not_disputed_returns_409(resolve_key, monkeypatch):
    monkeypatch.setattr(settings, "em_resolve_api_key", "test-secret-resolve-key")
    task = {
        "task_id": "task-1",
        "status": "submitted",
        "agent_id": "a",
        "executor_id": "e",
    }

    def table(name: str):
        tb = MagicMock()
        if name == "tasks":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=task)
        return tb

    supa = MagicMock()
    supa.table.side_effect = table
    monkeypatch.setattr("em_api.routes.tasks.get_supabase", lambda: supa)

    def _fake_chain():
        m = MagicMock()
        return m

    app.dependency_overrides[get_chain] = _fake_chain
    try:
        c = TestClient(app)
        r = c.post(
            "/api/v1/tasks/task-1/resolve-dispute",
            json={"executor_wins": True},
            headers={"X-EM-RESOLVE-KEY": "test-secret-resolve-key"},
        )
        assert r.status_code == 409
    finally:
        app.dependency_overrides.clear()


def test_resolve_no_active_dispute_row_returns_409(resolve_key, monkeypatch):
    monkeypatch.setattr(settings, "em_resolve_api_key", "test-secret-resolve-key")
    task = {
        "task_id": "task-1",
        "status": "disputed",
        "agent_id": "a",
        "executor_id": "e",
    }

    def table(name: str):
        tb = MagicMock()
        if name == "tasks":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=task)
        elif name == "disputes":
            tb.select.return_value.eq.return_value.in_.return_value.order.return_value.limit.return_value.execute.return_value = (
                MagicMock(data=[])
            )
        return tb

    supa = MagicMock()
    supa.table.side_effect = table
    monkeypatch.setattr("em_api.routes.tasks.get_supabase", lambda: supa)

    def _fake_chain():
        m = MagicMock()
        m.escrow_task_status_uint = lambda _: 6
        return m

    app.dependency_overrides[get_chain] = _fake_chain
    try:
        c = TestClient(app)
        r = c.post(
            "/api/v1/tasks/task-1/resolve-dispute",
            json={"executor_wins": False},
            headers={"X-EM-RESOLVE-KEY": "test-secret-resolve-key"},
        )
        assert r.status_code == 409
    finally:
        app.dependency_overrides.clear()
