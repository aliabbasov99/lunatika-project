#!/usr/bin/env python3
import re, os, collections
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor

TXT = Path("/home/aliabbasov/Projects/lunatika-project-new/scripts/IDENTIFY-RELEVANT-INVESTIGATIONS_2/.cache/psi_text")

terms = {
 "teflon": r"\bteflon\b|\bptfe\b|polytetrafluoro",
 "kapton": r"\bkapton\b|polyimide",
 "silicone": r"\bsilicone\b|\bsilicon\b",
 "pyrell": r"\bpyrell\b|\bpyrel\b",
 "lampwick": r"\blamp\s*wick|\blampwick\b",
 "cotton": r"\bcotton\b",
 "sibal": r"\bsibal\b",
 "nomex": r"\bnomex\b",
 "ultem": r"\bultem\b",
 "pmma": r"\bpmma\b|polymethyl\s*methacrylate|methyl\s*methacrylate|acrylic",
 "lexan": r"\blexan\b|polycarbonate",
 "dbp": r"\bdbp\b|dibutyl\s*phthalate",
 "heptane": r"\bheptane\b|\bn-heptane\b",
 "dodecane": r"\bdodecane\b",
 "isododecane": r"\biso-?dodecane\b",
 "farnesane": r"\bfarnesane\b",
 "decane": r"\bdecane\b",
 "octane": r"\boctane\b",
 "toluene": r"\btoluene\b",
 "propylbenzene": r"\bpropylbenzene\b",
 "propanol": r"\bpropanol\b",
 "glycerol": r"\bglycerol\b",
 "ethanol": r"\bethanol\b",
 "methanol": r"\bmethanol\b|\bmeoh\b",
 "methane": r"\bmethane\b|\bch4\b",
 "ethylene": r"\bethylene\b|\bc2h4\b",
 "ethane": r"\bethane\b|\bc2h6\b",
 "propane": r"\bpropane\b|\bc3h8\b",
 "butane": r"\b(n-)?butane\b|\bc4h10\b",
 "pentane": r"\b(n-)?pentane\b|\bc5h12\b",
 "propylene": r"\bpropylene\b|\bc3h6\b",
 "hydrogen": r"\bhydrogen\b|\bh2\b",
 "fiberglass": r"\bfiberglass\b|\bfibre\s*glass\b",
 "kevlar": r"\bkevlar\b",
 "mylar": r"\bmylar\b|polyester\s*film",
 "polyurethane": r"\bpolyurethane\b",
 "polyethylene": r"\bpolyethylene\b",
 "polypropylene": r"\bpolypropylene\b",
 "nylon": r"\bnylon\b",
 "wool": r"\bwool\b",
 "paper": r"\bpaper\b",
 "wood": r"\bwood\b",
 "epoxy": r"\bepoxy\b",
}

# Pattern-lər artıq kiçik hərflidir -> re.I lazım deyil, mətni lower() edirik
BIG = re.compile("|".join(f"(?P<{k}>{v})" for k, v in terms.items()))


def scan(path_str):
    """Bir faylı skan edir: (investigation, counts, seen) qaytarır."""
    p = Path(path_str)
    rel = p.relative_to(TXT)
    inv = rel.parts[0] if rel.parts and rel.parts[0].startswith("PSI-") else "OTHER"
    try:
        t = p.read_bytes().decode("utf-8", errors="replace").lower()
    except Exception:
        return inv, {}, ()
    cnt = collections.Counter(m.lastgroup for m in BIG.finditer(t))
    return inv, cnt, tuple(cnt)


def main():
    files = [os.path.join(r, f) for r, _, fs in os.walk(TXT) for f in fs if f.endswith(".txt")]

    counts = collections.defaultdict(collections.Counter)
    files_with = collections.defaultdict(collections.Counter)

    with ProcessPoolExecutor(max_workers=os.cpu_count()) as ex:
        for inv, cnt, seen in ex.map(scan, files, chunksize=32):
            counts[inv].update(cnt)
            for k in seen:
                files_with[inv][k] += 1

    print("INVESTIGATION MATERIAL MENTIONS (occurrences / files)")
    for inv in sorted(counts, key=lambda x: (not x.startswith("PSI-"), x)):
        items = counts[inv].most_common()
        print(f"\n{inv}: " + ", ".join(f"{k}={v}({files_with[inv][k]}f)" for k, v in items))


if __name__ == "__main__":
    main()