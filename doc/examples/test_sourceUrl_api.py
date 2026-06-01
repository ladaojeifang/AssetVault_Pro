#!/usr/bin/env python3
"""
AssetVault Pro Web API v1 — sourceUrl 字段最小化集成测试

前置条件：
  - AssetVault Pro 已启动，已打开资料库
  - Web API 已启用（设置 → Advanced → Web API）
  - pip install requests

用法：
  python doc/examples/test_sourceUrl_api.py
"""

from __future__ import annotations

import sys
from typing import Any

import requests

BASE_URL = "http://127.0.0.1:41596/api/v1"
API_TOKEN: str | None = None
TIMEOUT = 15

TEST_URL = "https://example.com/page"
TEST_URL_ALT = "https://www.behance.net/gallery/test"
TEST_URL_INVALID = "javascript:alert(1)"


def _headers() -> dict[str, str]:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if API_TOKEN:
        headers["Authorization"] = f"Bearer {API_TOKEN}"
    return headers


def api_get(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    r = requests.get(f"{BASE_URL}/{path}", params=params, headers=_headers(), timeout=TIMEOUT)
    r.raise_for_status()
    body: dict[str, Any] = r.json()
    if body.get("status") != "success":
        raise RuntimeError(f"API error: {body.get('code')} — {body.get('message')}")
    return body["data"]


def api_post(path: str, json_body: dict[str, Any]) -> dict[str, Any]:
    r = requests.post(f"{BASE_URL}/{path}", json=json_body, headers=_headers(), timeout=TIMEOUT)
    r.raise_for_status()
    body: dict[str, Any] = r.json()
    if body.get("status") != "success":
        raise RuntimeError(f"API error: {body.get('code')} — {body.get('message')}")
    return body["data"]


def api_patch(path: str, json_body: dict[str, Any]) -> dict[str, Any]:
    r = requests.patch(f"{BASE_URL}/{path}", json=json_body, headers=_headers(), timeout=TIMEOUT)
    if not r.ok:
        return {"_http_status": r.status_code, **(r.json() if r.text else {})}
    body: dict[str, Any] = r.json()
    if body.get("status") != "success":
        raise RuntimeError(f"API error: {body.get('code')} — {body.get('message')}")
    return body["data"]


def get_first_asset() -> tuple[str, str]:
    """获取资料库中的第一个资产，返回 (assetId, filename)"""
    data = api_get("asset/get", {"limit": 1})
    items: list[dict[str, Any]] = data.get("data", [])
    if not items:
        print("[SKIP] 资料库为空，无可测试资产")
        sys.exit(0)
    asset = items[0]
    return asset["id"], asset.get("filename", "unknown")


def test_set_and_read(asset_id: str):
    """测试：设置 sourceUrl 后读取验证"""
    print(f"\n[TEST 1] 设置 sourceUrl = {TEST_URL}")
    result = api_patch("asset/update", {"id": asset_id, "sourceUrl": TEST_URL})
    assert result.get("sourceUrl") == TEST_URL, f"设置后读取不匹配: {result.get('sourceUrl')}"
    print("  ✅ 设置成功，读取验证通过")

    # 再通过 GET /asset/info 二次验证
    info = api_get("asset/info", {"id": asset_id})
    assert info.get("sourceUrl") == TEST_URL, f"GET /asset/info 不匹配: {info.get('sourceUrl')}"
    print("  ✅ GET /asset/info 验证通过")


def test_update(asset_id: str):
    """测试：更新为另一个 URL"""
    print(f"\n[TEST 2] 更新 sourceUrl = {TEST_URL_ALT}")
    result = api_patch("asset/update", {"id": asset_id, "sourceUrl": TEST_URL_ALT})
    assert result.get("sourceUrl") == TEST_URL_ALT, f"更新后不匹配: {result.get('sourceUrl')}"
    print("  ✅ 更新成功")


def test_clear(asset_id: str):
    """测试：清空 sourceUrl"""
    print("\n[TEST 3] 清空 sourceUrl")
    result = api_patch("asset/update", {"id": asset_id, "sourceUrl": ""})
    assert result.get("sourceUrl") is None, f"清空后应为 null: {result.get('sourceUrl')}"
    print("  ✅ 清空成功，字段为 null")

    info = api_get("asset/info", {"id": asset_id})
    assert info.get("sourceUrl") is None, f"GET 后应为 null: {info.get('sourceUrl')}"
    print("  ✅ GET /asset/info 验证 null")


def test_invalid_protocol(asset_id: str):
    """测试：非法协议应被拒绝"""
    print(f"\n[TEST 4] 非法协议拒绝: {TEST_URL_INVALID}")
    result = api_patch("asset/update", {"id": asset_id, "sourceUrl": TEST_URL_INVALID})
    status = result.get("_http_status", 200)
    assert status >= 400, f"非法协议应返回错误，实际 {status}"
    print(f"  ✅ 正确拒绝 (HTTP {status}): {result.get('message', result.get('code', ''))}")


def test_search():
    """测试：sourceUrl 参与搜索"""
    print("\n[TEST 5] 搜索验证 sourceUrl 可搜索")
    # 找一个资产设置 sourceUrl, 然后搜索 URL 中的关键词
    data = api_get("asset/get", {"limit": 1})
    items: list[dict[str, Any]] = data.get("data", [])
    if not items:
        print("  [SKIP] 无资产")
        return
    asset_id = items[0]["id"]

    # 设置唯一标记 URL
    unique_url = "https://av-test-source-url.example.com"
    api_patch("asset/update", {"id": asset_id, "sourceUrl": unique_url})

    # 搜索域名关键词
    result = api_get("asset/get", {"search": "av-test-source-url", "limit": 100})
    found = [a for a in result.get("data", []) if a["id"] == asset_id]
    assert len(found) > 0, "按 sourceUrl 关键词搜索未命中"
    print(f"  ✅ 搜索命中: {found[0].get('sourceUrl')}")

    # 清理
    api_patch("asset/update", {"id": asset_id, "sourceUrl": ""})


def test_notes_unchanged(asset_id: str):
    """测试：设置 sourceUrl 不影响 notes"""
    print("\n[TEST 6] sourceUrl 不影响 notes 字段")
    # 先设置 notes
    api_patch("asset/update", {"id": asset_id, "notes": "test-note-sourceurl"})
    api_patch("asset/update", {"id": asset_id, "sourceUrl": TEST_URL})

    info = api_get("asset/info", {"id": asset_id})
    assert info.get("notes") == "test-note-sourceurl", f"notes 不应被覆盖: {info.get('notes')}"
    assert info.get("sourceUrl") == TEST_URL, "sourceUrl 未正确设置"
    print("  ✅ notes 与 sourceUrl 互不干扰")

    # 清理
    api_patch("asset/update", {"id": asset_id, "notes": ""})
    api_patch("asset/update", {"id": asset_id, "sourceUrl": ""})


def main():
    print("=" * 50)
    print("AssetVault Pro — sourceUrl API 测试")
    print(f"Base URL: {BASE_URL}")
    print("=" * 50)

    # 健康检查
    try:
        info = api_get("app/info")
        print(f"应用: {info.get('name')} v{info.get('version')}")
    except Exception as e:
        print(f"[FAIL] 无法连接 API: {e}")
        print("请确保 AssetVault Pro 已启动并启用 Web API")
        sys.exit(1)

    asset_id, filename = get_first_asset()
    print(f"测试资产: {filename} ({asset_id[:8]}…)")

    passed = 0
    failed = 0
    tests = [
        ("设置并读取", test_set_and_read),
        ("更新为另一个URL", test_update),
        ("清空 sourceUrl", test_clear),
        ("非法协议拒绝", test_invalid_protocol),
        ("搜索验证", test_search),
        ("notes 互不干扰", test_notes_unchanged),
    ]

    for name, fn in tests:
        try:
            fn(asset_id)
            passed += 1
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
            failed += 1

    print(f"\n{'=' * 50}")
    print(f"结果: {passed} passed, {failed} failed, {len(tests)} total")
    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
