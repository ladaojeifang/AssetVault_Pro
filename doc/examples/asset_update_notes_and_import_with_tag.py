#!/usr/bin/env python3
"""
AssetVault Pro Web API v1 示例：
1) 更新已有资产备注（PATCH /asset/update）
2) 导入一个资产后，自动加 tag 并写备注

前置：
  - AssetVault Pro 已启动，已打开资料库
  - 已启用 Web API
  - pip install requests
"""

from __future__ import annotations

import sys
from typing import Any

import requests

BASE_URL = "http://127.0.0.1:41596/api/v1"
API_TOKEN: str | None = None
TIMEOUT = 30
IMPORT_TIMEOUT = 120


def _headers() -> dict[str, str]:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if API_TOKEN:
        headers["Authorization"] = f"Bearer {API_TOKEN}"
    return headers


def api_request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
    timeout: int = TIMEOUT,
) -> dict[str, Any]:
    url = f"{BASE_URL.rstrip('/')}/{path.lstrip('/')}"
    resp = requests.request(
        method,
        url,
        headers=_headers(),
        params=params,
        json=json_body,
        timeout=timeout,
    )
    resp.raise_for_status()
    body = resp.json()
    if body.get("status") == "error":
        raise RuntimeError(f"{body.get('code')}: {body.get('message')}")
    return body


def list_tags() -> list[dict[str, Any]]:
    body = api_request("GET", "tag/get")
    data = body.get("data") or {}
    if isinstance(data, list):
        return data
    return data.get("data") or []


def ensure_tag(tag_name: str, color: str | None = None) -> str:
    for tag in list_tags():
        if tag.get("name") == tag_name:
            return str(tag["id"])

    payload: dict[str, Any] = {"name": tag_name}
    if color:
        payload["color"] = color
    created = api_request("POST", "tag/create", json_body=payload)
    return str(created["data"]["id"])


def update_asset_notes(asset_id: str, notes: str) -> dict[str, Any]:
    return api_request(
        "PATCH",
        "asset/update",
        json_body={"id": asset_id, "notes": notes},
    )["data"]


def import_asset(file_path: str, target_folder_id: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"filePath": file_path, "duplicatePolicy": "use_existing"}
    if target_folder_id:
        payload["targetFolderId"] = target_folder_id
    return api_request("POST", "asset/import", json_body=payload, timeout=IMPORT_TIMEOUT)["data"]


def assign_tag(asset_id: str, tag_id: str) -> None:
    api_request("POST", "tag/assign", json_body={"assetIds": [asset_id], "tagIds": [tag_id]})


def import_with_tag_and_notes(
    file_path: str,
    *,
    tag_name: str,
    notes: str,
    target_folder_id: str | None = None,
) -> str:
    """
    注意：导入接口不支持直接传 tag/notes。
    正确流程是：导入 -> tag/assign -> asset/update(notes)
    """
    result = import_asset(file_path, target_folder_id=target_folder_id)
    asset_id = result.get("assetId") or result.get("existingAssetId")
    if not asset_id:
        raise RuntimeError(f"导入结果未返回 assetId: {result}")

    tag_id = ensure_tag(tag_name)
    assign_tag(str(asset_id), tag_id)
    update_asset_notes(str(asset_id), notes)
    return str(asset_id)


def main() -> int:
    try:
        # 1) 更新已有资产备注：把这里改成真实资产 ID
        example_asset_id = "你的资产UUID"
        example_notes = "这是一条通过 Python API 更新的备注"
        # update_asset_notes(example_asset_id, example_notes)
        # print(f"已更新备注: {example_asset_id}")

        # 2) 导入资产并加 tag + 备注：把路径改成你本机真实文件
        file_path = r"G:\images\sample.jpg"
        asset_id = import_with_tag_and_notes(
            file_path,
            tag_name="人像",
            notes="导入时自动写入的备注（先导入，再打 tag，再更新备注）",
        )
        print(f"导入并处理完成，assetId={asset_id}")
        return 0
    except requests.ConnectionError:
        print("无法连接 API，请确认应用已启动且 Web API 已启用。", file=sys.stderr)
        return 1
    except RuntimeError as exc:
        print(f"API 错误: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
