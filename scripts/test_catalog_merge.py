#!/usr/bin/env python3
"""Smoke test: catalog A -> catalog B merge via Web API."""

from __future__ import annotations

import json
import shutil
import sys
import uuid
from pathlib import Path

import requests

BASE = "http://127.0.0.1:41596/api/v1"
TIMEOUT = 60
IMPORT_TIMEOUT = 600

ROOT = Path(r"G:\temp\av-cc-merge-test")
FIXTURES = ROOT / "fixtures"
ICON = Path(r"G:\work\soft_script\AssetVault_Pro\resources\icon.png")
RESTORE_ROOT = Path(r"G:\temp\gulu2api")
TEST_ROOT = ROOT


def api(method: str, path: str, **kwargs) -> dict:
    url = f"{BASE.rstrip('/')}/{path.lstrip('/')}"
    r = requests.request(method, url, timeout=kwargs.pop("timeout", TIMEOUT), **kwargs)
    if r.status_code >= 400:
        try:
            body = r.json()
            msg = body.get("message") or body
        except Exception:
            msg = r.text
        raise RuntimeError(f"{method} {path} -> HTTP {r.status_code}: {msg}")
    body = r.json()
    if body.get("status") == "error":
        raise RuntimeError(f"{method} {path}: {body.get('code')} {body.get('message')}")
    return body


def switch_library(root: Path) -> dict:
    return api("POST", "library/switch", json={"libraryRoot": str(root)})["data"]


def library_info() -> dict:
    return api("GET", "library/info")["data"]


def import_file(path: Path, notes: str = "", *, duplicate_policy: str = "use_existing") -> dict:
    body = {"filePath": str(path), "duplicatePolicy": duplicate_policy}
    if notes:
        body["notes"] = notes
    return api("POST", "asset/import", json=body, timeout=IMPORT_TIMEOUT)["data"]


def localize_asset(asset_id: str) -> dict:
    return api("POST", "asset/localize", json={"assetIds": [asset_id]}, timeout=IMPORT_TIMEOUT)["data"]


def merge_from(source_root: Path) -> dict:
    return api(
        "POST",
        "library/importFromLibrary",
        json={"sourceLibraryRoot": str(source_root)},
        timeout=IMPORT_TIMEOUT,
    )["data"]


def asset_count() -> int:
    page = api("GET", "asset/get", params={"limit": 1, "offset": 0})["data"]
    return int(page.get("total") or 0)


def init_catalog_dir(root: Path, display_name: str) -> None:
    active = Path(api("GET", "library/state")["data"]["activeLibraryRoot"])
    if active.resolve() == root.resolve() or str(active).lower().startswith(str(root).lower()):
        switch_library(RESTORE_ROOT)
    if root.exists():
        shutil.rmtree(root)
    (root / "items").mkdir(parents=True)
    (root / "thumbnails").mkdir(parents=True)
    manifest = {
        "formatVersion": "1.1",
        "appId": "com.assetvault.library",
        "libraryId": str(uuid.uuid4()),
        "displayName": display_name,
        "libraryMode": "catalog",
        "createdAt": "2026-05-30T00:00:00.000Z",
        "updatedAt": "2026-05-30T00:00:00.000Z",
    }
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def prepare_fixtures() -> tuple[Path, Path, Path]:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    ref_file = FIXTURES / "ref-a.png"
    loc_file = FIXTURES / "loc-b.png"
    dup_file = FIXTURES / "dup-c.png"
    base = ICON.read_bytes()
    ref_file.write_bytes(base)
    loc_file.write_bytes(base + b"\x01")
    dup_file.write_bytes(base + b"\x02")
    return ref_file, loc_file, dup_file


def assert_eq(label: str, got, expected) -> None:
    if got != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {got!r}")


def cleanup_test_artifacts() -> None:
    """Switch away, delete temp libraries, and drop them from recent list."""
    try:
        switch_library(RESTORE_ROOT)
    except Exception:
        pass
    if TEST_ROOT.exists():
        shutil.rmtree(TEST_ROOT, ignore_errors=True)
    state_path = Path.home() / "AppData" / "Roaming" / "assetvault-pro" / "active-library.json"
    if state_path.is_file():
        try:
            state = json.loads(state_path.read_text(encoding="utf-8"))
            prefix = str(TEST_ROOT).lower()
            recent = [
                p
                for p in state.get("recentLibraries", [])
                if isinstance(p, str) and not p.lower().startswith(prefix)
            ]
            active = state.get("activeLibraryRoot", "")
            if isinstance(active, str) and active.lower().startswith(prefix):
                active = str(RESTORE_ROOT)
            state["activeLibraryRoot"] = active
            state["recentLibraries"] = [active] + [p for p in recent if p.lower() != active.lower()]
            state_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
        except Exception:
            pass


def main() -> int:
    if not ICON.is_file():
        print("Missing icon fixture:", ICON, file=sys.stderr)
        return 1

    original = api("GET", "library/state")["data"]["activeLibraryRoot"]
    print("Original library:", original)
    restore_to = RESTORE_ROOT if Path(original).resolve() == ROOT.resolve() or str(original).startswith(str(ROOT)) else Path(original)

    try:
        # Ensure switch endpoint exists (dev build must reload main process)
        try:
            api("POST", "library/switch", json={"libraryRoot": str(restore_to)})
        except RuntimeError as e:
            if "404" in str(e) or "Not Found" in str(e):
                print("POST /library/switch not available — restart dev app and retry.", file=sys.stderr)
                return 2
            raise

        ref_file, loc_file, dup_file = prepare_fixtures()
        switch_library(RESTORE_ROOT)

        # --- Scenario 1: empty B, A has R + L ---
        lib_a = ROOT / "catalog-A"
        lib_b = ROOT / "catalog-B"
        init_catalog_dir(lib_a, "CC Test Source A")
        init_catalog_dir(lib_b, "CC Test Target B")

        switch_library(lib_a)
        assert_eq("A mode", library_info()["libraryMode"], "catalog")
        ref_asset = import_file(ref_file, notes="cc-ref")
        loc_asset = import_file(loc_file, notes="cc-loc")
        localize_asset(loc_asset["assetId"])
        count_a = asset_count()
        print(f"Source A ready: {count_a} assets")

        switch_library(lib_b)
        assert_eq("B mode", library_info()["libraryMode"], "catalog")
        assert_eq("B empty", asset_count(), 0)

        r1 = merge_from(lib_a)
        print("Merge 1:", json.dumps(r1, ensure_ascii=False, indent=2))
        assert_eq("importMode", r1.get("importMode"), "catalog_to_catalog_same_machine")
        assert r1["assetsAdded"] >= 2, r1
        assert (r1.get("assetsAddedReferenced") or 0) >= 1, r1
        assert (r1.get("assetsAddedLocal") or 0) >= 1, r1
        assert_eq("B count after merge", asset_count(), count_a)

        r2 = merge_from(lib_a)
        print("Merge 2 (idempotent):", json.dumps(r2, ensure_ascii=False))
        assert r2["assetsAdded"] == 0, r2
        assert r2["assetsSkippedDuplicate"] >= count_a, r2

        # --- Scenario 2: L2 — B has referenced dup, A has localized same file ---
        lib_a2 = ROOT / "catalog-A2"
        lib_b2 = ROOT / "catalog-B2"
        init_catalog_dir(lib_a2, "CC Test Source A2")
        init_catalog_dir(lib_b2, "CC Test Target B2")

        switch_library(lib_a2)
        a2_loc = import_file(dup_file, notes="l2-source")
        localize_asset(a2_loc["assetId"])

        switch_library(lib_b2)
        b2_ref = import_file(dup_file, notes="l2-target-ref")

        r3 = merge_from(lib_a2)
        print("Merge L2:", json.dumps(r3, ensure_ascii=False))
        assert (r3.get("assetsLocalizedOnImport") or 0) >= 1, r3

        info = api("GET", "asset/info", params={"id": b2_ref["assetId"]})["data"]
        assert info.get("storageMode") == "local", info

        # --- Scenario 3: L3 — both localized, metadata merge only ---
        lib_a3 = ROOT / "catalog-A3"
        lib_b3 = ROOT / "catalog-B3"
        init_catalog_dir(lib_a3, "CC Test Source A3")
        init_catalog_dir(lib_b3, "CC Test Target B3")

        switch_library(lib_a3)
        a3 = import_file(dup_file, notes="l3-a")
        localize_asset(a3["assetId"])

        switch_library(lib_b3)
        b3 = import_file(dup_file, notes="l3-b")
        localize_asset(b3["assetId"])
        packs_before = len(list((lib_b3 / "items").iterdir()))

        r4 = merge_from(lib_a3)
        print("Merge L3:", json.dumps(r4, ensure_ascii=False))
        assert (r4.get("assetsSkippedDuplicateLocal") or 0) >= 1, r4
        packs_after = len(list((lib_b3 / "items").iterdir()))
        assert_eq("L3 no extra pack", packs_after, packs_before)

        print("\nAll catalog merge checks passed.")
        return 0
    finally:
        try:
            switch_library(restore_to)
            print("Restored library:", restore_to)
        except Exception as e:
            print("Failed to restore library:", e, file=sys.stderr)
        cleanup_test_artifacts()
        print("Cleaned up:", TEST_ROOT)


if __name__ == "__main__":
    raise SystemExit(main())
