"""POST /api/v1/tasks/{task_id}/dispute — validation, authz, and duplicate handling."""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from em_api.deps import get_chain
from em_api.main import app


@pytest.fixture
def client_no_supabase(monkeypatch):
    monkeypatch.setattr("em_api.routes.tasks.get_supabase", lambda: None)

    def _fake_chain():
        m = MagicMock()
        m.healthy = lambda: True
        m.escrow_task_status_uint = lambda _: 3
        m.dispute = lambda *a, **k: "0x" + "ab" * 32
        m.wait_for_transaction = lambda h: None
        return m

    app.dependency_overrides[get_chain] = _fake_chain
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def client_with_mocks(monkeypatch):
    task = {
        "task_id": "task-1",
        "status": "submitted",
        "agent_id": "agent-uuid",
        "executor_id": "exec-uuid",
    }
    agent = {"wallet": "0x1111111111111111111111111111111111111111"}
    executor = {"wallet": "0x2222222222222222222222222222222222222222"}

    def table(name: str):
        tb = MagicMock()
        if name == "tasks":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=task)
            tb.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{}])
        elif name == "agents":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=agent)
        elif name == "executors":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=executor)
        elif name == "disputes":
            tb.select.return_value.eq.return_value.in_.return_value.limit.return_value.execute.return_value = (
                MagicMock(data=[])
            )
            tb.insert.return_value.execute.return_value = MagicMock(data=[{"id": "disp-1"}])
        return tb

    supa = MagicMock()
    supa.table.side_effect = table
    monkeypatch.setattr("em_api.routes.tasks.get_supabase", lambda: supa)

    def _fake_chain():
        m = MagicMock()
        m.healthy = lambda: True
        m.escrow_task_status_uint = lambda _: 3
        m.dispute = lambda *a, **k: "0x" + "cd" * 32
        m.wait_for_transaction = lambda h: None
        return m

    app.dependency_overrides[get_chain] = _fake_chain
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_open_dispute_no_supabase_returns_503(client_no_supabase: TestClient):
    r = client_no_supabase.post(
        "/api/v1/tasks/x/dispute",
        json={"wallet": "0x1", "reason": "short reason ok"},
    )
    assert r.status_code == 503


def test_open_dispute_reason_too_short_returns_422(client_no_supabase: TestClient):
    r = client_no_supabase.post(
        "/api/v1/tasks/x/dispute",
        json={"wallet": "0x1", "reason": "no"},
    )
    assert r.status_code == 422


def test_open_dispute_wrong_wallet_returns_403(client_with_mocks: TestClient):
    r = client_with_mocks.post(
        "/api/v1/tasks/task-1/dispute",
        json={"wallet": "0x9999999999999999999999999999999999999999", "reason": "valid reason text"},
    )
    assert r.status_code == 403


def test_open_dispute_executor_wallet_ok(client_with_mocks: TestClient):
    r = client_with_mocks.post(
        "/api/v1/tasks/task-1/dispute",
        json={"wallet": "0x2222222222222222222222222222222222222222", "reason": "valid reason text"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["task_id"] == "task-1"
    assert body["raised_by"] == "executor"
    assert body["on_chain_tx_dispute"].startswith("0x")


def test_open_dispute_duplicate_returns_409(monkeypatch):
    task = {
        "task_id": "task-1",
        "status": "submitted",
        "agent_id": "agent-uuid",
        "executor_id": "exec-uuid",
    }
    agent = {"wallet": "0x1111111111111111111111111111111111111111"}
    executor = {"wallet": "0x2222222222222222222222222222222222222222"}

    def table(name: str):
        tb = MagicMock()
        if name == "tasks":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=task)
        elif name == "agents":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=agent)
        elif name == "executors":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=executor)
        elif name == "disputes":
            tb.select.return_value.eq.return_value.in_.return_value.limit.return_value.execute.return_value = (
                MagicMock(data=[{"id": "existing"}])
            )
        return tb

    supa = MagicMock()
    supa.table.side_effect = table
    monkeypatch.setattr("em_api.routes.tasks.get_supabase", lambda: supa)

    def _fake_chain():
        m = MagicMock()
        m.healthy = lambda: True
        m.escrow_task_status_uint = lambda _: 3
        return m

    app.dependency_overrides[get_chain] = _fake_chain
    try:
        c = TestClient(app)
        r = c.post(
            "/api/v1/tasks/task-1/dispute",
            json={"wallet": "0x2222222222222222222222222222222222222222", "reason": "valid reason text"},
        )
        assert r.status_code == 409
    finally:
        app.dependency_overrides.clear()
