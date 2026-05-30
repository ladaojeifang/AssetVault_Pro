#!/usr/bin/env python3
"""
AssetVault Pro Web API v1 — 使用 requests 导入资产示例

前置条件：
  1. AssetVault Pro 已启动，且已打开资料库
  2. 设置 → Advanced → 开发者 · Web API → 启用
  3. pip install requests

默认本机地址（端口以设置为准）：
  http://127.0.0.1:41596/api/v1/

文档：doc/web-api-v1-guide.md
"""

from __future__ import annotations

import sys
from typing import Any

import requests

# --- 配置 ---
BASE_URL = "http://127.0.0.1:41596/api/v1"
# 若开启「允许远程访问」，填写设置页中的 Token；本机模式可留空
API_TOKEN: str | None = None

DEFAULT_TIMEOUT = 30
IMPORT_TIMEOUT = 120


def _headers() -> dict[str, str]:
    h: dict[str, str] = {"Content-Type": "application/json"}
    if API_TOKEN:
        h["Authorization"] = f"Bearer {API_TOKEN}"
    return h


def api_request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """发起请求并解析 JSend JSON；失败时抛出 RuntimeError。"""
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
        raise RuntimeError(
            f"{body.get('code', 'ERROR')}: {body.get('message', resp.text)}"
        )
    return body


def check_api() -> dict[str, Any]:
    """确认 API 与当前资料库可用。"""
    app = api_request("GET", "app/info")
    lib = api_request("GET", "library/info")
    return {
        "appVersion": app["data"].get("version"),
        "libraryMode": lib["data"].get("libraryMode"),
        "libraryName": lib["data"].get("name"),
    }


def list_folder_tree() -> list[dict[str, Any]]:
    """获取逻辑文件夹树（导入时可选 targetFolderId）。"""
    body = api_request("GET", "folder/tree")
    inner = body.get("data") or {}
    if isinstance(inner, list):
        return inner
    return inner.get("data") or []


def import_local_file(
    file_path: str,
    *,
    target_folder_id: str | None = None,
    duplicate_policy: str = "use_existing",
) -> dict[str, Any]:
    """
    从本机绝对路径导入单个文件。

    duplicate_policy: use_existing | import_copy | ask（API 中 ask 等同 use_existing）
    返回 data：{ skipped, assetId? } 或 { skipped, reason, existingAssetId? }
    """
    payload: dict[str, Any] = {
        "filePath": file_path,
        "duplicatePolicy": duplicate_policy,
    }
    if target_folder_id:
        payload["targetFolderId"] = target_folder_id

    body = api_request(
        "POST",
        "asset/import",
        json_body=payload,
        timeout=IMPORT_TIMEOUT,
    )
    return body["data"]


def import_from_url(
    url: str,
    *,
    filename: str | None = None,
    target_folder_id: str | None = None,
    duplicate_policy: str = "use_existing",
    referer: str | None = None,
) -> dict[str, Any]:
    """
    由 AssetVault 主进程下载 http(s) 资源并入库（适合网页采集、扩展场景）。
    单文件上限约 300MB，详见 doc/web-api-v1-guide.md §3.6。
    """
    payload: dict[str, Any] = {
        "url": url,
        "duplicatePolicy": duplicate_policy,
    }
    if filename:
        payload["filename"] = filename
    if target_folder_id:
        payload["targetFolderId"] = target_folder_id
    if referer:
        payload["headers"] = {"Referer": referer}

    body = api_request(
        "POST",
        "asset/importFromURL",
        json_body=payload,
        timeout=IMPORT_TIMEOUT,
    )
    return body["data"]


def import_batch_local(
    file_paths: list[str],
    *,
    target_folder_id: str | None = None,
    duplicate_policy: str = "use_existing",
) -> dict[str, Any]:
    """批量导入本机文件。"""
    payload: dict[str, Any] = {
        "filePaths": file_paths,
        "duplicatePolicy": duplicate_policy,
    }
    if target_folder_id:
        payload["targetFolderId"] = target_folder_id

    body = api_request(
        "POST",
        "asset/importBatch",
        json_body=payload,
        timeout=IMPORT_TIMEOUT,
    )
    return body["data"]


def assign_tags(asset_ids: list[str], tag_ids: list[str]) -> None:
    """导入后打标签（v1 须单独调用，导入接口不传 tagIds）。"""
    api_request(
        "POST",
        "tag/assign",
        json_body={"assetIds": asset_ids, "tagIds": tag_ids},
    )


def main() -> int:
    try:
        meta = check_api()
        print("API 正常:", meta)
    except requests.ConnectionError:
        print(
            "无法连接 AssetVault API。请确认应用已启动且 Web API 已启用。",
            file=sys.stderr,
        )
        return 1
    except RuntimeError as e:
        print(f"API 错误: {e}", file=sys.stderr)
        return 1

    # --- 示例 1：本机路径导入（请改成你机器上真实存在的文件）---
    local_path = r"G:\images\sample.jpg"
    try:
        result = import_local_file(local_path)
        if result.get("skipped"):
            print(f"本机导入跳过: {result.get('reason')} -> {result.get('existingAssetId')}")
        else:
            print(f"本机导入成功 assetId={result.get('assetId')}")
    except RuntimeError as e:
        if "FILE_NOT_FOUND" in str(e) or "不存在" in str(e):
            print(f"(跳过示例 1：路径不存在 {local_path})")
        else:
            raise

    # --- 示例 2：从 URL 导入 ---
    url_result = import_from_url(
        "https://httpbin.org/image/jpeg",
        filename="httpbin-sample.jpg",
        duplicate_policy="use_existing",
    )
    if url_result.get("skipped"):
        print(f"URL 导入跳过: {url_result}")
    else:
        asset_id = url_result["assetId"]
        print(f"URL 导入成功 assetId={asset_id}")

        # 可选：导入后打标签（将 tag_ids 换成资料库中真实标签 UUID）
        # assign_tags([asset_id], ["标签UUID"])
        # print("已打标签")

    # --- 示例 3：列出文件夹树（便于选取 targetFolderId）---
    tree = list_folder_tree()
    if tree:
        first = tree[0]
        print(f"根级文件夹数: {len(tree)}，首项: {first.get('name')} ({first.get('id')})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
