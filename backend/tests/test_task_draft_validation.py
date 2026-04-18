"""Tests for server-side task draft validation (LLM output normalization)."""

from datetime import datetime, timedelta, timezone

from em_api.services.task_draft_llm import normalize_category, validate_task_draft_dict


def test_validate_simple_action_ok():
    fixed = datetime(2030, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
    out, err = validate_task_draft_dict(
        {
            "title": "Tweet something",
            "instructions": "Post once with hashtag #test",
            "category": "simple_action",
            "bounty_usdc": "2.5",
            "deadline_at": "2030-02-01T12:00:00+00:00",
        },
        now=fixed,
    )
    assert err is None
    assert out is not None
    assert out["category"] == "simple_action"
    assert out["bounty_micros"] == 2_500_000
    assert out["title"] == "Tweet something"


def test_physical_requires_location():
    fixed = datetime(2030, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
    out, err = validate_task_draft_dict(
        {
            "title": "Sky photo",
            "instructions": "Photo of sky now",
            "category": "physical_presence",
            "bounty_usdc": 0.05,
        },
        now=fixed,
    )
    assert out is None
    assert err == "physical_needs_location"


def test_physical_with_geo():
    fixed = datetime(2030, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
    deadline = fixed + timedelta(days=7)
    out, err = validate_task_draft_dict(
        {
            "title": "Sky photo Miami",
            "instructions": "Take a photo of current sky",
            "category": "physical_presence",
            "bounty_usdc": 0.05,
            "deadline_at": deadline.isoformat(),
            "location_lat": 25.7617,
            "location_lng": -80.1918,
        },
        now=fixed,
    )
    assert err is None
    assert out is not None
    assert out["location_lat"] == 25.7617
    assert out["location_lng"] == -80.1918
    assert out["location_radius_m"] == 5000


def test_normalize_category_synonyms():
    assert normalize_category("Physical presence") == "physical_presence"
    assert normalize_category("knowledge") == "knowledge_access"
    assert normalize_category("bad_xyz") is None


def test_deadline_defaults_when_omitted():
    fixed = datetime(2030, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
    out, err = validate_task_draft_dict(
        {
            "title": "T",
            "instructions": "I",
            "category": "simple_action",
            "bounty_usdc": 1,
        },
        now=fixed,
    )
    assert err is None
    assert out is not None
    parsed = datetime.fromisoformat(out["deadline_at"].replace("Z", "+00:00"))
    delta = parsed - fixed
    assert timedelta(hours=23) < delta < timedelta(hours=25)

