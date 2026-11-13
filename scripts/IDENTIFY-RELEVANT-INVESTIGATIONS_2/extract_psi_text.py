#!/usr/bin/env python3
"""Extract text from PSI-TEXT-FILES_1_1 into a persistent mirrored cache."""
import os, re, subprocess, sys, zipfile
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from xml.etree import ElementTree as ET

SRC = Path("/home/aliabbasov/Projects/lunatika-project-new/scripts/PSI-TEXT-FILES_1_1")
OUT = Path("/home/aliabbasov/Projects/lunatika-project-new/scripts/IDENTIFY-RELEVANT-INVESTIGATIONS_2/.cache/psi_text")
OUT.mkdir(parents=True, exist_ok=True)

TEXT_EXTS = {".txt", ".rtf", ".csv", ".tsv"}
ZIP_EXTS = {".docx", ".pptx", ".xlsx"}


def out_path(p: Path) -> Path:
    rel = p.relative_to(SRC)
    return OUT / rel.with_suffix(rel.suffix + ".txt")


def clean(s: str) -> str:
    s = s.replace("\x00", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def extract_pdf(p: Path) -> str:
    r = subprocess.run(["pdftotext", "-layout", str(p), "-"], capture_output=True, text=True, timeout=180)
    return clean(r.stdout)


def extract_zip_office(p: Path) -> str:
    chunks = []
    try:
        with zipfile.ZipFile(p) as z:
            names = z.namelist()
            if p.suffix.lower() == ".docx":
                targets = [n for n in names if n == "word/document.xml"]
            elif p.suffix.lower() == ".pptx":
                targets = sorted(n for n in names if re.match(r"ppt/slides/slide\d+\.xml$", n))
            else:
                targets = [n for n in names if n == "xl/sharedStrings.xml"]
            for n in targets:
                try:
                    root = ET.fromstring(z.read(n))
                except Exception:
                    continue
                for t in root.iter():
                    if t.tag.endswith("}t") and t.text:
                        chunks.append(t.text)
                chunks.append("\n")
    except Exception as e:
        return f"[extract error: {e}]"
    return clean("\n".join(chunks))


def extract_textfile(p: Path) -> str:
    for enc in ("utf-8", "latin-1"):
        try:
            return clean(p.read_text(encoding=enc, errors="replace")[:2_000_000])
        except Exception:
            continue
    return ""


def work(p: Path):
    op = out_path(p)
    if op.exists() and op.stat().st_size > 0:
        return str(p), "cached"
    try:
        ext = p.suffix.lower()
        if ext == ".pdf":
            txt = extract_pdf(p)
        elif ext in ZIP_EXTS:
            txt = extract_zip_office(p)
        elif ext in TEXT_EXTS:
            txt = extract_textfile(p)
        else:
            return str(p), "skip"
        op.parent.mkdir(parents=True, exist_ok=True)
        op.write_text(txt, encoding="utf-8")
        return str(p), f"ok {len(txt)}"
    except Exception as e:
        return str(p), f"error {e}"


def main():
    files = [p for p in SRC.rglob("*") if p.is_file() and p.suffix.lower() in ({".pdf"} | ZIP_EXTS | TEXT_EXTS)]
    print(f"files: {len(files)}", flush=True)
    done = 0
    errors = []
    with ProcessPoolExecutor(max_workers=8) as ex:
        futs = [ex.submit(work, p) for p in files]
        for f in as_completed(futs):
            path, status = f.result()
            done += 1
            if status.startswith("error"):
                errors.append((path, status))
            if done % 1000 == 0:
                print(f"{done}/{len(files)}", flush=True)
    print(f"DONE {done}, errors={len(errors)}", flush=True)
    for p, s in errors[:30]:
        print("ERR", p, s)


if __name__ == "__main__":
    main()
