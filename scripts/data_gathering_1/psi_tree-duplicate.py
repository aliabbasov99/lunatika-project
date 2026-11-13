#!/usr/bin/env python3
import argparse, csv, json, re, sys, time
from playwright.sync_api import sync_playwright

WANTED = ["Objectives", "Project", "Approach", "Hypothesis",
          "Research Impacts/Earth Benefits", "Contact(s)"]
STOPS = ["Data Files and Documents", "Publications", "Related Investigations",
         "Citation", "Keywords", "Funding", "References"]

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
        stack = stack[:r["depth"]]
        stack.append(r["name"])
        out.append({**r, "path": "/".join(stack)})
    return out

def get_rows(page):
    return with_paths(page.evaluate(JS_ROWS))

def try_expand(page, row, delay):
    before = len(get_rows(page))
    row_loc = page.locator("a.panel-block").nth(row["idx"])
    strategies = [
        ("ad",     lambda: row_loc.locator(".inline-flex").first.click(timeout=3000)),
        ("ikon",   lambda: row_loc.locator("i").first.click(timeout=3000)),
        ("sətir",  lambda: row_loc.click(timeout=3000)),
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
        target = next((r for r in get_rows(page)
                       if r["isDir"] and not r["isOpen"] and r["path"] not in done), None)
        if not target:
            break
        done.add(target["path"])
        clicks += 1
        print(f"[{clicks}] {target['path']}", file=sys.stderr)
        how = try_expand(page, target, delay)
        print(f"    {'açıldı (' + how + ')' if how else 'AÇILMADI (boş qovluq ola bilər, ya da klik işləmir)'}",
              file=sys.stderr)
    return get_rows(page)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url", nargs="?",
                    default="https://psi.nasa.gov/physci/repo/data/investigations/PSI-101")
    ap.add_argument("--delay", type=float, default=0.5)
    ap.add_argument("--max-clicks", type=int, default=5000)
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--dump", action="store_true", help="səhifənin xam mətnini raw_page.txt-ə yaz")
    ap.add_argument("--csv", default="psi_files.csv")
    ap.add_argument("--json", default="psi_files.json")
    ap.add_argument("--net", default="psi_network.json")
    args = ap.parse_args()

    net = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        page = browser.new_page(viewport={"width": 1600, "height": 1000})

        def on_response(resp):
            try:
                if resp.request.resource_type in ("xhr", "fetch"):
                    entry = {"url": resp.url, "method": resp.request.method,
                             "status": resp.status}
                    try:
                        entry["body"] = resp.json()
                    except Exception:
                        entry["body"] = (resp.text() or "")[:2000]
                    net.append(entry)
            except Exception:
                pass
        page.on("response", on_response)

        page.goto(args.url, wait_until="networkidle", timeout=60000)
        page.wait_for_selector("a.panel-block", timeout=60000)
        time.sleep(2)

        # bağlı accordion/tab varsa aç
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
        if args.dump:
            open("raw_page.txt", "w", encoding="utf-8").write(raw)

        print(f"Başlıq: {title}", file=sys.stderr)
        for w in WANTED:
            print(f"  {w}: {'OK (' + str(len(sections.get(w, ''))) + ' simvol)' if sections.get(w) else 'TAPILMADI'}",
                  file=sys.stderr)
        print(f"İlkin sətir sayı: {len(get_rows(page))}", file=sys.stderr)

        rows = expand_all(page, args.delay, args.max_clicks)
        page.screenshot(path="psi_final.png", full_page=True)
        browser.close()

    with open(args.net, "w", encoding="utf-8") as f:
        json.dump(net, f, ensure_ascii=False, indent=2)
    print(f"Şəbəkə cavabları: {len(net)} ədəd -> {args.net}", file=sys.stderr)

    seen, items = set(), []
    for r in rows:
        if r["path"] not in seen:
            seen.add(r["path"])
            items.append(r)

    for it in items:
        print("  " * it["depth"] + it["name"] + (f"  ({it['size']})" if it["size"] else ""))

    nfiles = sum(1 for i in items if not i["isDir"])
    print(f"\nCəmi: {len(items)} element, {nfiles} fayl", file=sys.stderr)

    m = re.search(r"PSI-\d+", args.url, re.I)
    out = {
        "id": m.group(0).upper() if m else "",
        "url": args.url,
        "title": title,
        **{w: sections.get(w, "") for w in WANTED},
        "files": [{"path": i["path"], "type": "folder" if i["isDir"] else "file",
                   "size": i["size"] or "", "depth": i["depth"]} for i in items],
    }
    with open(args.json, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    with open(args.csv, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["path", "type", "size"])
        for i in items:
            w.writerow([i["path"], "folder" if i["isDir"] else "file", i["size"] or ""])

if __name__ == "__main__":
    main()