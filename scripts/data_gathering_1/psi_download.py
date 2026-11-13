#!/usr/bin/env python3
"""
psi_download.py - NASA PSI fayllarını PostgreSQL `investigation_files.path`
strukturunu BİR-BİR saxlayaraq paralel yükləyir.

Çıxış:
    YUKLENENLER/PSI-XXX/<DB-dəki tam path>

Nümunə:
    PGPASSWORD=123 python3 psi_download.py \
        --db-name lunatika --db-host 127.0.0.1 --db-user postgres \
        --workers 32

Yalnız bu formatlar yüklənir (default):
    pdf, txt, rtf, xls, xlsx, doc, docx, ppt, pptx
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter

API_URL = "https://psi.nasa.gov/geode-py/ws/studies/{inv}/download"
DEFAULT_EXTS = ["pdf", "txt", "rtf", "xls", "xlsx", "doc", "docx", "ppt", "pptx"]

_tls = threading.local()


class PermanentError(Exception):
    """404/400 kimi təkrar cəhdin faydasız olduğu xətalar."""


def get_session():
    s = getattr(_tls, "session", None)
    if s is None:
        s = requests.Session()
        s.headers.update({
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) psi-download/2.0"
        })
        adapter = HTTPAdapter(pool_connections=2, pool_maxsize=2, max_retries=0)
        s.mount("https://", adapter)
        s.mount("http://", adapter)
        _tls.session = s
    return s


def run_psql(sql, args):
    cmd = ["psql", "-X", "-A", "-t", "-d", args.db_name]
    if args.db_host:
        cmd += ["-h", args.db_host]
    if args.db_port:
        cmd += ["-p", str(args.db_port)]
    if args.db_user:
        cmd += ["-U", args.db_user]
    env = os.environ.copy()
    pw = args.db_password if args.db_password is not None else os.environ.get("PGPASSWORD")
    if pw is not None:
        env["PGPASSWORD"] = pw
    r = subprocess.run(cmd, input=sql, text=True, capture_output=True, env=env)
    if r.returncode != 0:
        raise RuntimeError(
            f"psql xətası ({r.returncode})\nSTDOUT:\n{r.stdout}\nSTDERR:\n{r.stderr}"
        )
    return r.stdout.strip()


def load_investigations(args):
    out = run_psql("SELECT json_agg(id ORDER BY id) FROM investigations;", args)
    return json.loads(out) if out else []


def load_files(args):
    pattern = r"\.(" + "|".join(args.exts) + r")$"
    sql = f"""
SELECT json_agg(t ORDER BY t.path) FROM (
    SELECT investigation_id, path, size
    FROM investigation_files
    WHERE type = 'file'
      AND lower(path) ~ '{pattern}'
) t;
"""
    out = run_psql(sql, args)
    return json.loads(out) if out else []


def parse_size(s):
    if not s:
        return None
    m = re.match(r"^([\d.]+)\s*(B|KB|MB|GB|TB)?$", s.strip(), re.I)
    if not m:
        return None
    v = float(m.group(1))
    unit = (m.group(2) or "B").upper()
    return int(v * {"B": 1, "KB": 1024, "MB": 1024**2, "GB": 1024**3, "TB": 1024**4}[unit])


def human_bytes(b):
    b = float(b or 0)
    for unit, mult in [("TB", 1024**4), ("GB", 1024**3), ("MB", 1024**2), ("KB", 1024), ("B", 1)]:
        if b >= mult:
            return f"{b / mult:,.2f} {unit}"
    return "0 B"


def sanitize_component(part, is_file):
    """255 baytdan uzun fayl sistemi komponentini hash ilə qısaldır."""
    raw = part.encode("utf-8")
    if len(raw) <= 255:
        return part, False

    digest = hashlib.sha1(raw).hexdigest()[:10]
    if is_file:
        p = Path(part)
        ext = p.suffix
        if len(ext.encode("utf-8")) > 24:
            ext = ""
        budget = 255 - len(digest) - 2 - len(ext.encode("utf-8"))
        trunc = p.stem.encode("utf-8")[: max(1, budget)].decode("utf-8", "ignore")
        return f"{trunc}__{digest}{ext}", True

    budget = 255 - len(digest) - 2
    trunc = part.encode("utf-8")[: max(1, budget)].decode("utf-8", "ignore")
    return f"{trunc}__{digest}", True


def dest_for(root, db_path):
    parts = db_path.split("/")
    new_parts = []
    changed = False
    for i, part in enumerate(parts):
        if part == "":
            # DB-də bəzən "//" olur; POSIX-də bu tək "/" ilə eynidir.
            changed = True
            continue
        if part in (".", ".."):
            raise ValueError(f"təhlükəli path komponenti: {db_path!r}")
        new_part, was_changed = sanitize_component(part, is_file=(i == len(parts) - 1))
        new_parts.append(new_part)
        changed = changed or was_changed
    if not new_parts:
        raise ValueError(f"boş path: {db_path!r}")
    actual_rel = "/".join(new_parts)
    return root / Path(*new_parts), (actual_rel if changed else None)


def normalize_name(name):
    return re.sub(r"\s+", " ", name).strip()


def load_api_names(investigations):
    """Repo metadata-dakı dəqiq file_name-ləri yığır.

    DB-də bəzi adlarda çoxsaylı boşluqlar təkə çevrilib; download API isə
    dəqiq ad tələb edir. Bu map normalizə olunmuş ad -> dəqiq ad verir.
    """
    def fetch(inv):
        try:
            r = requests.get(
                f"https://psi.nasa.gov/geode-py/ws/repo/investigations/{inv}",
                timeout=60,
            )
            r.raise_for_status()
            d = r.json()
        except Exception:
            return inv, {}
        m = {}
        # Əvvəl removed, sonra added: hazırkı versiya üstünlük təşkil edir.
        for key in ("removed", "added"):
            for rec in d.get(key) or []:
                fn = (rec.get("file_name") or "").strip()
                if fn:
                    m[normalize_name(fn)] = fn
        return inv, m

    result = {}
    with ThreadPoolExecutor(max_workers=6) as ex:
        for inv, m in ex.map(fetch, investigations):
            result[inv] = m
    return result


def append_tsv(path, row):
    with open(path, "a", encoding="utf-8") as f:
        f.write("\t".join(str(x).replace("\t", " ") for x in row) + "\n")


_tree_names = {}
_tree_locks = {}
_tree_guard = threading.Lock()


def load_tree_nodes(inv):
    """Repo ağacındakı fayllar: normalizə olunmuş ad -> {name, id, version}.

    Metadata `added`/`removed` yalnız son versiyanın deltasını verir; tam ağac
    isə bütün aktiv faylları verir. Bəzi faylların DB adı ilə ağacdakı adı
    fərqlənir (məs. `Legacy/` qovluğu və ya ikiqat boşluq). Ad ilə imzalama
    alınmayanda fayl ID-si ilə imzalamaq üçün `id` də saxlanılır.
    """
    tree = None
    for attempt in range(1, 4):
        try:
            r = requests.get(
                f"https://psi.nasa.gov/geode-py/ws/repo/investigations/{inv}",
                timeout=90,
            )
            r.raise_for_status()
            version = r.json().get("version")
            r2 = requests.post(
                "https://psi.nasa.gov/geode-py/ws/files/v2",
                json={
                    "folder": f"{inv}/",
                    "fileType": "study",
                    "studyId": inv,
                    "version": version,
                    "obfuscationcode": "",
                },
                timeout=240,
            )
            r2.raise_for_status()
            tree = r2.json()
            break
        except Exception:
            if attempt < 3:
                time.sleep(2 ** attempt)
    if tree is None:
        return {}

    m = {}

    def walk(node):
        if isinstance(node, list):
            for x in node:
                walk(x)
        elif isinstance(node, dict):
            if node.get("directory") is False and node.get("key"):
                name = node["key"].rsplit("/", 1)[-1]
                m[normalize_name(name)] = {
                    "name": name,
                    "id": node.get("id"),
                    "version": node.get("version"),
                }
            for x in node.get("files") or []:
                walk(x)

    walk(tree)
    return m


def tree_node_for(inv, basename):
    """Ağacdan DB basename-inə uyğun node-u tapır (cache ilə)."""
    norm = normalize_name(basename)
    with _tree_guard:
        if inv in _tree_names:
            return _tree_names[inv].get(norm)
        inv_lock = _tree_locks.setdefault(inv, threading.Lock())
    with inv_lock:
        with _tree_guard:
            if inv in _tree_names:
                return _tree_names[inv].get(norm)
        m = load_tree_nodes(inv)
        if m:
            with _tree_guard:
                _tree_names[inv] = m
        else:
            return None
        return m.get(norm)


def get_presigned_url(inv, basename, timeout):
    url = API_URL.format(inv=inv)
    try:
        r = get_session().get(
            url,
            params={"file": basename, "version": "1", "redirect": "false"},
            timeout=(20, timeout),
        )
    except requests.RequestException as e:
        raise RuntimeError(f"API bağlantı xətası: {e}") from e

    if r.status_code in (400, 404):
        raise PermanentError(f"API HTTP {r.status_code}: {r.text[:300]}")
    if r.status_code != 200:
        raise RuntimeError(f"API HTTP {r.status_code}: {r.text[:300]}")

    text = r.text.strip()
    if text.startswith('"') and text.endswith('"'):
        try:
            text = json.loads(text)
        except Exception:
            pass
    if not text.startswith("http"):
        raise RuntimeError(f"API gözlənilməz cavab: {text[:300]}")
    return text


def download_one(row, args, counters, lock, errors_path, long_paths_path):
    inv = row["investigation_id"]
    db_path = row["path"]
    expected = parse_size(row.get("size", ""))
    try:
        dest, actual_rel = dest_for(Path(args.out), db_path)
    except Exception as e:
        with lock:
            counters["failed"] += 1
            append_tsv(errors_path, (time.strftime("%Y-%m-%d %H:%M:%S"), db_path, f"path xətası: {e}"))
        return

    if actual_rel and actual_rel != db_path:
        with lock:
            counters["sanitized"] += 1
            append_tsv(long_paths_path, (db_path, actual_rel))

    try:
        if dest.exists() and not args.force:
            size = dest.stat().st_size
            # Mənbədə 0 bayt olan fayllar (expected None/0) da hazır sayılır.
            if size > 0 or expected in (None, 0):
                with lock:
                    counters["skipped"] += 1
                    counters["bytes"] += size
                return

        dest.parent.mkdir(parents=True, exist_ok=True)
        basename = db_path.rsplit("/", 1)[-1]
        api_name = args.api_names.get(inv, {}).get(normalize_name(basename), basename)
        if api_name != basename:
            with lock:
                counters["renamed"] += 1
                append_tsv(args.api_names_file, (db_path, api_name))
        tmp = dest.parent / (".part_" + hashlib.sha1(dest.name.encode("utf-8")).hexdigest()[:16])
        last_err = None

        for attempt in range(1, args.retries + 1):
            try:
                try:
                    signed = get_presigned_url(inv, api_name, args.timeout)
                except PermanentError:
                    # Metadata deltasında olmayan adları tam repo ağacından tap.
                    node = tree_node_for(inv, basename)
                    signed = None
                    if node:
                        alt = node.get("name")
                        if alt and alt != api_name:
                            api_name = alt
                            with lock:
                                counters["renamed"] += 1
                                append_tsv(args.api_names_file, (db_path, api_name))
                            try:
                                signed = get_presigned_url(inv, api_name, args.timeout)
                            except PermanentError:
                                signed = None
                        if signed is None and node.get("id"):
                            # Ad ilə API tapa bilmir; fayl ID-si ilə imzala.
                            api_name = node["id"]
                            with lock:
                                counters["renamed"] += 1
                                append_tsv(args.api_names_file, (db_path, f"id:{api_name}"))
                            signed = get_presigned_url(inv, api_name, args.timeout)
                    if signed is None:
                        raise
                with get_session().get(
                    signed, stream=True, timeout=(30, args.timeout)
                ) as r:
                    if r.status_code == 404:
                        raise PermanentError(f"S3 404 (köhnə obyekt silinib): {signed[:200]}")
                    r.raise_for_status()
                    content_length = int(r.headers.get("Content-Length") or 0)
                    n = 0
                    with open(tmp, "wb") as f:
                        for chunk in r.iter_content(chunk_size=256 * 1024):
                            if chunk:
                                f.write(chunk)
                                n += len(chunk)

                if n == 0 and content_length != 0 and expected != 0:
                    raise RuntimeError("boş fayl gəldi")
                if content_length and n != content_length:
                    raise RuntimeError(f"ölçü uyğunsuzluğu: {n} / {content_length}")

                os.replace(tmp, dest)
                with lock:
                    counters["ok"] += 1
                    counters["bytes"] += n
                return
            except PermanentError as e:
                last_err = e
                break
            except Exception as e:
                last_err = e
                try:
                    tmp.unlink()
                except OSError:
                    pass
                if attempt < args.retries:
                    time.sleep(min(20, 2 ** attempt))

        with lock:
            counters["failed"] += 1
            reason = str(last_err)
            if api_name != basename:
                reason += f" [api_name={api_name}]"
            append_tsv(errors_path, (time.strftime("%Y-%m-%d %H:%M:%S"), db_path, reason))
    except Exception as e:
        with lock:
            counters["failed"] += 1
            append_tsv(errors_path, (time.strftime("%Y-%m-%d %H:%M:%S"), db_path, f"hazırlıq/yazma: {e}"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db-name", default="lunatika")
    ap.add_argument("--db-host", default="127.0.0.1")
    ap.add_argument("--db-port", default="5432")
    ap.add_argument("--db-user", default="postgres")
    ap.add_argument("--db-password", default=None)
    ap.add_argument("--out", default="YUKLENENLER")
    ap.add_argument("--exts", default=",".join(DEFAULT_EXTS),
                    help="Vergüllə ayrılmış uzantılar")
    ap.add_argument("--workers", type=int, default=32)
    ap.add_argument("--retries", type=int, default=3)
    ap.add_argument("--timeout", type=int, default=180, help="S3 oxuma timeout-u (saniyə)")
    ap.add_argument("--force", action="store_true", help="Mövcud faylları yenidən yüklə")
    ap.add_argument("--limit", type=int, default=0, help="Test üçün ilk N fayl")
    ap.add_argument("--investigations", default="", help="Məs: PSI-20,PSI-69")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--progress-every", type=int, default=50)
    ap.add_argument("--errors-file", default="psi_download_errors.tsv")
    ap.add_argument("--long-paths-file", default="psi_download_longpaths.tsv")
    ap.add_argument("--api-names-file", default="psi_download_api_names.tsv")
    ap.add_argument("--no-api-names", action="store_true",
                    help="Metadata-dakı dəqiq fayl adı düzəlişini söndür")
    args = ap.parse_args()
    args.exts = [e.strip().lower().lstrip(".") for e in args.exts.split(",") if e.strip()]

    investigations = load_investigations(args)
    files = load_files(args)
    args.api_names = {} if args.no_api_names else load_api_names(investigations)
    if args.investigations:
        wanted = {x.strip() for x in args.investigations.split(",") if x.strip()}
        files = [f for f in files if f["investigation_id"] in wanted]
    if args.limit:
        files = files[: args.limit]

    root = Path(args.out)
    root.mkdir(parents=True, exist_ok=True)
    for inv in investigations:
        (root / inv).mkdir(parents=True, exist_ok=True)

    total_expected = sum(parse_size(f.get("size", "")) or 0 for f in files)
    print(f"DB: {args.db_name} @ {args.db_host}:{args.db_port}", file=sys.stderr)
    print(f"Formatlar: {', '.join(args.exts)}", file=sys.stderr)
    print(f"Fayl sayı: {len(files):,}", file=sys.stderr)
    print(f"Gözlənilən həcm: {human_bytes(total_expected)}", file=sys.stderr)
    print(f"Paralel worker: {args.workers}", file=sys.stderr)
    print(f"Çıxış: {root.resolve()}", file=sys.stderr)
    print(f"Xəta faylı: {args.errors_file}", file=sys.stderr)

    if args.dry_run:
        for f in files[:20]:
            print(f["path"])
        if len(files) > 20:
            print(f"... və daha {len(files) - 20:,} fayl")
        return

    lock = threading.Lock()
    counters = {"ok": 0, "skipped": 0, "failed": 0, "bytes": 0, "sanitized": 0, "renamed": 0}
    start = time.time()
    done = 0

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = [
            ex.submit(
                download_one, row, args, counters, lock,
                args.errors_file, args.long_paths_file
            )
            for row in files
        ]
        try:
            for fut in as_completed(futures):
                fut.result()
                done += 1
                if done % args.progress_every == 0 or done == len(files):
                    elapsed = max(0.001, time.time() - start)
                    with lock:
                        c = dict(counters)
                    print(
                        f"[{done:,}/{len(files):,}] "
                        f"ok={c['ok']:,} skip={c['skipped']:,} fail={c['failed']:,} "
                        f"həcm={human_bytes(c['bytes'])} "
                        f"sürət={done / elapsed:,.1f} fayl/s",
                        file=sys.stderr,
                        flush=True,
                    )
        except KeyboardInterrupt:
            print("\nDayandırılır...", file=sys.stderr)
            for fut in futures:
                fut.cancel()

    elapsed = time.time() - start
    with lock:
        c = dict(counters)
    print("\n=== YEKUN ===", file=sys.stderr)
    print(f"Yükləndi:      {c['ok']:,}", file=sys.stderr)
    print(f"Artıq mövcud:  {c['skipped']:,}", file=sys.stderr)
    print(f"Xəta:          {c['failed']:,}", file=sys.stderr)
    print(f"Ümumi həcm:    {human_bytes(c['bytes'])}", file=sys.stderr)
    print(f"Vaxt:          {elapsed / 60:.1f} dəqiqə", file=sys.stderr)
    print(f"Uzun adlar:    {c['sanitized']:,} (mapping: {args.long_paths_file})", file=sys.stderr)
    print(f"Ad düzəlişi:   {c['renamed']:,} (mapping: {args.api_names_file})", file=sys.stderr)
    if c["failed"]:
        print(f"Xəta detalları: {args.errors_file}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
