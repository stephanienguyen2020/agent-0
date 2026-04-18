"""Example TaskIntake APEX shim — serves `POST /job` echo (publish stays on FastAPI).

Run::

    PYTHONPATH=backend uvicorn emagents.task_intake.__main__:app --host 127.0.0.1 --port 8765
"""

from __future__ import annotations

from emagents.apex_shim import create_job_app


def handle_intake(params: dict) -> dict:
    return {"accepted": True, "params_echo": params}


app = create_job_app(name="task-intake", handler=lambda p: handle_intake(p))
