#!/usr/bin/env python3
"""List assets referencing remote-imports/ in file_path or import_source.

Usage:
  python scripts/check_remote_imports_refs.py "G:\\temp\\gulu2api"
  python scripts/check_remote_imports_refs.py "G:\\temp\\gulu2api" --summary
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import sys

NORM = "lower(replace({col}, char(92), '/'))"


def norm(col: str) -> str:
    return NORM.format(col=col)


def disk_stats(remote_dir: str) -> tuple[int, int]:
    files = 0
    size = 0
    if not os.path.isdir(remote_dir):
        return files, size
    for dirpath, _dirnames, filenames in os.walk(remote_dir):
        for name in filenames:
            path = os.path.join(dirpath, name)
            try:
                size += os.path.getsize(path)
                files += 1
            except OSError:
                pass
    return files, size


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("library_root", nargs="?", default=r"G:\temp\gulu2api")
    parser.add_argument("--summary", action="store_true", help="Only print counts, no asset list")
    args = parser.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    root = args.library_root
    db_path = os.path.join(root, "library.sqlite")
    if not os.path.isfile(db_path):
        print(f"library.sqlite not found: {db_path}", file=sys.stderr)
        return 1

    remote_dir = os.path.join(root, "remote-imports")
    disk_files, disk_bytes = disk_stats(remote_dir)

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT count(*) AS c FROM assets")
    total = cur.fetchone()["c"]

    where_any = f"""
      {norm('file_path')} LIKE '%remote-imports/%'
      OR ({norm('import_source')} LIKE '%remote-imports/%')
    """

    cur.execute(
        f"""
        SELECT
          sum(CASE WHEN {norm('file_path')} LIKE '%remote-imports/%' THEN 1 ELSE 0 END) AS file_path_refs,
          sum(CASE WHEN import_source IS NOT NULL AND {norm('import_source')} LIKE '%remote-imports/%' THEN 1 ELSE 0 END) AS import_source_refs,
          sum(CASE WHEN {where_any} THEN 1 ELSE 0 END) AS any_ref
        FROM assets
        """
    )
    summary = cur.fetchone()

    cur.execute("SELECT storage_mode, count(*) AS c FROM assets GROUP BY storage_mode")
    modes = cur.fetchall()

    print(f"Library root: {root}\n")
    print("remote-imports on disk:")
    print(f"  files: {disk_files}")
    print(f"  size:  {disk_bytes / 1024 / 1024:.2f} MB\n")
    print("DB summary:")
    print(f"  total assets:              {total}")
    print(f"  file_path -> remote:       {summary['file_path_refs']}  (still using staging as primary file)")
    print(f"  import_source -> remote:   {summary['import_source_refs']}  (provenance only)")
    print(f"  any reference:             {summary['any_ref']}")
    print("  storage_mode:")
    for m in modes:
        print(f"    {m['storage_mode']}: {m['c']}")
    print()

    cur.execute(
        f"""
        SELECT id, filename, storage_mode, file_path, import_source,
          CASE
            WHEN {norm('file_path')} LIKE '%remote-imports/%' THEN 'file_path'
            WHEN {norm('import_source')} LIKE '%remote-imports/%' THEN 'import_source'
            ELSE 'other'
          END AS ref_field
        FROM assets
        WHERE {where_any}
        ORDER BY filename
        """
    )
    rows = cur.fetchall()
    conn.close()

    if not rows:
        print("No assets reference remote-imports in file_path or import_source.")
        print("Disk cache under remote-imports/ may still exist; safe to prune if items/ has archive copies.")
        return 0

    if summary["file_path_refs"] == 0 and summary["import_source_refs"] > 0:
        print(
            "Note: file_path is under items/ for all assets; import_source only records download origin.\n"
            "      Deleting remote-imports/ should NOT break previews if storage_mode=local and items/ exists.\n"
        )

    if args.summary:
        print(f"Listed assets omitted (--summary). Matching rows: {len(rows)}")
        return 0

    print(f"Assets still referencing remote-imports ({len(rows)}):\n")
    for r in rows:
        print(f"- {r['filename']}")
        print(f"  id: {r['id']}")
        print(f"  storage_mode: {r['storage_mode']}")
        print(f"  ref_field: {r['ref_field']}")
        print(f"  file_path: {r['file_path']}")
        if r["import_source"]:
            print(f"  import_source: {r['import_source']}")
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
