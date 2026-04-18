"""CLI: PYTHONPATH=backend:agents python -m emagents.workflow_demo"""

from __future__ import annotations

import argparse
import json
import sys
from http.server import HTTPServer

from emagents.bootstrap import ensure_backend_import_path

ensure_backend_import_path()

from emagents.workflow_demo.http_mirror import start_http_mirror  # noqa: E402
from emagents.workflow_demo.runner import (  # noqa: E402
    SharedState,
    load_config,
    make_emitter,
    run_workflow,
)


def main() -> None:
    p = argparse.ArgumentParser(description="Terminal demo: onboard → publish → accept")
    p.add_argument(
        "--plain",
        action="store_true",
        help="Print JSON lines per event (no Rich UI)",
    )
    p.add_argument(
        "--http-ui",
        metavar="PORT",
        type=int,
        nargs="?",
        const=8765,
        default=None,
        help="Serve GET /state + static UI on 127.0.0.1:PORT (default 8765)",
    )
    args = p.parse_args()

    try:
        cfg = load_config()
    except RuntimeError as e:
        print(e, file=sys.stderr)
        sys.exit(1)

    shared = SharedState()
    emit = make_emitter(shared)

    def emit_plain(ev: dict) -> None:
        emit(ev)
        print(json.dumps(ev, default=str), flush=True)

    mirror_srv: HTTPServer | None = None
    if args.http_ui is not None:
        mirror_srv = start_http_mirror(shared, "127.0.0.1", int(args.http_ui))
        print(
            f"HTTP mirror http://127.0.0.1:{args.http_ui}/  (JSON: /state)",
            file=sys.stderr,
        )

    try:
        if args.plain:
            summary = run_workflow(cfg, emit_plain)
        else:
            try:
                from emagents.workflow_demo.ui_rich import run_interactive
            except ImportError:
                print(
                    "Rich not installed; install agents[demo] or use --plain",
                    file=sys.stderr,
                )
                summary = run_workflow(cfg, emit_plain)
            else:
                summary = run_interactive(cfg, shared, emit)
    finally:
        if mirror_srv is not None:
            mirror_srv.shutdown()

    print(json.dumps({"ok": True, "summary": summary}, default=str), flush=True)


if __name__ == "__main__":
    main()
