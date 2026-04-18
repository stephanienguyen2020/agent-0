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
    load_accept_config,
    load_config,
    load_publish_config,
    load_verify_display_config,
    make_emitter,
    run_accept_only,
    run_approve_and_verify,
    run_approve_only,
    run_publish_only,
    run_submit_only,
    run_verify_only,
    run_workflow,
)


def main() -> None:
    p = argparse.ArgumentParser(
        description="Terminal demo: onboard → publish → accept; optional submit → approve → verify",
    )
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
    p.add_argument(
        "--publish-only",
        action="store_true",
        help="Only POST /tasks (publisher env keys). For two-terminal live demos.",
    )
    p.add_argument(
        "--accept-only",
        action="store_true",
        help="Only POST .../accept (executor env keys). Use with --task-id.",
    )
    p.add_argument(
        "--submit-only",
        action="store_true",
        help="Only POST .../submit (multipart evidence for knowledge_access). Use with --task-id.",
    )
    p.add_argument(
        "--approve-only",
        action="store_true",
        help="Only POST .../approve-evidence (publisher wallet). Use with --task-id.",
    )
    p.add_argument(
        "--verify-only",
        action="store_true",
        help="Only POST .../verify (verifier + settlement). Use with --task-id.",
    )
    p.add_argument(
        "--approve-verify",
        action="store_true",
        help="POST approve-evidence then verify (publisher keys). Use with --task-id.",
    )
    p.add_argument(
        "--task-id",
        default="",
        help="Task id (tk_…) for split modes: accept, submit, approve, verify, approve-verify.",
    )
    p.add_argument(
        "--skip-onboard",
        action="store_true",
        help="With --accept-only: skip agent-challenge/agent-verify (executor already verified).",
    )
    args = p.parse_args()

    split_flags = (
        args.publish_only,
        args.accept_only,
        args.submit_only,
        args.approve_only,
        args.verify_only,
        args.approve_verify,
    )
    if sum(1 for x in split_flags if x) > 1:
        print("Use at most one of --publish-only, --accept-only, --submit-only, …", file=sys.stderr)
        sys.exit(2)

    need_task_id = (
        args.accept_only
        or args.submit_only
        or args.approve_only
        or args.verify_only
        or args.approve_verify
    )
    if need_task_id and not args.task_id.strip():
        print("This mode requires --task-id tk_…", file=sys.stderr)
        sys.exit(2)
    if args.task_id.strip() and not need_task_id:
        print(
            "--task-id is only for --accept-only, --submit-only, --approve-only, --verify-only, --approve-verify",
            file=sys.stderr,
        )
        sys.exit(2)
    if args.publish_only and args.task_id.strip():
        print("--task-id is not used with --publish-only", file=sys.stderr)
        sys.exit(2)

    if need_task_id:
        tid_chk = args.task_id.strip()
        if len(tid_chk) == 42 and tid_chk.startswith("0x"):
            hexpart = tid_chk[2:]
            if len(hexpart) == 40 and all(c in "0123456789abcdefABCDEF" for c in hexpart):
                print(
                    "--task-id looks like an Ethereum address (0x…). Use the task id from "
                    "`--publish-only` / JSON summary (starts with tk_), not your wallet.",
                    file=sys.stderr,
                )
                sys.exit(2)

    cfg = None
    try:
        if args.publish_only:
            cfg = load_publish_config()
        elif args.accept_only:
            cfg = load_accept_config()
        elif args.submit_only:
            cfg = load_accept_config()
        elif args.approve_only or args.approve_verify:
            cfg = load_publish_config()
        elif args.verify_only:
            cfg = load_verify_display_config()
        else:
            cfg = load_config()
    except RuntimeError as e:
        print(e, file=sys.stderr)
        sys.exit(1)

    assert cfg is not None

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

    tid = args.task_id.strip()

    def run_selected() -> dict:
        if args.publish_only:
            return run_publish_only(cfg, emit_plain if args.plain else emit)
        if args.accept_only:
            return run_accept_only(
                cfg,
                tid,
                emit_plain if args.plain else emit,
                skip_onboard=args.skip_onboard,
            )
        if args.submit_only:
            return run_submit_only(cfg, tid, emit_plain if args.plain else emit)
        if args.approve_only:
            return run_approve_only(cfg, tid, emit_plain if args.plain else emit)
        if args.verify_only:
            return run_verify_only(cfg.base_url, tid, emit_plain if args.plain else emit)
        if args.approve_verify:
            return run_approve_and_verify(cfg, tid, emit_plain if args.plain else emit)
        return run_workflow(cfg, emit_plain if args.plain else emit)

    subtitle = "onboard → publish → accept"
    if args.publish_only:
        subtitle = "publish only"
    elif args.accept_only:
        subtitle = "accept only"
    elif args.submit_only:
        subtitle = "submit only"
    elif args.approve_only:
        subtitle = "approve only"
    elif args.verify_only:
        subtitle = "verify only"
    elif args.approve_verify:
        subtitle = "approve + verify"

    try:
        if args.plain:
            summary = run_selected()
        else:
            try:
                from emagents.workflow_demo.ui_rich import run_interactive
            except ImportError:
                print(
                    "Rich not installed; install agents[demo] or use --plain",
                    file=sys.stderr,
                )
                summary = run_selected()
            else:
                summary = run_interactive(cfg, shared, emit, runner=run_selected, subtitle=subtitle)
    finally:
        if mirror_srv is not None:
            mirror_srv.shutdown()

    if args.publish_only and summary.get("task_id"):
        p_tid = summary["task_id"]
        print(
            f"\nTASK_ID={p_tid}\n(pass to Terminal 2: --accept-only --task-id {p_tid})\n",
            file=sys.stderr,
        )

    if args.submit_only and summary.get("task_id"):
        s_tid = summary["task_id"]
        print(
            f"\nNext (Terminal 1): --approve-verify --task-id {s_tid}\n"
            f"  (or --approve-only then --verify-only if REQUESTER_APPROVAL_BEFORE_VERIFY=false use --verify-only only)\n",
            file=sys.stderr,
        )

    print(json.dumps({"ok": True, "summary": summary}, default=str), flush=True)


if __name__ == "__main__":
    main()
