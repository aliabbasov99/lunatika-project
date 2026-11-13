#!/usr/bin/env python3
"""
Auto-link PSI investigations <-> materials from the extracted text cache.

  python3 link_materials.py                 # scan + write data/auto_links.json + sql/05_auto_links.sql
  python3 link_materials.py --apply         # also run the SQL via psql
  python3 link_materials.py --min-mentions 8 --min-files 2

Curated links (seed_materials.py) are never overwritten: SQL uses ON CONFLICT DO NOTHING.
Auto links get confidence='low'/'medium' and must be reviewed.
"""
from __future__ import annotations
import argparse, collections, json, math, os, re, subprocess
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TXT = ROOT / ".cache" / "psi_text"
MATERIALS = json.loads((ROOT / "data" / "materials.json").read_text(encoding="utf-8"))
MIN_ALIAS_LEN = 4                       # drops "PI", "H2" style noise; add exceptions below
SHORT_OK = {"ptfe", "pmma", "dbp", "ch4", "c2h4", "c2h6", "c3h8", "sibal"}
DOC_DIRS = ("reports", "science documents")   # high-trust evidence
# Contextual materials (products, atmosphere gases, suppressants) appear as common
# words in every report ("smoke", "soot", "oxygen"); auto-linking them would flood
# the table with noise. They are already curated in seed_materials.py.
SKIP_CATEGORIES = {"combustion_product", "atmosphere", "suppressant",
                   "oxidizer", "oxidizer_additive", "aerosol_standard"}

# alias (lowercase) -> [material ids]
ALIAS = collections.defaultdict(list)
for m in MATERIALS:
    if m["category"] in SKIP_CATEGORIES:
        continue
    for a in {m["canonical_name"], *m["aliases"]}:
        a = re.sub(r"\(.*?\)", "", a).strip().lower()
        if len(a) >= MIN_ALIAS_LEN or a in SHORT_OK:
            if m["id"] not in ALIAS[a]:
                ALIAS[a].append(m["id"])

RX = re.compile(r"(?<![a-z0-9])(" + "|".join(
    re.escape(a).replace(r"\ ", r"[\s\-]+") for a in sorted(ALIAS, key=len, reverse=True)
) + r")(?![a-z0-9])")
SENT = re.compile(r"(?<=[.!?])\s+")


def inv_of(rel: Path) -> str | None:
    return rel.parts[0] if rel.parts and rel.parts[0].startswith("PSI-") else None


def is_doc(rel: Path) -> bool:
    return any(p.lower() in DOC_DIRS for p in rel.parts[1:-1])


def key(a: str) -> str:
    return re.sub(r"[\s\-]+", " ", a)


def scan(path: str):
    p = Path(path)
    rel = p.relative_to(TXT)
    inv = inv_of(rel)
    if not inv:
        return None
    try:
        raw = p.read_bytes().decode("utf-8", "replace")
    except OSError:
        return None
    low = raw.lower()
    hits = collections.Counter()
    quotes = {}
    for m in RX.finditer(low):
        a = key(m.group(1))
        for mid in ALIAS.get(a) or ALIAS.get(m.group(1), []):
            hits[mid] += 1
            if mid not in quotes and is_doc(rel):
                s = max(raw.rfind(".", 0, m.start()), raw.rfind("\n\n", 0, m.start())) + 1
                e = raw.find(".", m.end())
                q = re.sub(r"\s+", " ", raw[s: (e + 1 if e != -1 else m.end() + 200)]).strip()
                if 30 <= len(q) <= 350:
                    quotes[mid] = q
    if not hits:
        return None
    ev = str(rel.with_suffix(""))                 # path without .txt, same as curated links
    return inv, ev, is_doc(rel), dict(hits), quotes


ROLE_HINTS = [
    (r"replac(ed|e|ing)\b", "replaced_material"),
    (r"(planned|desired|was not|were not|not tested|not flown)", "planned_not_tested"),
    (r"(suppress|extinguish)", "suppressant"),
    (r"(diluent|inert|dilut)", "diluent"),
]


def guess_role(mat: dict, quote: str | None) -> str:
    if quote:
        for rx, role in ROLE_HINTS:
            if re.search(rx, quote.lower()):
                return role
    return "fuel" if mat.get("is_fuel") and mat.get("phase") in ("gas", "liquid") else "test_material"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-mentions", type=int, default=5)
    ap.add_argument("--min-files", type=int, default=2)
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()

    files = [os.path.join(r, f) for r, _, fs in os.walk(TXT) for f in fs if f.endswith(".txt")]
    mentions = collections.defaultdict(collections.Counter)             # inv -> mat -> n
    nfiles = collections.defaultdict(collections.Counter)
    docfiles = collections.defaultdict(lambda: collections.defaultdict(list))
    allfiles = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
    quotes = collections.defaultdict(dict)

    with ProcessPoolExecutor(os.cpu_count()) as ex:
        for res in ex.map(scan, files, chunksize=32):
            if not res:
                continue
            inv, ev, doc, hits, qs = res
            for mid, n in hits.items():
                mentions[inv][mid] += n * (3 if doc else 1)
                nfiles[inv][mid] += 1
                allfiles[inv][mid][ev] += n
                if doc:
                    docfiles[inv][mid].append(ev)
            for mid, q in qs.items():
                quotes[inv].setdefault(mid, q)

    idx = {m["id"]: m for m in MATERIALS}
    out = []
    for inv in sorted(mentions):
        ranked = mentions[inv].most_common()
        top = ranked[0][1] if ranked else 1
        for mid, score in ranked:
            if score < a.min_mentions or nfiles[inv][mid] < a.min_files and not docfiles[inv][mid]:
                continue
            if not docfiles[inv][mid]:
                # Raw-data-only evidence (e.g. fuel-property calculator sheets) is
                # too weak; real use must be backed by a report/science document.
                continue
            q = quotes[inv].get(mid)
            ev = docfiles[inv][mid][:3] or [p for p, _ in allfiles[inv][mid].most_common(3)]
            eq = min(95, 40 + int(25 * math.log10(score + 1)) + (15 if q else 0))
            out.append({
                "investigation_id": inv, "material_id": mid,
                "role": guess_role(idx[mid], q),
                "confidence": "medium" if q and score >= 3 * a.min_mentions else "low",
                "is_primary": score >= 0.5 * top and score >= 10 * a.min_mentions,
                "evidence_quality": eq, "data_completeness": 50,
                "evidence_files": ev, "evidence_quote": q,
                "notes": f"AUTO: {score} weighted mentions in {nfiles[inv][mid]} files - review",
            })

    (ROOT / "data" / "auto_links.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")

    def sq(v):
        return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"
    sql = ["BEGIN;"]
    for r in out:
        sql.append(
            "INSERT INTO investigation_materials (investigation_id, material_id, role, confidence, is_primary,"
            " evidence_quality, data_completeness, evidence_files, evidence_quote, notes) VALUES ("
            f"{sq(r['investigation_id'])},{sq(r['material_id'])},{sq(r['role'])},{sq(r['confidence'])},"
            f"{str(r['is_primary']).lower()},{r['evidence_quality']},{r['data_completeness']},"
            f"{sq(json.dumps(r['evidence_files']))}::jsonb,{sq(r['evidence_quote'])},{sq(r['notes'])}"
            ") ON CONFLICT (investigation_id, material_id) DO NOTHING;")
    sql.append("COMMIT;")
    sqlp = ROOT / "sql" / "05_auto_links.sql"
    sqlp.write_text("\n".join(sql), encoding="utf-8")
    print(f"{len(out)} candidate links -> data/auto_links.json, sql/05_auto_links.sql")

    if a.apply:
        env = {**os.environ, "PGPASSWORD": os.environ.get("PGPASSWORD", "123")}
        subprocess.run(["psql", "-U", "postgres", "-h", "127.0.0.1", "-d", "lunatika", "-f", str(sqlp)],
                       check=True, env=env)


if __name__ == "__main__":
    main()