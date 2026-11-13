#!/usr/bin/env python3
import argparse
import csv
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

WANTED = [
    "Objectives",
    "Project",
    "Approach",
    "Hypothesis",
    "Research Impacts/Earth Benefits",
    "Contact(s)",
]
STOPS = [
    "Data Files and Documents",
    "Publications",
    "Related Investigations",
    "Citation",
    "Keywords",
    "Funding",
    "References",
]


def norm(s):
    return re.sub(r"\s+", " ", s).strip().lower()


WANTED_N = {norm(w): w for w in WANTED}
ALL_HEADS = set(WANTED_N) | {norm(s) for s in STOPS}

JS_ROWS = r"""
() => [...document.querySelectorAll('a.panel-block')].map((a, i) => {
  const m = [...a.classList].map(c => c.match(/^depth-(\d+)$/)).find(Boolean);
  if (!m) return null;
  const nameEl = a.querySelector('.inline-flex');
  const ic = (a.querySelector('i') || {}).className || '';
  let size = null;
  for (const s of a.querySelectorAll('small')) {
    const t = s.textContent.trim().replace(/\s+/g, ' ');
    if (/\b(B|KB|MB|GB|TB)\b/.test(t)) { size = t; break; }
  }
  return {idx: i, depth: parseInt(m[1]),
          name: nameEl ? nameEl.textContent.trim().replace(/\s+/g, ' ') : '',
          isDir: ic.includes('fa-folder'), isOpen: ic.includes('fa-folder-open'),
          size: size};
}).filter(Boolean)
"""

JS_TITLES = r"""
() => [...document.querySelectorAll('h1, h2')]
  .map(e => e.innerText.trim().replace(/\s+/g, ' ')).filter(Boolean)
"""


# ---------- bölmələr ----------
def split_sections(text):
    best, cur, buf = {}, None, []

    def flush():
        if cur and cur in WANTED_N:
            body = "\n".join(l for l in buf if l).strip()
            if len(body) > len(best.get(WANTED_N[cur], "")):
                best[WANTED_N[cur]] = body

    for l in (x.strip() for x in text.splitlines()):
        n = norm(l)
        if n in ALL_HEADS:
            flush()
            cur, buf = n, []
        elif cur:
            buf.append(l)
    flush()
    return best


def get_title(page):
    try:
        cands = page.evaluate(JS_TITLES)
    except Exception:
        cands = []
    for c in cands:
        if not re.fullmatch(r"PSI-\d+", c, re.I) and norm(c) not in ALL_HEADS:
            return c
    return page.title().strip()


# ---------- fayl ağacı ----------
def with_paths(rows):
    stack, out = [], []
    for r in rows:
        stack = stack[: r["depth"]]
        stack.append(r["name"])
        out.append({**r, "path": "/".join(stack)})
    return out


def get_rows(page):
    return with_paths(page.evaluate(JS_ROWS))


def try_expand(page, row, delay):
    before = len(get_rows(page))
    row_loc = page.locator("a.panel-block").nth(row["idx"])
    strategies = [
        ("ad", lambda: row_loc.locator(".inline-flex").first.click(timeout=3000)),
        ("ikon", lambda: row_loc.locator("i").first.click(timeout=3000)),
        ("sətir", lambda: row_loc.click(timeout=3000)),
        ("dblclick", lambda: row_loc.locator(".inline-flex").first.dblclick(timeout=3000)),
    ]
    for label, fn in strategies:
        try:
            fn()
        except Exception as e:
            print(f"    {label}: klik alınmadı ({type(e).__name__})", file=sys.stderr)
            continue
        for _ in range(16):
            time.sleep(0.5)
            if len(get_rows(page)) != before:
                time.sleep(delay)
                return label
    return None


def expand_all(page, delay, max_clicks):
    done, clicks = set(), 0
    while clicks < max_clicks:
        target = next(
            (
                r
                for r in get_rows(page)
                if r["isDir"] and not r["isOpen"] and r["path"] not in done
            ),
            None,
        )
        if not target:
            break
        done.add(target["path"])
        clicks += 1
        print(f"[{clicks}] {target['path']}", file=sys.stderr)
        how = try_expand(page, target, delay)
        print(
            f"    {'açıldı (' + how + ')' if how else 'AÇILMADI (boş qovluq ola bilər, ya da klik işləmir)'}",
            file=sys.stderr,
        )
    return get_rows(page)


def scrape_investigation(page, url, delay, max_clicks, dump=False):
    net = []

    def on_response(resp):
        try:
            if resp.request.resource_type in ("xhr", "fetch"):
                entry = {
                    "url": resp.url,
                    "method": resp.request.method,
                    "status": resp.status,
                }
                try:
                    entry["body"] = resp.json()
                except Exception:
                    entry["body"] = (resp.text() or "")[:2000]
                net.append(entry)
        except Exception:
            pass

    page.on("response", on_response)
    try:
        page.goto(url, wait_until="networkidle", timeout=60000)
        page.wait_for_selector("a.panel-block", timeout=60000)
        time.sleep(2)

        for label in WANTED:
            try:
                loc = page.get_by_text(label, exact=True)
                if loc.count():
                    loc.first.click(timeout=1000)
            except Exception:
                pass
        time.sleep(0.5)

        title = get_title(page)
        raw = page.evaluate("document.body.innerText")
        sections = split_sections(raw)
        if dump:
            open("raw_page.txt", "w", encoding="utf-8").write(raw)

        print(f"Başlıq: {title}", file=sys.stderr)
        for w in WANTED:
            print(
                f"  {w}: {'OK (' + str(len(sections.get(w, ''))) + ' simvol)' if sections.get(w) else 'TAPILMADI'}",
                file=sys.stderr,
            )
        print(f"İlkin sətir sayı: {len(get_rows(page))}", file=sys.stderr)

        rows = expand_all(page, delay, max_clicks)
        seen, items = set(), []
        for r in rows:
            if r["path"] not in seen:
                seen.add(r["path"])
                items.append(r)

        m = re.search(r"PSI-\d+", url, re.I)
        out = {
            "id": m.group(0).upper() if m else "",
            "url": url,
            "title": title,
            **{w: sections.get(w, "") for w in WANTED},
            "files": [
                {
                    "path": i["path"],
                    "type": "folder" if i["isDir"] else "file",
                    "size": i["size"] or "",
                    "depth": i["depth"],
                }
                for i in items
            ],
        }
        return out, net, items
    finally:
        try:
            page.remove_listener("response", on_response)
        except Exception:
            pass


def write_outputs(out, items, net, json_path, csv_path, net_path):
    if json_path:
        Path(json_path).parent.mkdir(parents=True, exist_ok=True)
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
    if csv_path:
        Path(csv_path).parent.mkdir(parents=True, exist_ok=True)
        with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["path", "type", "size"])
            for i in items:
                w.writerow([i["path"], "folder" if i["isDir"] else "file", i["size"] or ""])
    if net_path:
        Path(net_path).parent.mkdir(parents=True, exist_ok=True)
        with open(net_path, "w", encoding="utf-8") as f:
            json.dump(net, f, ensure_ascii=False, indent=2)


def load_research_urls(path_str):
    p = Path(path_str)
    with open(p, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        # preserve numeric-like key order when possible
        def k(x):
            try:
                return (0, int(x))
            except Exception:
                return (1, str(x))
        return [data[k_] for k_ in sorted(data.keys(), key=k)]
    if isinstance(data, list):
        urls = []
        for item in data:
            if isinstance(item, str):
                urls.append(item)
            elif isinstance(item, dict) and item.get("url"):
                urls.append(item["url"])
        return urls
    raise ValueError(f"Unsupported research format in {path_str}")


def psql_run(sql, dbname, host=None, port=None, user=None, password=None):
    cmd = ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-d", dbname]
    if host:
        cmd += ["-h", host]
    if port:
        cmd += ["-p", str(port)]
    if user:
        cmd += ["-U", user]
    env = os.environ.copy()
    if password is not None:
        env["PGPASSWORD"] = password
    r = subprocess.run(cmd, input=sql, text=True, capture_output=True, env=env)
    if r.returncode != 0:
        raise RuntimeError(
            f"psql failed ({r.returncode})\nSTDOUT:\n{r.stdout}\nSTDERR:\n{r.stderr}"
        )
    return r.stdout


def dollar_quote(s):
    if s is None:
        s = ""
    tag = "json"
    while f"${tag}$" in s:
        tag += "x"
    return f"${tag}${s}${tag}$"


def ensure_db_schema(dbname, **conn):
    sql = r"""
CREATE TABLE IF NOT EXISTS investigations (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    objectives TEXT,
    project TEXT,
    approach TEXT,
    hypothesis TEXT,
    research_impacts TEXT,
    contacts TEXT,
    raw_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS investigation_files (
    investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    type TEXT,
    size TEXT,
    depth INTEGER,
    PRIMARY KEY (investigation_id, path)
);

CREATE INDEX IF NOT EXISTS idx_investigation_files_investigation_id
    ON investigation_files(investigation_id);
"""
    psql_run(sql, dbname, **conn)


def save_investigation_to_db(out, dbname, **conn):
    inv_id = out.get("id") or ""
    raw = json.dumps(out, ensure_ascii=False)
    fields = {
        "id": inv_id,
        "url": out.get("url", ""),
        "title": out.get("title", ""),
        "objectives": out.get("Objectives", ""),
        "project": out.get("Project", ""),
        "approach": out.get("Approach", ""),
        "hypothesis": out.get("Hypothesis", ""),
        "research_impacts": out.get("Research Impacts/Earth Benefits", ""),
        "contacts": out.get("Contact(s)", ""),
    }

    def q(val):
        return dollar_quote("" if val is None else str(val))

    sql_parts = ["BEGIN;"]
    sql_parts.append(
        f"""
INSERT INTO investigations (id, url, title, objectives, project, approach, hypothesis, research_impacts, contacts, raw_json, updated_at)
VALUES ({q(fields['id'])}, {q(fields['url'])}, {q(fields['title'])}, {q(fields['objectives'])}, {q(fields['project'])}, {q(fields['approach'])}, {q(fields['hypothesis'])}, {q(fields['research_impacts'])}, {q(fields['contacts'])}, {dollar_quote(raw)}::jsonb, now())
ON CONFLICT (id) DO UPDATE SET
    url = EXCLUDED.url,
    title = EXCLUDED.title,
    objectives = EXCLUDED.objectives,
    project = EXCLUDED.project,
    approach = EXCLUDED.approach,
    hypothesis = EXCLUDED.hypothesis,
    research_impacts = EXCLUDED.research_impacts,
    contacts = EXCLUDED.contacts,
    raw_json = EXCLUDED.raw_json,
    updated_at = now();
"""
    )
    sql_parts.append(f"DELETE FROM investigation_files WHERE investigation_id = {q(inv_id)};")
    for f in out.get("files", []):
        path = f.get("path", "")
        typ = f.get("type", "")
        size = f.get("size", "")
        depth = f.get("depth")
        depth_sql = "NULL" if depth is None else str(int(depth))
        sql_parts.append(
            f"INSERT INTO investigation_files (investigation_id, path, type, size, depth) VALUES ({q(inv_id)}, {q(path)}, {q(typ)}, {q(size)}, {depth_sql}) ON CONFLICT (investigation_id, path) DO NOTHING;"
        )
    sql_parts.append("COMMIT;")
    psql_run("\n".join(sql_parts), dbname, **conn)


def process_one(job):
    url, idx, total = job["url"], job["idx"], job["total"]
    try:
        print(f"\n=== [{idx}/{total}] {url} ===", file=sys.stderr)
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=not job["headed"])
            context = browser.new_context(viewport={"width": 1600, "height": 1000})
            page = context.new_page()
            try:
                out, net, items = scrape_investigation(
                    page, url, job["delay"], job["max_clicks"], dump=job["dump"] and job["single"]
                )
                if job["single"]:
                    write_outputs(out, items, net, job["json_path"], job["csv_path"], job["net_path"])
                    page.screenshot(path="psi_final.png", full_page=True)
                else:
                    inv_id = out.get("id") or f"item_{idx}"
                    base = Path(job["out_dir"])
                    write_outputs(
                        out,
                        items,
                        net,
                        str(base / f"{inv_id}.json"),
                        str(base / f"{inv_id}.csv"),
                        str(base / f"{inv_id}_network.json"),
                    )
                if job["db_enabled"]:
                    save_investigation_to_db(out, job["db_name"], **job["conn"])
                    print(f"DB-yə yazıldı: {out.get('id')}", file=sys.stderr)
                nfiles = sum(1 for i in items if not i.get("isDir"))
                print(f"Cəmi: {len(items)} element, {nfiles} fayl ({out.get('id')})", file=sys.stderr)
                return {"ok": True, "out": out}
            finally:
                page.close()
                context.close()
                browser.close()
    except Exception as e:
        print(f"XƏTA ({url}): {e}", file=sys.stderr)
        return {"ok": False, "url": url, "error": str(e)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url", nargs="?", help="Tək investigation URL (research verilməyibsə)")
    ap.add_argument(
        "--research",
        help="Bütün investigation URL-ləri olan JSON faylı (məs: resarchs.json). Verilərsə hər URL emal olunur.",
    )
    ap.add_argument("--delay", type=float, default=0.5)
    ap.add_argument("--max-clicks", type=int, default=5000)
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--dump", action="store_true", help="səhifənin xam mətnini raw_page.txt-ə yaz")
    ap.add_argument("--csv", default=None, help="Tək URL rejimində CSV çıxışı (default: psi_files.csv)")
    ap.add_argument("--json", default=None, help="Tək URL rejimində JSON çıxışı (default: psi_files.json)")
    ap.add_argument("--net", default=None, help="Tək URL rejimində şəbəkə JSON çıxışı (default: psi_network.json)")
    ap.add_argument("--out-dir", default="psi_out", help="--research rejimində hər investigation üçün çıxış qovluğu")
    ap.add_argument("--db-name", help="Nəticələri yazmaq üçün PostgreSQL database adı (məs: lunatika)")
    ap.add_argument("--db-host", help="PostgreSQL host")
    ap.add_argument("--db-port", help="PostgreSQL port")
    ap.add_argument("--db-user", help="PostgreSQL istifadəçi")
    ap.add_argument("--db-password", help="PostgreSQL parolu (və ya PGPASSWORD env istifadə edin)")
    ap.add_argument("--workers", type=int, default=4, help="--research rejimində paralel worker sayı (default: 4)")
    args = ap.parse_args()

    urls = []
    if args.research:
        urls = load_research_urls(args.research)
        if not urls:
            print("Research faylında URL tapılmadı", file=sys.stderr)
            sys.exit(1)
    else:
        if not args.url:
            args.url = "https://psi.nasa.gov/physci/repo/data/investigations/PSI-101"
        urls = [args.url]

    single = len(urls) == 1 and not args.research
    if single:
        json_path = args.json or "psi_files.json"
        csv_path = args.csv or "psi_files.csv"
        net_path = args.net or "psi_network.json"
    else:
        out_dir = Path(args.out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        json_path = csv_path = net_path = None

    conn = {
        "host": args.db_host,
        "port": args.db_port,
        "user": args.db_user,
        "password": args.db_password if args.db_password is not None else os.environ.get("PGPASSWORD"),
    }
    db_enabled = bool(args.db_name)
    if db_enabled:
        ensure_db_schema(args.db_name, **conn)
        print(f"DB hazırdır: {args.db_name}", file=sys.stderr)
    from concurrent.futures import ProcessPoolExecutor, as_completed

    results = []
    jobs = []
    for idx, url in enumerate(urls, 1):
        jobs.append({
            "url": url, "idx": idx, "total": len(urls),
            "headed": args.headed, "delay": args.delay, "max_clicks": args.max_clicks,
            "dump": args.dump, "single": single,
            "json_path": json_path, "csv_path": csv_path, "net_path": net_path,
            "out_dir": args.out_dir,
            "db_enabled": db_enabled, "db_name": args.db_name, "conn": conn,
        })

    max_workers = min(len(jobs), max(1, getattr(args, "workers", 4) or 4))
    if single or max_workers == 1:
        for job in jobs:
            r = process_one(job)
            if r.get("ok"):
                results.append(r["out"])
    else:
        with ProcessPoolExecutor(max_workers=max_workers) as ex:
            futs = {ex.submit(process_one, job): job for job in jobs}
            for fut in as_completed(futs):
                r = fut.result()
                if r.get("ok"):
                    results.append(r["out"])

    if not single and results:
        combined = Path(args.out_dir) / "psi_files.json"
        with open(combined, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"Ümumi nəticə: {combined}", file=sys.stderr)

    print(f"Hazırdır: {len(results)}/{len(urls)} investigation emal olundu", file=sys.stderr)


if __name__ == "__main__":
    main()
