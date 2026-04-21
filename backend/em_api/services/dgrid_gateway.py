"""
DGrid AI Gateway — OpenAI-compatible chat completions (https://docs.dgrid.ai/AI-Gateway).

Used by draft-chat and assistant-chat when CHAT_LLM_PROVIDER=dgrid.
"""

from __future__ import annotations

import json
import logging
import ssl
import urllib.error
import urllib.request
from typing import Any

logger = logging.getLogger(__name__)


def _ssl_context() -> ssl.SSLContext:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def chat_completion(
    *,
    messages: list[dict[str, Any]],
    api_key: str,
    base_url: str,
    model: str,
    temperature: float = 0.25,
    timeout_sec: int = 90,
    http_referer: str | None = None,
    x_title: str = "Agent Zero",
) -> str:
    """
    POST {base_url}/chat/completions with Bearer auth.
    Returns assistant message content (plain string).
    """
    root = base_url.rstrip("/")
    url = f"{root}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "X-Title": x_title[:256],
    }
    if http_referer and http_referer.strip():
        headers["HTTP-Referer"] = http_referer.strip()[:2048]

    body = json.dumps(
        {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
    ).encode("utf-8")

    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec, context=_ssl_context()) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:1200]
        logger.warning("dgrid gateway HTTP %s: %s", e.code, err_body)
        raise RuntimeError(f"dgrid_http_{e.code}") from e
    except Exception as e:
        logger.warning("dgrid gateway error: %s", e)
        raise RuntimeError(f"dgrid_error:{e!s}") from e

    try:
        text = raw["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise RuntimeError("dgrid_bad_response")
    if not isinstance(text, str):
        raise RuntimeError("dgrid_bad_response")
    return text
