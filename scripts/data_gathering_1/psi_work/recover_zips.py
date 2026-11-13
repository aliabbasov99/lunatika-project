#!/usr/bin/env python3
"""PSI-39: ZIP arxivlərinin içindəki çatışmayan .txt fayllarını çıxarır."""
import json
import os
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, ".")
sys.path.insert(0, "psi_work")
import psi_download as p
from httpzip import open_zip

INV = "PSI-39"
OUT = Path("YUKLENENLER")

# DB rows
class A:
    pass

args = A()
args.db_name = "lunatika"
args.db_host = "127.0.0.1"
args.db_port = "5432"
args.db_user = "postgres"
args.db_password = "123"
args.exts = p.DEFAULT_EXTS
files = p.load_files(args)
rows = {f["path"]: f for f in files if f["path"].startswith(INV + "/")}

missing = [
    l.rstrip("\n").split("\t")[0]
    for l in open("psi_verify_missing.tsv", encoding="utf-8")
    if l.strip() and l.startswith(INV + "/")
]

# ZIP nodes
tree = json.load(open("psi_work/PSI-39_tree_full.json"))
zips = {}


def walk(n):
    if isinstance(n, list):
        for x in n:
            walk(x)
    elif isinstance(n, dict):
        if n.get("directory") is False and (n.get("key") or "").lower().endswith(".zip"):
            name = n["key"].rsplit("/", 1)[-1]
            zips[re.sub(r"\s+", " ", name).strip().lower()] = n
        for x in n.get("files") or []:
            walk(x)


walk(tree)

_zip_cache = {}


def get_zip(node):
    key = node["id"]
    if key not in _zip_cache:
        url = p.get_presigned_url(INV, node["id"], 120)
        _zip_cache[key] = open_zip(url)
    return _zip_cache[key]


def zip_by_name(basename):
    return zips.get(re.sub(r"\s+", " ", basename).strip().lower())


def extract(target_rel, zip_node, member):
    dest, _ = p.dest_for(OUT, target_rel)
    if dest.exists() and dest.stat().st_size > 0:
        print("SKIP exists", target_rel)
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    z = get_zip(zip_node)
    info = z.getinfo(member)
    tmp = dest.with_name(dest.name + ".part_zip")
    try:
        with z.open(info) as src, open(tmp, "wb") as out:
            while True:
                chunk = src.read(256 * 1024)
                if not chunk:
                    break
                out.write(chunk)
        os.replace(tmp, dest)
    finally:
        if tmp.exists():
            tmp.unlink()
    expected = p.parse_size(rows.get(target_rel, {}).get("size", ""))
    actual = dest.stat().st_size
    ok = expected is None or actual == expected
    print(f"OK {target_rel} | {actual} bytes | expected {expected} | {'MATCH' if ok else 'MISMATCH'}")
    return ok


# 1) Frame text files: same basename .zip
recovered = 0
for rel in missing:
    base = rel.rsplit("/", 1)[-1]
    if not base.lower().endswith(".txt"):
        continue
    stem = base[:-4]
    # Try the zip with the same base name: PSI-39_Raw Data_F173E01A.txt -> ...F173E01A.zip
    node = zip_by_name(stem + ".zip")
    candidates = []
    if node:
        candidates.append((node, base))
    # Settings/summary: scan sibling zips for the exact member name
    m = re.match(r"(PSI-39_Raw Data_)(F\d+[A-Z]\d+|[A-Z]\d+[A-Z]\d+)", base)
    code = None
    mm = re.search(r"(F\d{3}[A-Z]\d{2}|F\d{3}[A-Z]\d{2})(?=[A-Z_\.])", base)
    if mm:
        code = mm.group(1)
    if not candidates and code:
        for zname, znode in zips.items():
            if code.lower() in zname:
                candidates.append((znode, base))
    member_variants = [base]
    short = base.replace("PSI-39_Raw Data_", "")
    if short != base:
        member_variants.append(short)
    found = False
    for znode, member in candidates:
        try:
            z = get_zip(znode)
            names = {n.rsplit("/", 1)[-1]: n for n in z.namelist()}
            real = None
            for mv in member_variants:
                if mv in names:
                    real = names[mv]
                    break
            if real is None:
                for nm, full in names.items():
                    if any(nm.endswith(mv) for mv in member_variants):
                        real = full
                        break
            if not real:
                continue
            extract(rel, znode, real)
            recovered += 1
            found = True
            break
        except Exception as e:
            print("ERR", rel, znode["key"], type(e).__name__, e)
    if not found:
        print("NOT FOUND", rel)

print(f"\nRecovered targets attempted: {recovered}")
