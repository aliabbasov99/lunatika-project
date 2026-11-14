# Recall.md — Lunatika PSI Data Knowledge Base

> Bu fayl AI (ve insanlar) ucun yazilib. Lokal PostgreSQL-de saxlanan NASA PSI
> (Physical Sciences Informatics) arasdirma ve material melumatlarinin strukturunu,
> elaqelerini ve istifade orneklerini izah edir. AI bu fayli oxuyaraq bazadan
> sual-cavab, axtarish ve analiz ucun dogru query-leri qura biler.

---

## 1. Qosulma (Connection)

| Param | Deyer |
|---|---|
| Host | `127.0.0.1` |
| Port | `5432` |
| Database | `lunatika` |
| User | `postgres` |
| Parol | `123` (`PGPASSWORD=123`) |
| Server data dir | `/var/lib/pgsql/data` (PostgreSQL 18) |

**Psycopg/psql nümunəsi:**

```bash
PGPASSWORD=123 psql -h 127.0.0.1 -U postgres -d lunatika
```

**Sürətli JSON çıxışı üçün:**

```bash
PGPASSWORD=123 psql -h 127.0.0.1 -U postgres -d lunatika -X -A -t -c "SELECT ..."
```

> NOT: Socket (peer auth) ile `postgres` user-e gire bilmez; mutleq `-h 127.0.0.1`
> (TCP) istifade edin. Parol sorgusunu yoxlamaq ucun `PGPASSWORD=123` muhit
> deyishenini qeyd edin.

---

## 2. Mebleg (Data scale)

| Table | Row sayi (yaxlasma) |
|---|---|
| `investigations` | 24 |
| `investigation_files` | ~49 000 (44 441 file + 4 550 folder) |
| `materials` | 46 |
| `investigation_materials` | 185 |
| `investigation_topics` | 8 |
| `investigation_topic_links` | 39 |

Mebleg menbesi: **NASA PSI** — `https://psi.nasa.gov` (23-24 arasdirma: ACME,
SAFFIRE I/II/III, FLEX/FLEX-2, BASS/BASS-II, SLICE, SPICE, CFMI/CFI, SAME, DAMF,
S-Flame, E-FIELD, BRE ve s.). Ilk yigim linkleri `scripts/data_gathering_1/resarchs.json`-da var.

---

## 3. SXEMA ve ELAQELER (Entity Relationships)

```
investigations (PSI-69, ...)
    │ 1
    ├─── investigation_files        (PSI-69 → "PSI-69/Raw Data/..." fayl yollari)
    │        N
    ├─── investigation_materials    (PSI-69 + methane = role:'fuel', confidence:'high')
    │        │ N
    │        └─── materials (46)    (methane, n_heptane, cotton, nomex_aramid, ...)
    │
    └─── investigation_topic_links  (PSI-69 → topic: liquid_droplet_combustion)
             │ N
             └─── investigation_topics (8: cool_flames, smoke_aerosol_detection, ...)
```

Esas elaqeler:
- `investigation_materials.investigation_id → investigations.id`
- `investigation_materials.material_id → materials.id`
- `investigation_topic_links.investigation_id → investigations.id`
- `investigation_topic_links.topic_id → investigation_topics.id`
- `investigation_files.investigation_id → investigations.id`

### 3.1 `investigations`

| Column | Tip | Izah |
|---|---|---|
| `id` | text PK | `PSI-69` kimi |
| `url` | text | NASA PSI sehifesi |
| `title` | text | Bashliq (eiwezeydi: `"PSI-69Version 5 Flame Extinguishment..."` — id + version + ad yigilib) |
| `objectives`, `project`, `approach`, `hypothesis`, `research_impacts` | text | Elmi metnler |
| `contacts` | text | Elaqedarlar |
| `raw_json` | text | Ilk scraping JSON |
| `updated_at` | text | |

### 3.2 `materials` (46 material)

| Column | Tip | Izah |
|---|---|---|
| `id` | text PK | `methane`, `n_heptane`, `cotton`, `nomex_aramid` kimi snake_case |
| `canonical_name` | text | `"Methane"`, `"n-Heptane"` |
| `category` | text | `alkane`, `gas_fuel`, `alcohol`, `cellulose`, `aramid`, `suppressant`, `oxidizer`, `atmosphere`, `aerosol_standard` ve s. |
| `phase` | text | `gas`, `liquid`, `solid`, `gas/liquid`, `liquid/gas` |
| `chemical_formula` | text | |
| `aliases` | text[] | `{"methane","CH4","natural gas"}` |
| `spacecraft_relevance` | text | Kosmik gemi baglantisinda izah |
| `fire_safety_notes` | text | Yanqing tehlukesi qeydleri |
| `is_fuel` | boolean | Yanacaq olub-olmamasi |

### 3.3 `investigation_materials` (185 elaqe) — ESAS KORPUS

| Column | Tip | Deyerler |
|---|---|---|
| `investigation_id` | text | PK hisse |
| `material_id` | text | PK hisse |
| `role` | text | `fuel` (98), `test_material` (55), `constituent`, `suppressant`, `diluent`, `combustion_product`, `additive`, `test_aerosol`, `emulated_material`, `replaced_material`, `planned_not_tested` |
| `confidence` | text | `high` / `medium` / `low` — elaqenin eminliyi |
| `is_primary` | boolean | Arasdırmanın əsas materialıdır |
| `evidence_quality` | int 0-100 | Delil keyfiyyeti |
| `data_completeness` | int 0-100 | Mebleg tamligi |
| `evidence_files` | jsonb | `["PSI-10/Reports/...pdf"]` — delil fayl yollari |
| `evidence_quote` | text | Meqeleden/melumatdan sitat |
| `notes` | text | |

### 3.4 `investigation_files` (~49k)

| Column | Tip | Izah |
|---|---|---|
| `investigation_id` | text | |
| `path` | text | `PSI-69/Raw Data/...` (repo path strukturunu birbasha saxlayir) |
| `type` | text | `file` ve ya `folder` |
| `size` | text | `"11 KB"`, `"842.23 MB"` (text format!) |
| `depth` | int | |

PK: `(investigation_id, path)`.

### 3.5 `investigation_topics` (8 movzu)

`cool_flames`, `electric_field_effects`, `fire_growth_suppression`,
`gaseous_diffusion_flames`, `liquid_droplet_combustion`, `modeling_and_simulation`,
`smoke_aerosol_detection`, `solid_polymer_flammability`.

`investigation_topic_links`: `(investigation_id, topic_id, relevance)` — relevance default `'primary'`.

### 3.6 Materialların qruplaşdırılması (`category` üzrə, 26 qrup)

| Qrup (`category`) | Say | Materiallar (id) |
|---|---|---|
| `gas_fuel` | 7 | ethane, ethylene, methane, n_butane, n_pentane, propane, propylene |
| `alkane` | 6 | n_decane, n_dodecane, n_heptane, n_hexadecane, n_octane, n_tetradecane |
| `alcohol` | 3 | ethanol, methanol, n_propanol |
| `suppressant` | 3 | carbon_dioxide, helium, sulfur_hexafluoride |
| `branched_alkane` | 3 | farnesane, iso_dodecane, iso_octane |
| `wax` | 2 | japan_wax, paraffin_wax |
| `aromatic` | 2 | propylbenzene, toluene |
| `cellulose` | 2 | cotton, cotton_lampwick |
| `combustion_product` | 2 | smoke_aerosol, soot |
| `oxidizer` | 1 | oxygen |
| `oxidizer_additive` | 1 | ozone |
| `oxygenated_fuel` | 1 | dimethyl_ether |
| `phthalate` | 1 | dbp |
| `polyetherimide` | 1 | ultem_pei |
| `polyimide` | 1 | polyimide_kapton |
| `polyol` | 1 | glycerol |
| `fluoropolymer` | 1 | ptfe_teflon |
| `aerosol_standard` | 1 | arizona_road_dust |
| `aramid` | 1 | nomex_aramid |
| `atmosphere` | 1 | nitrogen |
| `composite_fabric` | 1 | sibal_fabric |
| `elastomer` | 1 | silicone_rubber |
| `acrylic` | 1 | pmma_acrylic |
| `foam` | 1 | pyrell_foam |
| `inorganic_fiber` | 1 | fiberglass |

Faza üzrə bölüşmə: `liquid` 16, `solid` 15, `gas` 12, qarışıq (solid/gas,
liquid/gas, gas/liquid) 3.

Yanacaq olmayanlar (`is_fuel = false`, 10): arizona_road_dust, nitrogen,
smoke_aerosol, soot, fiberglass, oxygen, ozone, carbon_dioxide, helium,
sulfur_hexafluoride — bunlar suppressant/oxidizer/atmosphere/measurement rolundadır.

**Qrup üzrə query:**

```sql
-- Bütün qruplar və materialları:
SELECT category, count(*) AS say, string_agg(canonical_name, ', ' ORDER BY canonical_name) AS materiallar
FROM materials GROUP BY category ORDER BY say DESC;

-- Bir qrupun araşdırmalarla əlaqəsi (məs. bütün alkanlar harda yoxlanılıb):
SELECT m.id, m.canonical_name, im.investigation_id, im.role, im.confidence
FROM materials m
JOIN investigation_materials im ON im.material_id = m.id
WHERE m.category = 'alkane'
ORDER BY m.id, im.investigation_id;
```

### 3.7 View

- `v_investigation_material_summary` — hər arastdirma ucun `group_concat(material)` xulase verir.

---

## 4. HAZIR QUERY-LER (Copy-Paste)

### 4.1 Hansi arasdirma hangi materiallari istifade edir (tam xerite)

```sql
SELECT i.id            AS investigation,
       m.canonical_name AS material,
       im.role,
       im.confidence,
       im.is_primary,
       im.evidence_quality
FROM investigation_materials im
JOIN investigations i ON i.id = im.investigation_id
JOIN materials m      ON m.id = im.material_id
ORDER BY i.id, im.is_primary DESC, im.evidence_quality DESC;
```

### 4.2 Bir material hansı araşdırmalarda yoxlanılır (məs. methane)

```sql
SELECT im.investigation_id, im.role, im.confidence, im.evidence_quote
FROM investigation_materials im
WHERE im.material_id = 'methane'
ORDER BY im.is_primary DESC, im.evidence_quality DESC;
```

Material id-ləri: `SELECT id, canonical_name, is_fuel FROM materials ORDER BY id;`

### 4.3 Yalnız yüksək əminlikli yanacaqlar (fuel)

```sql
SELECT m.canonical_name, m.category, m.phase, m.chemical_formula,
       count(im.investigation_id)          AS istifade_sayi,
       string_agg(im.investigation_id, ', ' ORDER BY im.investigation_id) AS arasdirmalar
FROM materials m
JOIN investigation_materials im ON im.material_id = m.id
WHERE im.role = 'fuel' AND im.confidence = 'high'
GROUP BY m.id
ORDER BY istifade_sayi DESC;
```

### 4.4 Bir araşdırmanın tam profili (məs. PSI-142 Cool Flames)

```sql
SELECT i.id, i.title, i.objectives, i.approach, i.hypothesis, i.research_impacts
FROM investigations i WHERE i.id = 'PSI-142';

-- materialları:
SELECT m.canonical_name, im.role, im.confidence, im.evidence_quality, im.evidence_quote
FROM investigation_materials im
JOIN materials m ON m.id = im.material_id
WHERE im.investigation_id = 'PSI-142'
ORDER BY im.is_primary DESC, im.evidence_quality DESC;

-- mövzuları:
SELECT t.id, t.name, l.relevance
FROM investigation_topic_links l
JOIN investigation_topics t ON t.id = l.topic_id
WHERE l.investigation_id = 'PSI-142';
```

### 4.5 Mövzu üzrə araşdırmalar (məs. cool_flames)

```sql
SELECT l.investigation_id, i.title
FROM investigation_topic_links l
JOIN investigations i ON i.id = l.investigation_id
WHERE l.topic_id = 'cool_flames';
```

### 4.6 Delil fayllarını tapmaq (evidence_files jsonb)

```sql
-- Hansı material-delil qeydlerinde PDF var:
SELECT investigation_id, material_id, evidence_files
FROM investigation_materials
WHERE evidence_files::text <> '[]'
LIMIT 10;

-- Bir araşdırmanın hesabat faylları:
SELECT path, size FROM investigation_files
WHERE investigation_id = 'PSI-69' AND type = 'file'
  AND lower(path) LIKE '%report%'
ORDER BY path;
```

### 4.7 Hansi materiallar əsas (primary) kimi yoxlanılıb

```sql
SELECT m.canonical_name, count(*) AS primary_istifade
FROM investigation_materials im
JOIN materials m ON m.id = im.material_id
WHERE im.is_primary
GROUP BY m.id ORDER BY primary_istifade DESC;
```

### 4.8 Material aliases ile axtarış (məs. "CH4" → methane)

```sql
SELECT id, canonical_name FROM materials
WHERE 'CH4' = ANY(aliases)
   OR canonical_name ILIKE '%methane%';
```

### 4.9 Ölkə (view) ilə sürətli xülasə

```sql
SELECT * FROM v_investigation_material_summary ORDER BY investigation_id;
```

### 4.10 File sayı ve həcmi araşdırma üzrə

```sql
SELECT investigation_id,
       count(*) FILTER (WHERE type='file')   AS fayl_sayi,
       count(*) FILTER (WHERE type='folder') AS qovluq_sayi
FROM investigation_files
GROUP BY investigation_id ORDER BY fayl_sayi DESC;
```

> **DİQQƏT:** `size` sütunu TEXT-dir (`"11 KB"`). Bayta çevirmək üçün script
> səviyyəsində parse lazımdır (nümunə `psi_download.py` → `parse_size()`).

---

## 5. NASA PSI API (baynardan birbaşa)

| İş | URL |
|---|---|
| Araşdırma metadata (dəqiq fayl adları: `added`/`removed`) | `https://psi.nasa.gov/geode-py/ws/repo/investigations/PSI-69` |
| Bütün fayl download | `https://psi.nasa.gov/geode-py/ws/studies/PSI-69/download` |
| İnsan üçün səhifə | `https://psi.nasa.gov/physci/repo/data/investigations/PSI-69` |

---

## 6. Cloudflare Worker API (D1 mirror, production)

`cloudflare-worker/` qovluğunda. Local PG-nin eyni sxeması SQLite (D1)-də durur.
Binding: `PSIDATA`, DB: `PSIDATA` (id `7800bd24-...`). Endpoints:

| Endpoint | Nə verir |
|---|---|
| `/status` | Cədvəl row sayları |
| `/investigations?limit=&offset=` | Bütün araşdırmalar |
| `/investigations/PSI-69` | Bir araşdırma + materiallar + mövzular + fayllar |
| `/files?investigation=PSI-69&q=heptane` | Fayl axtarışı (path LIKE) |
| `/materials` | Materiallar + istifade sayı |
| `/materials/methane` | Bir material + istifade olunduğu araşdırmalar |
| `/fuels` | Yalnız yanacaq əlaqələri |
| `/topics` | Mövzular + araşdırma siyahısı |
| `/query?sql=SELECT ...` | Xam SELECT (yalnız `select`/`with` icazəlidir) |

> Fərq: D1/SQLite-da `is_primary` `INTEGER` (0/1), local PG-də `BOOLEAN`dur.
> D1-də `size` yine text, `evidence_files` text kimi durur.

---

## 7. Skriptler (`scripts/data_gathering_1/`)

| Fayl | İş |
|---|---|
| `psi_tree.py` | Playwright ile psi.nasa.gov-dan araşdırma səhifələrini scrape edir (Objectives, Project, Approach, Hypothesis, Research Impacts, Contacts) |
| `psi_download.py` | PG `investigation_files.path` strukturunu saxlayaraq faylları paralel yükləyir (`--workers 32`). Default formatlar: pdf, txt, rtf, xls, xlsx, doc, docx, ppt, pptx. `PSI-XXX_<ext>` API-dən endirir, 255 baytdan uzun komponentləri SHA1 hash-le qısaldır (`sanitize_component`) |
| `psi_verify.py` | Yüklənənləri yoxlayır (missing / size mismatch TSV çıxarır) |
| `resarchs.json` | 24 əsas araşdırma URL-i |
| `psi_files.json/csv`, `psi_network.json` | Fayl ağacı məlumatları |
| `wanted.txt` | Yüklənəcək siyahı |
| `downloads/` | Endirilmiş fayllar (məs. `HKPData_gmt236_2.csv` — ISS telemetriya) |

**Yükləmə əmri nümunəsi:**

```bash
PGPASSWORD=123 python3 psi_download.py --db-name lunatika --db-host 127.0.0.1 \
  --db-user postgres --workers 32
```

---

## 8. Frontend / Project haqqında qeydlər

- React 19 + Vite 8 + Tailwind 4 + react-router 7 (SPA).
- `/` → `/chat` redirect (`App.tsx`).
- Chat: `src/components/chat/*` (ChatView, MessageList, MessageItem, Composer),
  `src/services/chatService.ts` → `POST /api/chat`.
- `.env.local`-da `VIALERA_API_KEY` ve `VIALERA_MODEL=gpt-6-luna` var.
- Dev server: `npm run dev` → `0.0.0.0:5173` (LAN-a açıq).

---

## 9. AI üçün istifadə qaydaları (qısa xülasə)

1. Material↔araşdırma suallarında həmişə `investigation_materials` korpusuna bax;
   `role` + `confidence` + `is_primary` filtrləri cavabın keyfiyyətini göstərir.
2. `confidence='high'` və `evidence_quality >= 80` olan qeydlər etibarlı cavab üçün əsasdır.
3. Fayl yolları `investigation_files.path`-də direkt axtarıla bilər (`LIKE`/`ILIKE`),
   amma `size` mətn formatındadır — hesablama aparmayın, yalnız göstərin.
4. Material adı user tərəfindən qeyri-standart verildikdə (`CH4`, `natural gas`,
   `heptane`) əvvəlcə `aliases` massivində axtarın, sonra `canonical_name ILIKE`.
5. Mövzu sualları (`cool flames`, `soot`, `droplet`) üçün `investigation_topics.id`
   siyahısına uyğunlaşdırın — 8 mövzu var, yuxarıda tam siyahı.
6. Production API lazım olanda `/query?sql=` endpointindən SELECT göndərilir;
   PostgreSQL-spesifik sintaksis (`FILTER`, `ANY()`, `::text` cast) D1-də işləmir —
   orada sadə JOIN/LIKE yazın.
7. Əlaqə qurmaq üçün join açarları: `investigation_id` və `material_id` —
   hər iki cədvəldə eyni adla durur.
