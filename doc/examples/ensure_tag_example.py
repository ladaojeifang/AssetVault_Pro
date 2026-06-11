#!/usr/bin/env python3
"""
Ensure a tag exists in the current library (create if missing).

Prerequisites: AssetVault Pro running, library open, Web API enabled.
  pip install requests

Usage:
  python doc/examples/ensure_tag_example.py --name "reference"
  python doc/examples/ensure_tag_example.py --name "portraits" --color "#3b82f6"
"""

from __future__ import annotations

import argparse
import sys
from typing import Any

import requests

BASE_URL = "http://127.0.0.1:41596/api/v1"
API_TOKEN: str | None = None
TIMEOUT = 30


def _headers() -> dict[str, str]:
    h: dict[str, str] = {"Content-Type": "application/json"}
    if API_TOKEN:
        h["Authorization"] = f"Bearer {API_TOKEN}"
    return h


def api_request(method: str, path: str, **kwargs: Any) -> dict[str, Any]:
    url = f"{BASE_URL.rstrip('/')}/{path.lstrip('/')}"
    resp = requests.request(method, url, headers=_headers(), timeout=TIMEOUT, **kwargs)
    resp.raise_for_status()
    body = resp.json()
    if body.get("status") == "error":
        raise RuntimeError(f"{body.get('code')}: {body.get('message')}")
    return body


def list_tags() -> list[dict[str, Any]]:
    body = api_request("GET", "tag/get")
    inner = body.get("data") or {}
    if isinstance(inner, list):
        return inner
    return inner.get("data") or []


def find_tag_by_name(name: str) -> dict[str, Any] | None:
    for tag in list_tags():
        if tag.get("name") == name:
            return tag
    return None


def create_tag(name: str, *, color: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"name": name}
    if color:
        payload["color"] = color
    body = api_request("POST", "tag/create", json=payload)
    return body["data"]


def ensure_tag(name: str, *, color: str | None = None) -> tuple[dict[str, Any], bool]:
    existing = find_tag_by_name(name)
    if existing:
        return existing, False
    return create_tag(name, color=color), True


def main() -> int:
    parser = argparse.ArgumentParser(description="Ensure a tag exists via Web API v1")
    parser.add_argument("--name", required=True, help="Tag display name")
    parser.add_argument("--color", default=None, help="Optional hex color, e.g. #3b82f6")
    args = parser.parse_args()

    try:
        tag, created = ensure_tag(args.name, color=args.color)
    except requests.ConnectionError:
        print("Cannot reach API — is AssetVault running with Web API enabled?", file=sys.stderr)
        return 1
    except RuntimeError as e:
        print(f"API error: {e}", file=sys.stderr)
        return 1

    if created:
        print(f"Created tag {args.name!r}: id={tag['id']}")
    else:
        print(f"Tag {args.name!r} already exists: id={tag['id']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
