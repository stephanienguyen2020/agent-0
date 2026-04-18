"""Rich terminal UI for workflow_demo."""

from __future__ import annotations

import threading
import time
from typing import Any, Callable

from rich.console import Console
from rich.live import Live
from rich.panel import Panel

from emagents.workflow_demo.runner import WorkflowConfig, SharedState, run_workflow


def run_interactive(cfg: WorkflowConfig, shared: SharedState, emit: Callable[[dict[str, Any]], None]) -> dict[str, Any]:
    """Run workflow in a thread while updating a Rich Live panel."""
    console = Console()
    result: list[Any] = []
    err: list[str] = []

    def worker() -> None:
        try:
            result.append(run_workflow(cfg, emit))
        except Exception as e:
            err.append(str(e))
            shared.last_error = str(e)
            emit({"phase": "error", "message": str(e)})

    t = threading.Thread(target=worker, daemon=True)
    t.start()

    with Live(console=console, refresh_per_second=15) as live:
        while t.is_alive():
            lines: list[str] = [
                f"API {cfg.base_url}",
                f"X-PAYMENT skip (dev): {cfg.skip_payment}",
                "",
            ]
            if not shared.events:
                lines.append("(starting…)")
            for ev in shared.events[-22:]:
                ph = ev.get("phase", "?")
                st = ev.get("http_status")
                ok = ev.get("ok")
                tid = ev.get("task_id", "")
                bit = f"• {ph}"
                if st is not None:
                    bit += f"  HTTP {st}"
                if ok is not None:
                    bit += f"  ok={ok}"
                if tid:
                    bit += f"  task_id={tid}"
                lines.append(bit)
            if shared.last_error:
                lines.append("")
                lines.append(f"Error: {shared.last_error}")

            live.update(
                Panel(
                    "\n".join(lines),
                    title="emagents.workflow_demo",
                    subtitle="onboard → publish → accept",
                    border_style="bright_blue",
                ),
            )
            time.sleep(0.06)

        t.join(timeout=2.0)

    if err:
        console.print("[red]Workflow failed:[/red]", err[0])
        raise RuntimeError(err[0])

    if not result:
        raise RuntimeError("workflow produced no result")
    return result[0]
