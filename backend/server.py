"""Lunatika chat backend: topic-first retrieval of NASA PSI research.

Run from the project root with: python backend/server.py
The API key stays on the server and is never sent to the browser.

Pipeline for every question:
  1. ROUTE   - an LLM call classifies the question (any language) into the DB's
               investigation_topics + materials, picks top-5/top-10 and the
               parameters worth extracting. Output is validated against the DB.
  2. COHORT  - PostgreSQL returns ONLY investigations linked to those topics /
               materials (not the whole corpus), pre-ranked by overlap.
  3. READ    - abstracts + keyword-focused excerpts of the cohort's reports.
  4. RANK    - an LLM call extracts parameters and scores 4 criteria (0-100).
               The SERVER computes the weighted total (40/25/20/15).
  5. VERIFY  - ids/titles/urls come from the DB, invented ids are dropped,
               parameters whose source file was not supplied are flagged.
"""

from __future__ import annotations

import base64
import json
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
API_URL = "https://api.vialera.online/v1/chat/completions"
MODEL = os.getenv("VIALERA_MODEL", "gpt-6-luna")
PSI_TEXT_ROOT = ROOT / "scripts" / "PSI-TEXT-FILES_1_1"

# Use "the language of the user's question" to answer in the user's language instead.
ANSWER_LANGUAGE = "English"

# Rubric shown to the jury. Totals are computed here, never by the LLM.
WEIGHTS = {
    "relevance": 0.40,
    "conditions_similarity": 0.25,
    "safety_significance": 0.20,
    "data_completeness": 0.15,
}
TOP_K = {"narrow": 5, "broad": 10}
NOT_STATED = "not stated in sources"

# ---------------------------------------------------------------------------
# PostgreSQL helpers (psql subprocess, same setup as before)
# ---------------------------------------------------------------------------

def pg_env() -> dict:
    env = os.environ.copy()
    for key, value in (("PGHOST", "127.0.0.1"), ("PGPORT", "5432"), ("PGUSER", "postgres"),
                       ("PGDATABASE", "lunatika"), ("PGPASSWORD", "123")):
        env.setdefault(key, value)
    return env


def psql_json(sql: str, timeout: int = 20):
    """Run a query that returns ONE jsonb value; raise on SQL errors (no silent failures)."""
    try:
        done = subprocess.run(["psql", "-X", "-q", "-t", "-A", "-c", sql], env=pg_env(),
                              capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise RuntimeError(f"PostgreSQL unavailable: {error}") from error
    if done.returncode != 0:
        raise RuntimeError(f"PostgreSQL query failed: {done.stderr.strip()[:600]}")
    out = done.stdout.strip()
    return json.loads(out) if out else None


def atlas_data() -> dict:
    """Small, read-only dataset used by Mission Explorer and Applications."""
    sql = """
    SELECT jsonb_build_object(
      'investigations', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', i.investigation_id, 'acronym', i.acronym, 'title', i.title,
        'categories', i.categories, 'fuel_state', i.fuel_state, 'gravity', i.gravity,
        'platform', i.platform, 'hardware', i.hardware, 'objective', i.objective,
        'approach', i.approach, 'research_impacts', i.research_impacts, 'psi_url', i.psi_url,
        'n_tests', (SELECT count(*) FROM skeleton_tests t WHERE t.investigation_id = i.investigation_id),
        'n_findings', (SELECT count(*) FROM skeleton_findings f WHERE f.investigation_id = i.investigation_id AND f.verdict = 'accepted')
      ) ORDER BY i.investigation_id), '[]'::jsonb) FROM skeleton_investigations i),
      'findings', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', f.finding_id, 'investigation_id', f.investigation_id,
        'type', f.finding_type, 'kind', f.kind, 'category', f.category,
        'material', f.material, 'gravity', f.gravity, 'o2_pct', f.o2_pct,
        'pressure_psi', f.pressure_psi, 'quantity', f.quantity, 'value', f.value,
        'unit', f.unit, 'statement', f.statement, 'safety_implication', f.safety_implication,
        'earth_application', f.earth_application, 'equipment_implication', f.equipment_implication,
        'source_page', f.source_page, 'verdict', f.verdict, 'confidence', f.confidence,
        'importance', f.importance, 'psi_url', i.psi_url, 'investigation_title', i.title,
        'acronym', i.acronym, 'hardware', i.hardware, 'platform', i.platform,
        'document_title', d.title, 'document_year', d.year, 'document_authors', d.authors,
        'document_doi', d.doi
      ) ORDER BY CASE f.importance WHEN 'key' THEN 0 WHEN 'supporting' THEN 1 ELSE 2 END, f.finding_id), '[]'::jsonb)
        FROM skeleton_findings f
        LEFT JOIN skeleton_investigations i ON i.investigation_id = f.investigation_id
        LEFT JOIN skeleton_documents d ON d.document_id = f.document_id
       WHERE f.verdict = 'accepted'),
      'documents', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', document_id, 'investigation_id', investigation_id, 'title', title,
        'authors', authors, 'year', year, 'doi', doi, 'type', doc_type, 'source', source
      ) ORDER BY year DESC NULLS LAST, title), '[]'::jsonb) FROM skeleton_documents),
      'counts', jsonb_build_object(
        'investigations', (SELECT count(*) FROM skeleton_investigations),
        'tests', (SELECT count(*) FROM skeleton_tests),
        'documents', (SELECT count(*) FROM skeleton_documents),
        'findings', (SELECT count(*) FROM skeleton_findings WHERE verdict = 'accepted')
      )
    )
    """
    return psql_json(sql, timeout=30) or {'investigations': [], 'findings': []}


# ---------------------------------------------------------------------------
# Chat history persistence (unchanged behaviour)
# ---------------------------------------------------------------------------

CHAT_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS lunatika_chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New chat',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
)
"""


def chat_db(command: str) -> str:
    env = pg_env()
    try:
        init = subprocess.run(["psql", "-X", "-q", "-t", "-A", "-c", CHAT_TABLE_SQL], env=env,
                              capture_output=True, text=True, timeout=10)
        if init.returncode != 0:
            return ""
        result = subprocess.run(["psql", "-X", "-q", "-t", "-A", "-c", command], env=env,
                                capture_output=True, text=True, timeout=20)
        return result.stdout.strip() if result.returncode == 0 else ""
    except (OSError, subprocess.TimeoutExpired):
        return ""


def load_chats_db() -> list[dict]:
    output = chat_db("SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'title',title,'messages',messages,'createdAt',created_at,'updatedAt',updated_at) ORDER BY updated_at DESC), '[]'::jsonb) FROM lunatika_chats;")
    try:
        rows = json.loads(output) if output else []
        return rows if isinstance(rows, list) else []
    except json.JSONDecodeError:
        return []


def save_chat_db(chat: dict) -> None:
    encoded = base64.b64encode(json.dumps(chat.get("messages", []), ensure_ascii=False).encode()).decode()
    chat_id = str(chat.get("id", "")).replace("'", "''")
    title = str(chat.get("title", "New chat")).replace("'", "''")
    created = int(chat.get("createdAt", 0) or 0)
    updated = int(chat.get("updatedAt", 0) or 0)
    sql = f"""INSERT INTO lunatika_chats(id,title,messages,created_at,updated_at)
      VALUES ('{chat_id}','{title}',convert_from(decode('{encoded}','base64'),'UTF8')::jsonb,{created},{updated})
      ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,messages=EXCLUDED.messages,updated_at=EXCLUDED.updated_at;"""
    chat_db(sql)


def load_local_env() -> None:
    env_file = ROOT / ".env.local"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"\''))


# ---------------------------------------------------------------------------
# LLM helpers
# ---------------------------------------------------------------------------

def call_llm(messages: list[dict], temperature: float = 0.2, timeout: int = 120) -> str:
    api_key = os.getenv("VIALERA_API_KEY")
    if not api_key:
        raise RuntimeError("VIALERA_API_KEY tapılmadı. .env.local faylını yoxla.")
    payload = json.dumps({"model": os.getenv("VIALERA_MODEL", MODEL), "messages": messages,
                          "temperature": temperature}).encode("utf-8")
    request = Request(API_URL, data=payload, method="POST", headers={
        "Authorization": f"Bearer {api_key}", "Content-Type": "application/json",
        "Accept": "application/json", "User-Agent": "Lunatika/1.0",
    })
    try:
        with urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Vialera API xətası ({error.code}): {detail}") from error
    except URLError as error:
        raise RuntimeError(f"Vialera API-yə qoşulmaq olmadı: {error.reason}") from error
    content = result.get("choices", [{}])[0].get("message", {}).get("content")
    if not content:
        raise RuntimeError("Vialera API boş cavab qaytardı.")
    return content


def parse_json_object(text: str) -> dict | None:
    """Tolerate ```json fences and chatter around the JSON object."""
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    if fenced:
        text = fenced.group(1)
    else:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            text = text[start:end + 1]
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


def as_list(value) -> list:
    return value if isinstance(value, list) else []


def maybe_score(value) -> int | None:
    """0-100 int from 85, 85.4, '85', '85/100'; None when no number can be read."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        match = re.search(r"-?\d+(?:\.\d+)?", str(value))
        if not match:
            return None
        number = float(match.group())
    return int(max(0, min(100, round(number))))


def to_score(value, default: int = 0) -> int:
    score = maybe_score(value)
    return default if score is None else score


def safe_keywords(values, limit: int = 10) -> list[str]:
    """Lowercase ascii terms only - they are interpolated into LIKE patterns."""
    out: list[str] = []
    for value in as_list(values):
        word = re.sub(r"-{2,}", "-", re.sub(r"[^a-z0-9 \-/.]", "", str(value).lower())).strip(" -")
        if 2 < len(word) <= 40 and word != "psi" and word not in out:
            out.append(word)
    return out[:limit]


def sql_array(values: list[str]) -> str:
    """Only call with already-validated ids (allow-listed against the DB)."""
    return "ARRAY[" + ",".join("'" + v.replace("'", "''") + "'" for v in values) + "]::text[]"


# ---------------------------------------------------------------------------
# Step 1 - ROUTE: which topic group(s) does the question belong to?
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def load_catalog() -> dict:
    topics = psql_json("SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'name',name,'description',description) ORDER BY id),'[]'::jsonb) FROM investigation_topics;")
    materials = psql_json("SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'name',canonical_name,'category',category,'aliases',aliases) ORDER BY id),'[]'::jsonb) FROM materials;")
    return {"topics": topics or [], "materials": materials or []}


ROUTER_PROMPT = """You are the query router of a NASA PSI fire-safety research dashboard.
Read the user's question (it may be Azerbaijani, Turkish, English, ...). Do NOT answer it and do NOT search yet.
Decide which research groups it belongs to, so that retrieval can be restricted to those groups.

Return strict JSON only:
{"language": "<language of the question>",
 "topics": ["<topic id>", ...],
 "materials": ["<material id>", ...],
 "keywords_en": ["<english search term>", ...],
 "parameters": ["<measurable parameter worth extracting>", ...],
 "breadth": "narrow" | "broad",
 "reason": "<one sentence: why these groups>"}

Rules:
- topics: 1-3 ids copied from TOPICS, best first. Only groups the question really concerns.
- materials: ids copied from MATERIALS that the question names or clearly implies. Translate and
  normalise (heptan -> n_heptane, metanol -> methanol, PMMA -> pmma_acrylic). [] if none.
- keywords_en: 4-10 English terms a report would contain (e.g. "extinction diameter", "cool flame", "droplet").
- parameters: 6-10 measurable quantities an engineer would want from articles in these groups
  (e.g. droplet diameter, ambient O2 %, pressure, diluent, gravity level, facility, test date).
- breadth: "narrow" = specific phenomenon/material (answer: top 5); "broad" = general theme (answer: top 10).
- Never invent ids. Use only ids that appear below."""


def requested_investigation_ids(query: str) -> list[str]:
    return sorted({m.replace(" ", "-") for m in re.findall(r"\bPSI[- ]?\d{1,3}\b", query.upper())})


def route_query(query: str, history: list[dict]) -> dict:
    catalog = load_catalog()
    topic_ids = {t["id"] for t in catalog["topics"]}
    material_ids = {m["id"] for m in catalog["materials"]}
    materials_compact = [{"id": m["id"], "name": m["name"], "category": m["category"],
                          "aliases": as_list(m.get("aliases"))[:6]} for m in catalog["materials"]]
    system = (ROUTER_PROMPT
              + "\n\nTOPICS:\n" + json.dumps(catalog["topics"], ensure_ascii=False, separators=(",", ":"))
              + "\n\nMATERIALS:\n" + json.dumps(materials_compact, ensure_ascii=False, separators=(",", ":")))
    data = None
    for _ in range(2):  # one retry if the model returns non-JSON
        try:
            data = parse_json_object(call_llm([{"role": "system", "content": system}, *history[-4:]],
                                              temperature=0, timeout=60))
        except RuntimeError:
            data = None
        if data:
            break
    fallback = data is None
    data = data or {}
    topics = [t for t in as_list(data.get("topics")) if t in topic_ids][:3]
    materials = [m for m in as_list(data.get("materials")) if m in material_ids][:6]
    if not topics and not materials:
        fallback = True
        topics = sorted(topic_ids)  # degraded mode: whole corpus, ranked by keyword overlap
    keywords = safe_keywords(data.get("keywords_en"))
    if not keywords:
        keywords = safe_keywords(re.findall(r"[A-Za-z][A-Za-z\-]{3,}", query))
    breadth = "narrow" if data.get("breadth") == "narrow" else "broad"
    top_k = TOP_K[breadth]
    explicit = re.search(r"\btop\s*(\d{1,2})\b", query, re.I)  # "top 3" typed by the user wins
    if explicit:
        top_k = max(1, min(10, int(explicit.group(1))))
    return {
        "language": str(data.get("language") or ""), "topics": topics, "materials": materials,
        "keywords": keywords, "parameters": [str(p)[:80] for p in as_list(data.get("parameters"))][:10],
        "breadth": breadth, "top_k": top_k, "reason": str(data.get("reason") or ""),
        "requested_ids": [i for i in requested_investigation_ids(query) if re.fullmatch(r"PSI-\d{1,3}", i)],
        "fallback": fallback,
    }


# ---------------------------------------------------------------------------
# Step 2 - COHORT: search only inside the selected groups
# ---------------------------------------------------------------------------

def fetch_cohort(route: dict, limit: int) -> list[dict]:
    topics, materials = sql_array(route["topics"]), sql_array(route["materials"])
    requested = sql_array(route["requested_ids"])
    kw = " + ".join(f"(s.doc LIKE '%{k}%')::int" for k in route["keywords"]) or "0"
    sql = f"""
    WITH scored AS (
      SELECT s.id, s.title, s.url, s.objectives, s.project, s.approach, s.hypothesis, s.research_impacts,
             COALESCE(t.topic_hits, 0) AS topic_hits,
             COALESCE(m.material_hits, 0) AS material_hits,
             COALESCE(m.primary_hits, 0) AS primary_hits,
             ({kw}) AS keyword_hits,
             (s.id = ANY({requested}))::int AS requested
      FROM (SELECT i.*, lower(concat_ws(' ', i.title, i.objectives, i.approach, i.project)) AS doc
            FROM investigations i) s
      LEFT JOIN (SELECT investigation_id, count(*) AS topic_hits FROM investigation_topic_links
                 WHERE topic_id = ANY({topics}) GROUP BY investigation_id) t ON t.investigation_id = s.id
      LEFT JOIN (SELECT investigation_id, count(*) AS material_hits,
                        count(*) FILTER (WHERE is_primary) AS primary_hits
                 FROM investigation_materials WHERE material_id = ANY({materials})
                 GROUP BY investigation_id) m ON m.investigation_id = s.id
      WHERE t.investigation_id IS NOT NULL OR m.investigation_id IS NOT NULL OR s.id = ANY({requested})
    ), top AS (
      SELECT *, (1000 * requested + 100 * topic_hits + 80 * material_hits + 40 * primary_hits
                 + 10 * keyword_hits) AS pre_score
      FROM scored ORDER BY pre_score DESC, id LIMIT {int(limit)}
    )
    SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.pre_score DESC, r.id), '[]'::jsonb) FROM (
      SELECT c.id, c.title, c.url, c.objectives, c.project, c.approach, c.hypothesis, c.research_impacts,
             c.topic_hits, c.material_hits, c.primary_hits, c.keyword_hits, c.pre_score,
             (SELECT COALESCE(jsonb_agg(jsonb_build_object('topic_id', t.id, 'name', t.name, 'relevance', l.relevance)), '[]'::jsonb)
                FROM investigation_topic_links l JOIN investigation_topics t ON t.id = l.topic_id
               WHERE l.investigation_id = c.id) AS topics,
             (SELECT COALESCE(jsonb_agg(x ORDER BY x.is_primary DESC, x.evidence_quality DESC NULLS LAST), '[]'::jsonb) FROM (
                SELECT m.id AS material_id, m.canonical_name AS name, m.category, im.role, im.confidence,
                       im.is_primary, im.evidence_quality, im.data_completeness,
                       left(im.evidence_quote, 300) AS evidence_quote, im.evidence_files
                  FROM investigation_materials im JOIN materials m ON m.id = im.material_id
                 WHERE im.investigation_id = c.id
                 ORDER BY im.is_primary DESC, im.evidence_quality DESC NULLS LAST LIMIT 12) x) AS materials,
             (SELECT jsonb_build_object('n_links', count(*),
                                        'avg_evidence_quality', round(avg(im.evidence_quality)),
                                        'avg_data_completeness', round(avg(im.data_completeness)))
                FROM investigation_materials im
               WHERE im.investigation_id = c.id AND (im.is_primary OR im.material_id = ANY({materials}))) AS evidence_stats
        FROM top c) r;
    """
    return psql_json(sql, timeout=30) or []


# ---------------------------------------------------------------------------
# Step 3 - READ: abstracts + focused excerpts of the cohort's reports
# ---------------------------------------------------------------------------

def read_text(path: Path, limit: int) -> str:
    try:
        if path.suffix.lower() == ".pdf":
            done = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True,
                                  text=True, timeout=15, check=False)
            return done.stdout[:limit] if done.returncode == 0 else ""
        return path.read_text(encoding="utf-8", errors="ignore")[:limit]
    except (OSError, subprocess.TimeoutExpired):
        return ""


def excerpt(text: str, keywords: list[str], limit: int) -> str:
    """Head of the document + windows around keyword hits (tables hide deep in PDFs)."""
    text = re.sub(r"[ \t]+", " ", text)
    if len(text) <= limit:
        return text
    head = text[: limit // 3]
    low, spans = text.lower(), []
    for word in keywords:
        for match in list(re.finditer(re.escape(word), low))[:30]:
            spans.append((max(0, match.start() - 500), min(len(text), match.end() + 700)))
    spans.sort()
    merged: list[list[int]] = []
    for start, end in spans:
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    parts, used = [head], len(head)
    for start, end in merged:
        start = max(start, len(head))
        if end <= start:
            continue
        piece = text[start:end][: max(0, limit - used)]
        if piece:
            parts.append(piece)
            used += len(piece)
        if used >= limit:
            break
    return "\n[...]\n".join(parts)


def pick_files(directory: Path, keywords: list[str], limit: int = 3) -> list[Path]:
    preferred = ("report", "science document", "experimental table", "result", "summary", "abstract", "paper", "publication")
    files = [p for p in directory.rglob("*")
             if p.is_file() and p.suffix.lower() in {".pdf", ".txt", ".md", ".csv"}]

    def priority(path: Path):
        name = path.name.lower()
        pref = next((i for i, token in enumerate(preferred) if token in name), len(preferred))
        return pref, -sum(word in name for word in keywords), str(path)

    return sorted(files, key=priority)[:limit]


def gather_documents(candidates: list[dict], keywords: list[str], budget: int = 70000) -> dict[str, list[tuple[str, str]]]:
    dirs = {d.name.upper(): d for d in PSI_TEXT_ROOT.iterdir() if d.is_dir()} if PSI_TEXT_ROOT.exists() else {}
    per_investigation = max(3000, budget // max(1, len(candidates)))

    def work(candidate: dict):
        directory = dirs.get(candidate["id"].upper())  # exact folder match: PSI-10 never matches PSI-100
        if not directory:
            return candidate["id"], []
        files = pick_files(directory, keywords)
        per_file = per_investigation // max(1, len(files))
        docs = []
        for path in files:
            text = read_text(path, 150000)
            if len(text.strip()) >= 80:
                docs.append((str(path.relative_to(ROOT)), excerpt(text, keywords, per_file)))
        return candidate["id"], docs

    with ThreadPoolExecutor(max_workers=6) as pool:
        return dict(pool.map(work, candidates))


# ---------------------------------------------------------------------------
# Step 4 - RANK: LLM extracts parameters + scores; the server does the maths
# ---------------------------------------------------------------------------

RANK_PROMPT = """You are a NASA fire-safety research analyst inside a dashboard. A NASA engineer asked a question.
Rank the most useful PSI investigations (research articles) for it. Answer language: {language}.
Return strict JSON only - no Markdown, no code fences.

GROUNDING RULES
- Use ONLY the CANDIDATES below (database metadata + extracted report text). Never invent ids, numbers or dates.
- If a value cannot be read in the supplied text, write "{not_stated}". Never estimate a measured value.
- Omit candidates that do not genuinely help. Return at most {top_k} articles; fewer if matches are weak.
- Judge by material, phase and phenomenon: do not present a solid flame-spread study as a droplet study or vice versa.

SCORING - integers 0-100 per criterion (the server computes the weighted total, do NOT):
- relevance (weight 40%): how directly the article answers the question (phenomenon, material, regime).
- conditions_similarity (25%): how close its test conditions (gravity, O2 %, pressure, flow, geometry, fuel/material) are to the user's scenario.
- safety_significance (20%): how much the findings matter for spacecraft / habitat fire risk.
- data_completeness (15%): how many of the parameters of interest are actually readable in the supplied sources.
Give one short justification per criterion in score_notes - a jury will read them.
evidence_quality_estimate (0-100) is separate from the scores: completeness, reliability and comparability of the evidence.

PARAMETERS: 4-10 per article, chosen for this question's research group(s). Start from PARAMETERS OF INTEREST and
add what the source really reports (sample/droplet size, extinction diameter, ambient O2 %, pressure, diluent, flow
velocity, gravity level, facility, test dates ...). "weight" = importance for THIS question (0-100, independent per
parameter). "source" = the exact FILE path the value was read from, or "database".

OUTPUT SCHEMA
{{"answer_summary": "2-4 sentences answering the question directly",
 "why_relevant": "closing paragraph: why these articles fit THIS question and how they compare",
 "articles": [{{
   "id": "PSI-xxx", "date": "when the experiment/report was done, or '{not_stated}'",
   "objective": "...", "method": "...", "project": "...", "materials": ["..."],
   "parameters": [{{"name": "...", "value": "...", "unit": "...", "weight": 0, "reason": "...", "source": "FILE path or database"}}],
   "parameter_chart": [{{"title": "...", "unit": "...", "series": [{{"name": "...", "values": [{{"label": "...", "value": 0}}]}}]}}],
   "key_findings": ["..."], "limitations": ["..."],
   "recommendation": "how this article helps the user's question",
   "source_files": ["FILE paths actually used"],
   "scores": {{"relevance": 0, "conditions_similarity": 0, "safety_significance": 0, "data_completeness": 0}},
   "score_notes": {{"relevance": "...", "conditions_similarity": "...", "safety_significance": "...", "data_completeness": "..."}},
   "evidence_quality_estimate": 0, "evidence_note": "...", "rationale": "..."}}]}}

ROUTING (already decided): {routing}
PARAMETERS OF INTEREST: {parameters}

CANDIDATES (cohort of the selected groups only):
{candidates}"""


def clip(value, size: int) -> str:
    return str(value or "")[:size]


def format_candidate(candidate: dict, docs: list[tuple[str, str]]) -> str:
    materials = [{k: m.get(k) for k in ("name", "role", "confidence", "is_primary", "evidence_quality",
                                        "data_completeness", "evidence_quote")}
                 for m in as_list(candidate.get("materials"))]
    lines = [
        f"=== {candidate['id']} | {candidate.get('title')} ===",
        f"URL: {candidate.get('url')}",
        f"OBJECTIVES: {clip(candidate.get('objectives'), 1200)}",
        f"APPROACH: {clip(candidate.get('approach'), 1200)}",
        f"HYPOTHESIS: {clip(candidate.get('hypothesis'), 600)}",
        f"RESEARCH IMPACTS: {clip(candidate.get('research_impacts'), 400)}",
        f"PROJECT: {clip(candidate.get('project'), 300)}",
        "TOPICS (db): " + json.dumps(candidate.get("topics"), ensure_ascii=False),
        "MATERIAL LINKS (db): " + json.dumps(materials, ensure_ascii=False),
        "DB EVIDENCE STATS: " + json.dumps(candidate.get("evidence_stats"), ensure_ascii=False),
    ]
    for path, text in docs:
        lines.append(f"FILE: {path}\n{text}")
    if not docs:
        lines.append("FILES: no readable report text available - rely on database fields only.")
    return "\n".join(lines)


def source_supported(source: str, allowed: set[str]) -> bool:
    s = source.strip().lower()
    if not s or s == "database":
        return True
    return any(s == a.lower() or Path(a).name.lower() in s or s in a.lower() for a in allowed if a)


def clean_parameters(raw, allowed: set[str]) -> list[dict]:
    if isinstance(raw, dict):
        raw = [{"name": k, "value": v} for k, v in raw.items()]
    out = []
    for p in as_list(raw):
        if not isinstance(p, dict) or not p.get("name"):
            continue
        value = p.get("value", NOT_STATED)
        source = str(p.get("source") or "database")
        out.append({
            "name": str(p["name"]), "value": value, "unit": p.get("unit"), "weight": to_score(p.get("weight")),
            "reason": str(p.get("reason") or ""), "source": source,
            # flagged when the model cites a file that was never supplied to it
            "verified": str(value) == NOT_STATED or source_supported(source, allowed),
        })
    return out


def clean_title(title: str) -> str:
    return re.sub(r"^PSI[- ]?\d+\s*(Version\s*\d+)?\s*", "", title or "", flags=re.I).strip() or (title or "")


def evidence_label(score: int) -> str:
    return "High" if score >= 80 else "Medium" if score >= 60 else "Low"


def finalize(payload: dict, candidates: list[dict], docs: dict, route: dict) -> dict:
    by_id = {c["id"].upper(): c for c in candidates}
    ranked = []
    for item in as_list(payload.get("articles")):
        if not isinstance(item, dict):
            continue
        cand = by_id.get(str(item.get("id", "")).strip().upper())
        if not cand:  # id the model invented or took from outside the cohort
            continue
        read_files = [path for path, _ in docs.get(cand["id"], [])]
        allowed = set(read_files)
        for material in as_list(cand.get("materials")):
            allowed.update(str(f) for f in as_list(material.get("evidence_files")))
        scores = item["scores"] if isinstance(item.get("scores"), dict) else item
        breakdown = {key: to_score(scores.get(key)) for key in WEIGHTS}
        stats = cand.get("evidence_stats") or {}
        notes = item.get("score_notes") if isinstance(item.get("score_notes"), dict) else {}
        notes = {key: str(notes.get(key) or "") for key in WEIGHTS}
        db_completeness = maybe_score(stats.get("avg_data_completeness"))
        if db_completeness is not None:  # anchor the LLM with the DB's own figure
            llm_completeness = maybe_score(scores.get("data_completeness"))
            breakdown["data_completeness"] = db_completeness if llm_completeness is None else round((llm_completeness + db_completeness) / 2)
            notes["data_completeness"] += f" (database data_completeness = {db_completeness}, blended 50/50 with the model's reading)"
        total = round(sum(breakdown[key] * weight for key, weight in WEIGHTS.items()))
        if stats.get("avg_evidence_quality") is not None:
            quality, quality_source = to_score(stats["avg_evidence_quality"]), "database (investigation_materials.evidence_quality)"
        else:
            quality, quality_source = to_score(item.get("evidence_quality_estimate")), "LLM estimate from the supplied sources"
        sources = [s for s in as_list(item.get("source_files")) if source_supported(str(s), allowed)] or read_files
        ranked.append({
            "article": {
                "id": cand["id"], "title": clean_title(cand.get("title", "")), "url": cand.get("url"),
                "date": str(item.get("date") or NOT_STATED),
                "objective": item.get("objective") or cand.get("objectives"),
                "method": item.get("method") or cand.get("approach"),
                "project": item.get("project") or cand.get("project"),
                "source_files": sources,
                "materials": [str(m) if not isinstance(m, dict) else str(m.get("name", "")) for m in as_list(item.get("materials"))],
                "parameters": clean_parameters(item.get("parameters"), allowed),
                "parameter_chart": as_list(item.get("parameter_chart")),
                "key_findings": [str(x) for x in as_list(item.get("key_findings"))],
                "limitations": [str(x) for x in as_list(item.get("limitations"))],
                "recommendation": str(item.get("recommendation") or ""),
                "evidence_quality": evidence_label(quality),  # string kept for the existing UI
                "evidence_quality_score": quality, "evidence_quality_source": quality_source,
                "evidence_note": str(item.get("evidence_note") or ""),
                "topics": [t.get("name") for t in as_list(cand.get("topics"))],
            },
            "breakdown": breakdown, "score_notes": notes, "total_score": total,
            "rationale": str(item.get("rationale") or ""),
        })
    ranked.sort(key=lambda row: row["total_score"], reverse=True)
    return {"ranked": ranked[: route["top_k"]]}


def answer_question(messages: list[dict], query: str) -> tuple[str, list[str], list[dict], dict]:
    route = route_query(query, messages)
    candidates = fetch_cohort(route, route["top_k"] + 2)
    catalog_topics = {t["id"]: t["name"] for t in load_catalog()["topics"]}
    routing_public = {**route, "topic_names": [catalog_topics.get(t, t) for t in route["topics"]]}
    if not candidates:
        text = "No PSI investigation in the selected research groups matches this question."
        return text, [], [], {"answer_summary": text, "why_relevant": "", "routing": routing_public,
                                "weights": WEIGHTS, "ranked": []}
    docs = gather_documents(candidates, route["keywords"])
    system = RANK_PROMPT.format(
        language=ANSWER_LANGUAGE, not_stated=NOT_STATED, top_k=route["top_k"],
        routing=json.dumps({k: route[k] for k in ("topics", "materials", "keywords", "breadth", "reason")}, ensure_ascii=False),
        parameters=json.dumps(route["parameters"], ensure_ascii=False),
        candidates="\n\n".join(format_candidate(c, docs.get(c["id"], [])) for c in candidates),
    )
    raw = call_llm([{"role": "system", "content": system}, *messages[-6:]], temperature=0.2)
    payload = parse_json_object(raw)
    files = [path for items in docs.values() for path, _ in items]
    if payload is None:  # model ignored the JSON contract: show its text, no ranking
        return raw, files, candidates, {"answer_summary": raw, "why_relevant": "", "routing": routing_public,
                                        "weights": WEIGHTS, "ranked": []}
    result = finalize(payload, candidates, docs, route)
    summary, why = str(payload.get("answer_summary") or ""), str(payload.get("why_relevant") or "")
    ranking = {"answer_summary": summary, "why_relevant": why, "routing": routing_public,
               "weights": WEIGHTS, **result}
    return "\n\n".join(part for part in (summary, why) if part), files, candidates, ranking


# ---------------------------------------------------------------------------
# HTTP layer (same endpoints and response keys as before)
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    def send_json(self, payload: dict, status: int = 200) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.end_headers()
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            return  # client timed out while the long research request was running

    def do_OPTIONS(self) -> None:
        self.send_json({"ok": True})

    def do_GET(self) -> None:
        if self.path in {"/api/health", "/health"}:
            self.send_json({"ok": True, "model": os.getenv("VIALERA_MODEL", MODEL)})
        elif self.path == "/api/atlas-data":
            try:
                self.send_json(atlas_data())
            except RuntimeError as error:
                self.send_json({"error": str(error)}, 503)
        elif self.path == "/api/chats":
            self.send_json({"chats": load_chats_db()})
        else:
            self.send_json({"error": "Not found"}, 404)

    def do_POST(self) -> None:
        if self.path == "/api/chats":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                chat = json.loads(self.rfile.read(length).decode("utf-8"))
                if not isinstance(chat, dict) or not chat.get("id"):
                    self.send_json({"error": "Chat id is required"}, 400)
                    return
                save_chat_db(chat)
                self.send_json({"ok": True})
            except (ValueError, json.JSONDecodeError) as error:
                self.send_json({"error": f"Invalid chat: {error}"}, 400)
            return
        if self.path != "/api/chat":
            self.send_json({"error": "Not found"}, 404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            messages = [
                {"role": "assistant" if item.get("role") == "bot" else item.get("role"), "content": item.get("content", "")}
                for item in body.get("messages", [])
                if item.get("role") in {"user", "assistant", "bot"}
            ]
            query = next((item["content"] for item in reversed(messages) if item["role"] == "user"), "")
            content, files, candidates, article_ranking = answer_question(messages, query)
            self.send_json({"content": content, "files": files, "articles": candidates, "article_ranking": article_ranking})
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"error": f"Yanlış sorğu: {error}"}, 400)
        except Exception as error:
            self.send_json({"error": str(error)}, 500)

    def log_message(self, format: str, *args: object) -> None:
        print(f"[backend] {format % args}")


if __name__ == "__main__":
    load_local_env()
    server = ThreadingHTTPServer(("0.0.0.0", 8000), Handler)
    print("Lunatika Python backend: http://127.0.0.1:8000")
    server.serve_forever()
