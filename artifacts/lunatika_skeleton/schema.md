# Data schema (shared contract for the whole team)

The master database is `data/flame.db` (SQLite). Every delivery option reads from it:
Option C exports JSON from it, Options A/B can read it directly, Postgres or Cloudflare D1
can import it. **Change this file before changing a table.**

Units everywhere: oxygen **%**, pressure **psi** (as in the challenge text; 1 psi = 6.895 kPa), lengths **mm**, flow **cm/s**, time **s**, temperature **K**.

## Tables

| Table | One row per | Filled by |
|---|---|---|
| `investigations` | PSI investigation (24) | `02_load_psi.py` (from `investigation.json` + `investigation_info.py`) |
| `publications` | paper listed by PSI for an investigation | `02_load_psi.py` |
| `tests` | row of a PSI experiment table | `02_load_psi.py` (one adapter per table in `adapters.py`) |
| `papers` | document findings were extracted from | 05_load_findings.py |
| `findings` | AI-extracted, code-checked finding (page + quote) | 04 + 05 |
| `finding_tests` | finding ↔ PSI tests it names | 05_load_findings.py |
| `scores` | ranking score for a finding / investigation | ranking step (next) |

IDs are stable and readable: `PSI-25`, `PSI-25:3` (publication), `PSI-25:BASS-II:14`
(test = investigation : table : line in NASA's file), `20160012691:f2` (finding).

## Investigation tiers and categories (`investigation_info.py`)

- **Tier 1**: named in the challenge as fire-safety studies: BASS, BASS-II, Saffire-I/II/III, ACME BRE (prevention); SAME, SAME-R (detection); FLEX (suppression).
- **Tier 2**: named as related or same hardware: FLEX-2, CFI, CFI-G, other ACME (incl. E-FIELD), SPICE, SLICE, DAFT.
- **Tier 3**: other PSI combustion studies (mostly analysis of earlier data).
- `categories`: any of `prevention`, `detection`, `suppression`, `fundamental`.

## `tests.row_kind`

| Value | Meaning |
|---|---|
| `test` | one real test run |
| `test_day` | one day of testing (ACME BRE, CLD, E-FIELD, s-Flame, SLICE list days, not runs) |
| `test_matrix` | planned ranges (FLEX-2): values are in `*_min` / `*_max`, not single values |
| `session` | measurement session (DAFT) |
| `data_summary` | list of published datasets (PSI-142) |
| `note` | explanatory row inside NASA's table (e.g. "pre-test flow visualization") |

## `tests.env_tags`: which habitat atmosphere a test resembles

Reference atmospheres from the challenge text: ISS cabin 21% O2 at 14.7 psi; Moon Base / rover >= 30% O2 at <= 10.2 psi; spacesuit 100% O2 at 4.3 psi.

| Tag | Rule |
|---|---|
| cabin-like (ISS/spacecraft) | 19.5-23.5% O2 and 13.0-16.0 psi (or pressure not given) |
| elevated O2 (Moon Base range) | 28-40% O2 |
| very high O2 (worst case) | > 40% O2 |
| Moon Base-like | >= 28% O2 **and** <= 10.9 psi (75 kPa) |
| reduced O2 (suppression / limits) | < 19.5% O2 |
| reduced pressure / elevated pressure | <= 10.9 psi / > 18.9 psi |
| O2 in burner stream (inverse flame) | oxygen flows from the burner into a fuel atmosphere, so it is **not** the room oxygen |

For test days and test matrices, the highest oxygen value tested is used.

## `tests.qc_flags`: nothing is changed silently

Each flag is `field:reason`. The main reasons:

| Reason | Meaning |
|---|---|
| `assumed_cabin_pressure`, `assumed_cabin_air`, `assumed_air_coflow` | the table gives no value; ISS/Cygnus cabin conditions assumed (`investigation_info.py`) |
| `parsed_from_material_text` | size taken from text like "100 micron PMMA film 2 cm wide" |
| `range_mean_used` | "21.5 - 21.7" stored as 21.6 (range kept in min/max) |
| `list_of_values` | "21; 26.5; 40" stored in min/max |
| `approximate` | value had "~" |
| `missing_decimal_assumed` | "037 mm" read as 0.37 mm |
| `source_shows_value_x100_...` | NASA file shows "3400%" for 34% (ACME BRE); divided by 100 |
| `zero_or_negative_in_source_removed` | e.g. FLEX test 115 lists ambient pressure 0 |
| `exact_duplicate_of_line_N` | identical row repeated in NASA's file (kept, flagged) |
| `header_says_length_value_is_rate` | Saffire-II column "?-g Spread Length" holds rates in mm/s |
| `shorter_than_width_check_source` | Saffire-I lists length 40.6 cm, width 94 cm (other Saffire tables list them the other way round) |

`tests.raw` always holds the complete original row as JSON.

## Files exported for the website (`03_export_json.py`)

- `app/public/data/overview.json`: totals plus one summary per investigation (load on the home page).
- `app/public/data/investigations/PSI-xx.json`: details, publications, `variables` (what changed between tests and what stayed the same, excluding our own assumptions), and all rows. Load it when the user opens that investigation.
- `app/public/data/tests.csv`: every row in one file, for download (objective 2: predictive modeling).
