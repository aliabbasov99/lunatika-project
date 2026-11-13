import json, os, re, sys, time
sys.path.insert(0, '.'); sys.path.insert(0, 'psi_work')
import psi_download as p
from httpzip import open_zip

missing = [l.split('\t')[0] for l in open('psi_verify_missing.tsv', encoding='utf-8') if l.strip()]
by_inv = {}
for m in missing:
    inv = m.split('/', 1)[0]
    by_inv.setdefault(inv, set()).add(m.rsplit('/', 1)[-1].lower())

for inv in ['PSI-39', 'PSI-98', 'PSI-106', 'PSI-26', 'PSI-99', 'PSI-100']:
    fn = f'psi_work/{inv}_tree_full.json'
    if not os.path.exists(fn):
        print(inv, 'NO TREE'); continue
    t = json.load(open(fn)); zips = []
    def walk(n):
        if isinstance(n, list):
            for x in n: walk(x)
        elif isinstance(n, dict):
            if n.get('directory') is False and (n.get('key') or '').lower().endswith('.zip'):
                zips.append(n)
            for x in n.get('files') or []: walk(x)
    walk(t)
    want = by_inv.get(inv, set())
    print(f'==== {inv}: {len(zips)} zips, {len(want)} missing names', flush=True)
    found = 0
    for idx, z in enumerate(zips, 1):
        name = z['key'].rsplit('/', 1)[-1]
        try:
            url = p.get_presigned_url(inv, z['id'], 120)
            zz = open_zip(url)
            names = zz.namelist()
            hits = [n for n in names if n.rsplit('/', 1)[-1].lower() in want]
            if hits:
                found += len(hits)
                print('  HIT', name, '->', hits, flush=True)
        except Exception as e:
            print('  ERR', name, type(e).__name__, str(e)[:120], flush=True)
    print(f'==== {inv}: hits {found}', flush=True)
