"""POST /api/v1/tasks/{task_id}/approve-evidence + gated verify."""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from em_api.config import settings
from em_api.deps import get_chain
from em_api.main import app


@pytest.fixture
def api_base(monkeypatch):
    monkeypatch.setattr(settings, "requester_approval_before_verify", True)
    yield


@pytest.fixture
def client_mock(api_base, monkeypatch):
    task_waiting = {
        "task_id": "t1",
        "status": "awaiting_requester_review",
        "agent_id": "aid",
        "executor_id": "eid",
        "category": "physical_presence",
        "bounty_micros": 1_000_000,
    }

    def table(name: str):
        tb = MagicMock()
        if name == "tasks":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=task_waiting)
            tb.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{}])
        elif name == "agents":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(
                data={"wallet": "0x1111111111111111111111111111111111111111"}
            )
        elif name == "executors":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data={})
        return tb

    supa = MagicMock()
    supa.table.side_effect = table
    monkeypatch.setattr("em_api.routes.tasks.get_supabase", lambda: supa)

    def _chain():
        m = MagicMock()
        m.healthy = lambda: True
        return m

    app.dependency_overrides[get_chain] = _chain
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_approve_evidence_wrong_wallet_returns_403(api_base, monkeypatch):
    task_waiting = {
        "task_id": "t1",
        "status": "awaiting_requester_review",
        "agent_id": "aid",
    }

    def table(name: str):
        tb = MagicMock()
        if name == "tasks":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=task_waiting)
        elif name == "agents":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(
                data={"wallet": "0x1111111111111111111111111111111111111111"}
            )
        return tb

    monkeypatch.setattr("em_api.routes.tasks.get_supabase", lambda: MagicMock(table=MagicMock(side_effect=table)))

    app.dependency_overrides[get_chain] = lambda: MagicMock(healthy=lambda: True)
    try:
        c = TestClient(app)
        r = c.post(
            "/api/v1/tasks/t1/approve-evidence",
            json={"wallet": "0x2222222222222222222222222222222222222222"},
        )
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_approve_evidence_ok(client_mock: TestClient):
    r = client_mock.post(
        "/api/v1/tasks/t1/approve-evidence",
        json={"wallet": "0x1111111111111111111111111111111111111111"},
    )
    assert r.status_code == 200
    assert r.json().get("status") == "submitted"


def test_verify_returns_403_when_awaiting_review(monkeypatch):
    monkeypatch.setattr(settings, "requester_approval_before_verify", True)
    task_wait = {
        "task_id": "t1",
        "status": "awaiting_requester_review",
        "category": "physical_presence",
    }
    supa = MagicMock()
    supa.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(
        data=task_wait
    )
    monkeypatch.setattr("em_api.routes.tasks.get_supabase", lambda: supa)

    app.dependency_overrides[get_chain] = lambda: MagicMock(healthy=lambda: True)
    try:
        c = TestClient(app)
        r = c.post("/api/v1/tasks/t1/verify")
        assert r.status_code == 403
        assert "approval" in (r.json().get("detail") or "").lower()
    finally:
        app.dependency_overrides.clear()


def test_approve_gate_disabled_returns_409(monkeypatch):
    monkeypatch.setattr(settings, "requester_approval_before_verify", False)
    task_waiting = {
        "task_id": "t1",
        "status": "awaiting_requester_review",
        "agent_id": "aid",
    }

    def table(name: str):
        tb = MagicMock()
        if name == "tasks":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=task_waiting)
        elif name == "agents":
            tb.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(
                data={"wallet": "0x1111111111111111111111111111111111111111"}
            )
        return tb

    monkeypatch.setattr("em_api.routes.tasks.get_supabase", lambda: MagicMock(table=MagicMock(side_effect=table)))

    app.dependency_overrides[get_chain] = lambda: MagicMock(healthy=lambda: True)
    try:
        c = TestClient(app)
        r = c.post(
            "/api/v1/tasks/t1/approve-evidence",
            json={"wallet": "0x1111111111111111111111111111111111111111"},
        )
        assert r.status_code == 409
    finally:
        app.dependency_overrides.clear()
