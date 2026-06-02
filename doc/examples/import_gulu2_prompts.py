#!/usr/bin/env python3
"""
从 gulu2api 分页拉取 prompts，将 cover_url 导入 AssetVault Pro，并设置名称、标签与备注。

数据源：
  https://gulu2api.com/api/v1/prompts?page=1&limit=2&sort=reviewed_at&order=desc
   https://gulu2api.com/api/v1/prompts?page=139&limit=20&sort=reviewed_at&order=desc

每条资产：
  - 名称：{id}_{title}_{cover_url}
  - 标签：media_type、model（不存在则自动创建）
  - 备注：prompt_text / prompt_text_zh / prompt_text_en / source_url / detail_url（含 key）

前置：
  - AssetVault Pro 已启动、已打开资料库、Web API 已启用
  - pip install requests

用法：
  python doc/examples/import_gulu2_prompts.py --page 1 --limit 10
  python doc/examples/import_gulu2_prompts.py --page 1 --end-page 3 --limit 50
  python doc/examples/import_gulu2_prompts.py --dry-run --page 1 --limit 2
"""

from __future__ import annotations

import argparse
import math
import sys
import tempfile
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests

# --- gulu2api ---
GULU2_BASE = "https://gulu2api.com/api/v1/prompts"
GULU2_SORT = "reviewed_at"
GULU2_ORDER = "desc"

# --- AssetVault Web API v1 ---
AV_BASE = "http://127.0.0.1:41596/api/v1"
AV_TOKEN: str | None = None

DEFAULT_LIMIT = 20
REQUEST_TIMEOUT = 30
IMPORT_TIMEOUT = 120
SLEEP_BETWEEN_ITEMS = 0.3


def av_headers() -> dict[str, str]:
    h: dict[str, str] = {"Content-Type": "application/json"}
    if AV_TOKEN:
        h["Authorization"] = f"Bearer {AV_TOKEN}"
    return h


def format_av_http_error(resp: requests.Response) -> str:
    """解析 AssetVault 返回体，避免只看到裸 500。"""
    try:
        body = resp.json()
        if body.get("status") == "error":
            code = body.get("code", "ERROR")
            message = body.get("message", resp.text)
            details = body.get("details")
            if details:
                return f"{code}: {message} ({details})"
            return f"{code}: {message}"
    except ValueError:
        pass
    text = (resp.text or "").strip()
    return f"HTTP {resp.status_code}" + (f": {text[:500]}" if text else "")


def av_request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
    timeout: int = REQUEST_TIMEOUT,
) -> dict[str, Any]:
    url = f"{AV_BASE.rstrip('/')}/{path.lstrip('/')}"
    resp = requests.request(
        method,
        url,
        headers=av_headers(),
        params=params,
        json=json_body,
        timeout=timeout,
    )
    if not resp.ok:
        raise RuntimeError(format_av_http_error(resp))
    body = resp.json()
    if body.get("status") == "error":
        raise RuntimeError(f"{body.get('code')}: {body.get('message')}")
    return body


def fetch_gulu2_page(page: int, limit: int) -> dict[str, Any]:
    resp = requests.get(
        GULU2_BASE,
        params={
            "page": page,
            "limit": limit,
            "sort": GULU2_SORT,
            "order": GULU2_ORDER,
        },
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    body = resp.json()
    if body.get("code") != 0:
        raise RuntimeError(f"gulu2api 错误: {body.get('msg', body)}")
    return body["data"]


def total_pages(total: int, limit: int) -> int:
    if total <= 0:
        return 0
    return math.ceil(total / limit)


def build_asset_display_name(item: dict[str, Any]) -> str:
    """id + title + cover_url（下划线连接，供 rename 使用）。"""
    item_id = item.get("id", "")
    title = str(item.get("title") or "").strip()
    cover_url = str(item.get("cover_url") or "").strip()
    return f"{item_id}_{title}_{cover_url}"


def build_notes(item: dict[str, Any]) -> str:
    """备注包含指定字段的 key 与 value。"""
    keys = (
        "prompt_text",
        "prompt_text_zh",
        "prompt_text_en",
        "source_url",
        "detail_url",
    )
    lines: list[str] = []
    for key in keys:
        value = item.get(key)
        if value is None:
            value = ""
        lines.append(f"{key}: {value}")
    return "\n\n".join(lines)


def filename_hint_from_cover(cover_url: str, item: dict[str, Any]) -> str:
    """短文件名，避免 slug 过长或特殊字符影响落盘。"""
    path = urlparse(cover_url).path
    ext = ".jpg"
    if "." in path:
        ext = path[path.rfind(".") :].lower()
        if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}:
            ext = ".jpg"
    return f"gulu2-{item.get('id', 'cover')}{ext}"


def download_headers_for_item(item: dict[str, Any]) -> dict[str, str]:
    """opennana CDN 建议带 Referer / User-Agent。"""
    detail_url = str(item.get("detail_url") or "").strip()
    referer = detail_url or "https://opennana.com/"
    return {
        "Referer": referer,
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    }


class TagCache:
    def __init__(self) -> None:
        self._by_name: dict[str, str] = {}
        self._loaded = False

    def _load(self) -> None:
        if self._loaded:
            return
        body = av_request("GET", "tag/get")
        inner = body.get("data") or {}
        tags = inner if isinstance(inner, list) else inner.get("data") or []
        for tag in tags:
            name = tag.get("name")
            tid = tag.get("id")
            if name and tid:
                self._by_name[str(name)] = str(tid)
        self._loaded = True

    def ensure(self, name: str) -> str:
        name = name.strip()
        if not name:
            raise ValueError("标签名不能为空")
        self._load()
        if name in self._by_name:
            return self._by_name[name]
        created = av_request("POST", "tag/create", json_body={"name": name})
        tid = str(created["data"]["id"])
        self._by_name[name] = tid
        return tid


def download_cover_to_temp(item: dict[str, Any]) -> Path:
    """Python 侧下载 cover（绕过 AssetVault 主进程 fetch failed）。"""
    cover_url = str(item.get("cover_url") or "").strip()
    filename = filename_hint_from_cover(cover_url, item)
    headers = download_headers_for_item(item)
    resp = requests.get(cover_url, headers=headers, timeout=IMPORT_TIMEOUT, stream=True)
    resp.raise_for_status()
    tmp_dir = Path(tempfile.gettempdir()) / "assetvault-gulu2-import"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    out = tmp_dir / filename
    with out.open("wb") as f:
        for chunk in resp.iter_content(chunk_size=65536):
            if chunk:
                f.write(chunk)
    return out


def import_local_file(
    file_path: Path | str,
    *,
    target_folder_id: str | None,
) -> tuple[str, bool]:
    payload: dict[str, Any] = {
        "filePath": str(file_path),
        "duplicatePolicy": "use_existing",
    }
    if target_folder_id:
        payload["targetFolderId"] = target_folder_id
    body = av_request("POST", "asset/import", json_body=payload, timeout=IMPORT_TIMEOUT)
    data = body["data"]
    asset_id = data.get("assetId") or data.get("existingAssetId")
    if not asset_id:
        raise RuntimeError(f"本机导入未返回 assetId: {data}")
    return str(asset_id), bool(data.get("skipped"))


def import_cover_url(item: dict[str, Any], *, target_folder_id: str | None) -> tuple[str, bool]:
    """
    返回 (asset_id, skipped)。
    优先 importFromURL；若主进程 fetch failed，则 Python 下载后走 asset/import。
    """
    cover_url = str(item.get("cover_url") or "").strip()
    if not cover_url:
        raise ValueError(f"条目 id={item.get('id')} 缺少 cover_url")

    payload: dict[str, Any] = {
        "url": cover_url,
        "filename": filename_hint_from_cover(cover_url, item),
        "duplicatePolicy": "use_existing",
        "headers": download_headers_for_item(item),
    }
    if target_folder_id:
        payload["targetFolderId"] = target_folder_id

    url_import_error: RuntimeError | None = None
    for attempt in range(2):
        try:
            body = av_request(
                "POST",
                "asset/importFromURL",
                json_body=payload,
                timeout=IMPORT_TIMEOUT,
            )
            data = body["data"]
            asset_id = data.get("assetId") or data.get("existingAssetId")
            if not asset_id:
                raise RuntimeError(f"导入未返回 assetId: {data}")
            return str(asset_id), bool(data.get("skipped"))
        except RuntimeError as exc:
            url_import_error = exc
            err_text = str(exc)
            if attempt == 0 and "INTERNAL_ERROR" in err_text and "fetch failed" not in err_text:
                time.sleep(1.0)
                continue
            break

    # fallback: Python 下载 + 本机路径导入（解决 Electron fetch failed）
    if url_import_error:
        err_text = str(url_import_error)
        if "fetch failed" in err_text or "网络下载失败" in err_text or "INTERNAL_ERROR" in err_text:
            local_path = download_cover_to_temp(item)
            print(f"  importFromURL 失败，改用本机路径导入: {local_path.name}")
            return import_local_file(local_path, target_folder_id=target_folder_id)
        raise url_import_error

    raise RuntimeError("导入失败")


def rename_asset(asset_id: str, new_name: str) -> None:
    av_request(
        "POST",
        "asset/rename",
        json_body={"id": asset_id, "newName": new_name},
    )


def update_notes(asset_id: str, notes: str) -> None:
    av_request(
        "PATCH",
        "asset/update",
        json_body={"id": asset_id, "notes": notes},
    )


def assign_tags(asset_id: str, tag_ids: list[str]) -> None:
    if not tag_ids:
        return
    av_request(
        "POST",
        "tag/assign",
        json_body={"assetIds": [asset_id], "tagIds": tag_ids},
    )


def process_item(
    item: dict[str, Any],
    tag_cache: TagCache,
    *,
    target_folder_id: str | None,
    dry_run: bool,
) -> None:
    item_id = item.get("id")
    title = item.get("title", "")
    cover_url = item.get("cover_url", "")
    display_name = build_asset_display_name(item)
    notes = build_notes(item)

    media_type = str(item.get("media_type") or "").strip()
    model = str(item.get("model") or "").strip()
    tag_names = [n for n in (media_type, model) if n]

    if dry_run:
        print(
            f"[dry-run] id={item_id} title={title!r}\n"
            f"  cover_url={cover_url}\n"
            f"  name={display_name[:120]}{'...' if len(display_name) > 120 else ''}\n"
            f"  tags={tag_names}\n"
            f"  notes_len={len(notes)}"
        )
        return

    asset_id, skipped = import_cover_url(item, target_folder_id=target_folder_id)
    tag_ids = [tag_cache.ensure(n) for n in tag_names]
    assign_tags(asset_id, tag_ids)
    update_notes(asset_id, notes)

    try:
        rename_asset(asset_id, display_name)
    except RuntimeError as exc:
        # 名称过长或含非法字符时，回退为 id_title
        fallback = f"{item_id}_{title}"
        print(f"  重命名失败，改用短名: {exc}", file=sys.stderr)
        rename_asset(asset_id, fallback)

    status = "跳过(已存在)" if skipped else "新导入"
    print(f"  [{status}] id={item_id} -> assetId={asset_id} tags={tag_names}")


def run(
    *,
    start_page: int,
    end_page: int | None,
    limit: int,
    target_folder_id: str | None,
    dry_run: bool,
) -> int:
    tag_cache = TagCache()
    page = 1
    end_page = 5
    imported_count = 0
    error_count = 0

    while True:
        print(f"\n=== gulu2api 第 {page} 页 (limit={limit}) ===")
        try:
            data = fetch_gulu2_page(page, limit)
        except requests.RequestException as exc:
            print(f"拉取第 {page} 页失败: {exc}", file=sys.stderr)
            return 1

        items = data.get("list") or []
        total = int(data.get("total") or 0)
        max_page = total_pages(total, limit)
        print(f"本页 {len(items)} 条，总计 total={total}，约 {max_page} 页")

        if end_page is not None and page > end_page:
            break

        for item in items:
            try:
                process_item(
                    item,
                    tag_cache,
                    target_folder_id=target_folder_id,
                    dry_run=dry_run,
                )
                imported_count += 1
            except (requests.RequestException, RuntimeError, ValueError) as exc:
                error_count += 1
                print(f"  失败 id={item.get('id')}: {exc}", file=sys.stderr)

            if not dry_run:
                time.sleep(SLEEP_BETWEEN_ITEMS)

        if end_page is not None and page >= end_page:
            break
        if page >= max_page or not items:
            break
        page += 1

    print(f"\n完成：处理 {imported_count} 条，失败 {error_count} 条")
    return 1 if error_count else 0


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="从 gulu2api 导入 prompts 封面到 AssetVault")
    p.add_argument("--page", type=int, default=1, help="起始页，默认 1")
    p.add_argument(
        "--end-page",
        type=int,
        default=None,
        help="结束页（含）；不指定则根据 total/limit 拉取到最后一页",
    )
    p.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="每页条数")
    p.add_argument("--folder-id", type=str, default=None, help="可选：导入到指定逻辑文件夹 UUID")
    p.add_argument("--dry-run", action="store_true", help="只打印，不调用 AssetVault")
    p.add_argument(
        "--av-base",
        type=str,
        default=AV_BASE,
        help=f"AssetVault API 根地址，默认 {AV_BASE}",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    global AV_BASE
    AV_BASE = args.av_base.rstrip("/")

    if args.page < 1:
        print("--page 须 >= 1", file=sys.stderr)
        return 1
    if args.limit < 1:
        print("--limit 须 >= 1", file=sys.stderr)
        return 1
    if args.end_page is not None and args.end_page < args.page:
        print("--end-page 不能小于 --page", file=sys.stderr)
        return 1

    if not args.dry_run:
        try:
            info = av_request("GET", "app/info")
            print("AssetVault:", info.get("data", {}))
        except requests.ConnectionError:
            print("无法连接 AssetVault API，请确认应用已启动且 Web API 已启用。", file=sys.stderr)
            return 1

    return run(
        start_page=args.page,
        end_page=args.end_page,
        limit=args.limit,
        target_folder_id=args.folder_id,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    sys.exit(main())
