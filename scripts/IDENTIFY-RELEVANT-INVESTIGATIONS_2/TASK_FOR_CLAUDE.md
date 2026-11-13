# Task: NASA PSI material <-> investigation link layer

## Goal
Every PSI fire-safety investigation is now linked to the **materials** it actually used
(fuels, test samples, constituents, suppressants, aerosols). A chatbot must use these
links to route a user's question to the right investigations (e.g. "PMMA flame spread"
-> PSI-25/PSI-26/PSI-62/PSI-99; "SAME smoke particles" -> PSI-102/PSI-101/PSI-115).

## Database
- Connection: `PGPASSWORD=123 psql -U postgres -h 127.0.0.1 -d lunatika`
- Existing tables: `investigations` (24 rows), `investigation_files` (48 809 rows).

## New schema (applied, idempotent)
| Object | Purpose |
|---|---|
| `materials` | 46 curated materials: canonical name, aliases[], category, phase, is_fuel, spacecraft relevance, fire-safety notes |
| `investigation_materials` | link per (investigation, material): role, confidence, is_primary, evidence_quality, data_completeness, evidence_files (jsonb paths), evidence_quote, notes |
| `investigation_topics` + `investigation_topic_links` | 8 topic groups for query routing (keywords + investigations) |
| `v_investigation_material_summary` | per-investigation JSON of its materials |
| `v_material_investigations` | per-material list of investigations |
| `v_topic_investigations` | per-topic list of investigations |

## `role` values
`test_material`, `fuel`, `constituent`, `emulated_material`, `planned_not_tested`,
`replaced_material`, `test_aerosol`, `combustion_product`, `suppressant`, `diluent`,
`additive`, `reference_material`.

## Data rules (curated from PSI reports, verified quotes)
- SIBAL fabric = composite material AND its parts cotton + fiberglass (`constituent`).
- Gaseous fuels (methane, ethylene, ...) are `fuel` + phase=gas; solids are test materials.
- PSI-101 (SAME-R): Pyrell replaced DBP (`replaced_material` link kept).
- PSI-159: pentane planned but replaced by ethane (`planned_not_tested`).
- Every link except PSI-60/PSI-62 (metadata-only, no local files) has ≥1 real evidence
  path under `PSI-TEXT-FILES_1_1/` (paths stored without `.txt` suffix) and an exact
  quote from that evidence (quotes are normalized for PDF whitespace/subscripts).
- Confidence/evidence_quality/data_completeness are 3 separate fields: citation strength,
  how strong the evidence is, and how complete the data set is (0-100).

## Files in this folder
- `seed_materials.py` — single source of truth; regenerates `data/` + `sql/`.
- `data/*.json|csv` — human-readable exports.
- `sql/01..04` — schema, seeds, views (already applied to DB).
- `.cache/psi_text/` — extracted text of all PSI PDF/Office files (NOT in the zip; big).
- `extract_psi_text.py`, `scan_materials.py` — extraction/scanning helpers.

## What Claude should do
1. Query the views above to answer material/topic questions.
2. Use `role` + `is_primary` to rank investigations for a user query;
   use `keywords` in `investigation_topics` to route natural-language questions.
3. If asked where evidence comes from, return `evidence_files` + `evidence_quote`.
4. To extend/fix a link, edit `seed_materials.py`, rerun it, then apply the sql files.
