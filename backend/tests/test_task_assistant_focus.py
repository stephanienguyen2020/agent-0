"""Focus task id inference for vague executor/acceptance follow-ups."""

from em_api.services.task_assistant_llm import (
    _resolve_focus_task_id,
    _user_needs_executor_followup,
)


def test_user_needs_executor_followup_detects_question():
    assert _user_needs_executor_followup("did anyone accept the task?")
    assert _user_needs_executor_followup("Who took it?")
    assert _user_needs_executor_followup("Is it still published?")


def test_user_needs_executor_followup_skips_when_task_id_present():
    tid = "tk_" + "a" * 32
    assert not _user_needs_executor_followup(f"What about {tid}?")


def test_resolve_focus_single_tid_in_assistant():
    tid = "tk_" + "b" * 32
    got = _resolve_focus_task_id(
        latest_user_text="did anyone accept?",
        last_assistant_text=f"Here is your task {tid}.",
        recent_tasks_rows=[],
    )
    assert got == tid


def test_resolve_focus_most_recent_line_multiple_tids():
    a = "tk_" + "a" * 32
    b = "tk_" + "c" * 32
    assistant = f"""Most recent task:\n{b}\nOlder:\n{a}\n"""
    got = _resolve_focus_task_id(
        latest_user_text="did anyone accept the task?",
        last_assistant_text=assistant,
        recent_tasks_rows=[{"task_id": a}],
    )
    assert got == b


def test_resolve_focus_fallback_first_recent_row():
    first = "tk_" + "d" * 32
    got = _resolve_focus_task_id(
        latest_user_text="who accepted?",
        last_assistant_text="No ids here.",
        recent_tasks_rows=[{"task_id": first}, {"task_id": "tk_" + "e" * 32}],
    )
    assert got == first
