#!/usr/bin/env python3
"""
在当前资料库中确保存在名为「人像」的标签：已存在则返回，不存在则创建。

前置：AssetVault Pro 已启动、已打开资料库、Web API 已启用。
依赖：pip install requests

用法：
  python doc/examples/ensure_tag_renxiao.py
"""

from __future__ import annotations

import sys
from typing import Any

import requests

BASE_URL = "http://127.0.0.1:41596/api/v1"
API_TOKEN: str | None = None
TAG_NAME = "人像"
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
    """按名称精确匹配（区分大小写）。"""
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


def ensure_tag(name: str = TAG_NAME, *, color: str | None = None) -> dict[str, Any]:
    """
    返回标签对象（含 id、name、color 等）。
    第二个返回值语义：created=True 表示本次新建，False 表示已存在。
    """
    existing = find_tag_by_name(name)
    if existing:
        return {**existing, "_created": False}
    created = create_tag(name, color=color)
    return {**created, "_created": True}


def main() -> int:
    try:
        tag = ensure_tag(TAG_NAME)
    except requests.ConnectionError:
        print("无法连接 API，请确认 AssetVault 已启动且 Web API 已启用。", file=sys.stderr)
        return 1
    except RuntimeError as e:
        print(f"API 错误: {e}", file=sys.stderr)
        return 1

    if tag.pop("_created"):
        print(f"已创建标签「{TAG_NAME}」: id={tag['id']}")
    else:
        print(f"标签「{TAG_NAME}」已存在: id={tag['id']}, usageCount={tag.get('usageCount', 0)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
