"""Spawn verifier, settlement, reputation workers as subprocesses (local dev).

Usage from repo root::

    PYTHONPATH=backend python agents/emagents/run_all.py

Requires `pip install -e backend` and `pip install -e agents` (or PYTHONPATH includes both).
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    env = os.environ.copy()
    py = sys.executable
    pyp = os.pathsep.join([str(ROOT / "backend"), str(ROOT / "agents")])
    env["PYTHONPATH"] = pyp
    procs: list[subprocess.Popen[str]] = []
    cmds = [
        [py, "-m", "emagents.verifier_worker"],
        [py, "-m", "emagents.settlement"],
        [py, "-m", "emagents.reputation"],
    ]
    try:
        for cmd in cmds:
            procs.append(
                subprocess.Popen(
                    cmd,
                    cwd=str(ROOT),
                    env=env,
                )
            )
        print("Started:", cmds, "(Ctrl+C exits)")
        for p in procs:
            p.wait()
    except KeyboardInterrupt:
        for p in procs:
            p.terminate()


if __name__ == "__main__":
    main()
