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
WEBSITE_DATA_DIR = ROOT / "artifacts/website_data/data"
OUTPUT = ROOT / "public/data/flame.db"
JSON_OUTPUT = ROOT / "public/data/flame-data.json"
APPLICATIONS_OUTPUT = ROOT / "public/data/applications-data.json"


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


def import_dynamic_csv(db: sqlite3.Connection, table: str, path: Path, primary_key: str):
    """Import a source CSV whose schema is maintained by the website dataset."""
    csv_rows = list(rows(path))
    if not csv_rows:
        return
    columns = list(csv_rows[0])
    definitions = ",".join(
        f'"{column}" TEXT' + (' PRIMARY KEY' if column == primary_key else '')
        for column in columns
    )
    db.execute(f'CREATE TABLE IF NOT EXISTS "{table}" ({definitions})')
    placeholders = ",".join("?" for _ in columns)
    quoted = ",".join(f'"{column}"' for column in columns)
    sql = f'INSERT OR REPLACE INTO "{table}" ({quoted}) VALUES ({placeholders})'
    db.executemany(sql, ([row.get(column) or None for column in columns] for row in csv_rows))


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE / "flame.db", OUTPUT)
    db = sqlite3.connect(OUTPUT)
    db.row_factory = sqlite3.Row
    insert_csv(db, "investigations", CSV_DIR / "investigations.csv", [r[1] for r in db.execute("PRAGMA table_info(investigations)")])
    insert_csv(db, "tests", CSV_DIR / "tests.csv", [r[1] for r in db.execute("PRAGMA table_info(tests)")])
    insert_csv(db, "documents", CSV_DIR / "documents.csv", [r[1] for r in db.execute("PRAGMA table_info(documents)")])
    import_dynamic_csv(db, "findings", WEBSITE_DATA_DIR / "findings.csv", "finding_id")
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
    applications = [dict(row) for row in db.execute("""
      SELECT f.*, i.acronym, i.title AS investigation_title, '' AS year
      FROM findings f
      LEFT JOIN investigations i ON i.investigation_id = f.investigation_id
      WHERE f.statement IS NOT NULL AND f.statement != ''
      ORDER BY f.investigation_id, f.finding_id
    """)]
    APPLICATIONS_OUTPUT.write_text(json.dumps({"findings": applications}, ensure_ascii=False), encoding="utf-8")
    print(f"SQLite: {OUTPUT} ({len(investigations)} investigations, {len(tests)} tests)")
    print(f"JSON export: {JSON_OUTPUT}")
    print(f"Applications export: {APPLICATIONS_OUTPUT} ({len(applications)} findings)")
    db.close()


if __name__ == "__main__":
    main()
