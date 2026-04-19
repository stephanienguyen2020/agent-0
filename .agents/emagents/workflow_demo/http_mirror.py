"""Optional localhost JSON + static HTML mirror for workflow_demo."""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from emagents.workflow_demo.runner import SharedState


def start_http_mirror(shared: SharedState, host: str, port: int) -> HTTPServer:
    """Start background daemon thread serving GET /state and GET /."""

    static_dir = Path(__file__).resolve().parent / "static"
    index_path = static_dir / "index.html"

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args: object) -> None:
            return

        def do_GET(self) -> None:
            raw = self.path.split("?", 1)[0]
            if raw == "/state":
                payload = json.dumps(
                    {
                        "events": shared.events,
                        "error": shared.last_error,
                    },
                    indent=2,
                ).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return

            if raw in ("/", "/index.html"):
                if index_path.is_file():
                    html = index_path.read_bytes()
                else:
                    html = b"<pre>missing static/index.html</pre>"
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(html)))
                self.end_headers()
                self.wfile.write(html)
                return

            self.send_response(404)
            self.end_headers()

    server = HTTPServer((host, port), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server
