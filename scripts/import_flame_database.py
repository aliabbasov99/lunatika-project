#!/usr/bin/env python3
"""Build a reproducible SQLite database and browser data export from source CSVs."""

from __future__ import annotations

import csv
import json
import shutil
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "artifacts/lunatika_code_extracted"
CSV_DIR = SOURCE / "csv"
OUTPUT = ROOT / "public/data/flame.db"
JSON_OUTPUT = ROOT / "public/data/flame-data.json"


def rows(path: Path):
    with path.open(encoding="utf-8-sig", newline="") as file:
        yield from csv.DictReader(file)


def convert(value: str | None):
    if value is None or value == "":
        return None
    try:
        return float(value) if "." in value else int(value)
    except ValueError:
        return value


def insert_csv(db: sqlite3.Connection, table: str, path: Path, columns: list[str]):
    placeholders = ",".join("?" for _ in columns)
    quoted = ",".join(f'"{column}"' for column in columns)
    sql = f'INSERT OR REPLACE INTO "{table}" ({quoted}) VALUES ({placeholders})'
    db.executemany(sql, ([convert(row.get(column)) for column in columns] for row in rows(path)))


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE / "flame.db", OUTPUT)
    db = sqlite3.connect(OUTPUT)
    db.row_factory = sqlite3.Row
    insert_csv(db, "investigations", CSV_DIR / "investigations.csv", [r[1] for r in db.execute("PRAGMA table_info(investigations)")])
    insert_csv(db, "tests", CSV_DIR / "tests.csv", [r[1] for r in db.execute("PRAGMA table_info(tests)")])
    insert_csv(db, "documents", CSV_DIR / "documents.csv", [r[1] for r in db.execute("PRAGMA table_info(documents)")])
    db.commit()

    investigations = [dict(row) for row in db.execute("""
      SELECT i.*,
             (SELECT COUNT(*) FROM tests t WHERE t.investigation_id=i.investigation_id) AS test_count,
             (SELECT COUNT(*) FROM documents d WHERE d.investigation_id=i.investigation_id) AS document_count
      FROM investigations i ORDER BY i.investigation_id
    """)]
    tests = [dict(row) for row in db.execute("SELECT * FROM tests ORDER BY investigation_id, source_line")]
    documents = [dict(row) for row in db.execute("SELECT * FROM documents ORDER BY investigation_id, year, document_id")]
    JSON_OUTPUT.write_text(json.dumps({"investigations": investigations, "tests": tests, "documents": documents}, ensure_ascii=False), encoding="utf-8")
    print(f"SQLite: {OUTPUT} ({len(investigations)} investigations, {len(tests)} tests)")
    print(f"JSON export: {JSON_OUTPUT}")
    db.close()


if __name__ == "__main__":
    main()
