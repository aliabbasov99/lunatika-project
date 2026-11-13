#!/usr/bin/env python3
"""
psi_verify.py - YUKLENENLER ağacını DB-dəki investigation_files.path ilə tutuşdurur.

İstifadə:
    PGPASSWORD=123 python3 psi_verify.py \
        --db-name lunatika --db-host 127.0.0.1 --db-user postgres
"""
import argparse
from pathlib import Path

import psi_download as p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db-name", default="lunatika")
    ap.add_argument("--db-host", default="127.0.0.1")
    ap.add_argument("--db-port", default="5432")
    ap.add_argument("--db-user", default="postgres")
    ap.add_argument("--db-password", default=None)
    ap.add_argument("--out", default="YUKLENENLER")
    ap.add_argument("--exts", default=",".join(p.DEFAULT_EXTS))
    ap.add_argument("--missing-file", default="psi_verify_missing.tsv")
    ap.add_argument("--size-file", default="psi_verify_size_mismatch.tsv")
    ap.add_argument("--sanitized-file", default="psi_verify_sanitized.tsv")
    args = ap.parse_args()
    args.exts = [e.strip().lower().lstrip(".") for e in args.exts.split(",") if e.strip()]

    files = p.load_files(args)
    missing = []
    size_bad = []
    sanitized = []
    ok = 0
    empty = 0
    total_bytes = 0

    for f in files:
        db_path = f["path"]
        try:
            dest, actual_rel = p.dest_for(Path(args.out), db_path)
        except Exception as e:
            missing.append((db_path, f"path xətası: {e}"))
            continue
        if actual_rel:
            sanitized.append((db_path, actual_rel))
        if not dest.exists():
            missing.append((db_path, "mövcud deyil"))
            continue
        actual = dest.stat().st_size
        expected = p.parse_size(f.get("size", ""))
        if actual == 0 and expected not in (None, 0):
            missing.append((db_path, "0 bayt (gözlənilən > 0)"))
            continue
        total_bytes += actual
        if actual == 0:
            empty += 1
        if expected and abs(actual - expected) > max(1024, expected * 0.01):
            size_bad.append((db_path, expected, actual))
        ok += 1

    with open(args.missing_file, "w", encoding="utf-8") as fh:
        for path, reason in missing:
            fh.write(f"{path}\t{reason}\n")
    with open(args.size_file, "w", encoding="utf-8") as fh:
        for path, exp, act in size_bad:
            fh.write(f"{path}\t{exp}\t{act}\n")
    with open(args.sanitized_file, "w", encoding="utf-8") as fh:
        for path, actual in sanitized:
            fh.write(f"{path}\t{actual}\n")

    print(f"DB fayl sayı:      {len(files):,}")
    print(f"Tam/mövcud:        {ok:,}")
    print(f"Boş (mənbədə 0):   {empty:,}")
    print(f"Çatışmayan:        {len(missing):,}  -> {args.missing_file}")
    print(f"Ölçü uyğunsuzluğu: {len(size_bad):,}  -> {args.size_file}")
    print(f"Yol düzəlişi:      {len(sanitized):,}  -> {args.sanitized_file}")
    print(f"Diskdəki həcm:     {p.human_bytes(total_bytes)}")


if __name__ == "__main__":
    main()
