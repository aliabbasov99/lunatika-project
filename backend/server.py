"""Lunatika chat backend.

Run from the project root with: python backend/server.py
The API key stays on the server and is never sent to the browser.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
API_URL = "https://api.vialera.online/v1/chat/completions"
MODEL = os.getenv("VIALERA_MODEL", "gpt-6-luna")
TEXT_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css", ".html", ".py", ".sql", ".txt"
}
IGNORED_DIRECTORIES = {"node_modules", ".git", "dist", ".cache", "tmp", ".venv", "venv"}
SEARCH_STOP_WORDS = {
    "the", "and", "for", "with", "from", "that", "this", "about", "what", "which", "how",
    "flame", "spread", "fire", "safety", "experiment", "experiments", "material", "materials",
    "microgravity", "spacecraft", "polimer", "polymer", "yanğın", "yangin", "haqqinda", "isteyirem",
}
SCHEMA_FILES = [
    ROOT / "cloudflare-worker" / "schema.sql",
    ROOT / "scripts" / "IDENTIFY-RELEVANT-INVESTIGATIONS_2" / "sql" / "01_schema_materials.sql",
]
PSI_TEXT_ROOT = ROOT / "scripts" / "PSI-TEXT-FILES_1_1"

DOMAIN_GROUPS = {
    "solid_fuel_flame_spread": {
        "label": "solid fuel flame spread",
        "terms": {"solid", "polymer", "pmma", "sib al", "sibal", "nomex", "flame", "spread", "surface", "rib", "thickness"},
        "experiments": {"bass", "bass-ii", "sofie", "saffire"},
    },
    "forced_flow_extinction": {
        "label": "forced flow, quenching and blowoff extinction",
        "terms": {"airflow", "flow", "velocity", "forced", "quench", "blowoff", "extinction", "opposed", "concurrent"},
        "experiments": {"bass", "bass-ii", "sofie"},
    },
    "oxygen_pressure_radiation": {
        "label": "oxygen limits, pressure and radiative loss",
        "terms": {"oxygen", "o2", "pressure", "radiative", "radiation", "heat", "stoichiometry", "co2", "co"},
        "experiments": {"bass", "bass-ii", "sofie", "saffire"},
    },
    "droplet_liquid_combustion": {
        "label": "liquid droplet and liquid fuel combustion",
        "terms": {"droplet", "liquid", "fuel", "methanol", "heptane", "diesel", "evaporation"},
        "experiments": {"flex", "saffire"},
    },
    "electric_field": {
        "label": "electric field and electrohydrodynamic effects",
        "terms": {"electric", "field", "electro", "voltage", "charge", "e-field"},
        "experiments": {"bass", "sofie"},
    },
    "spacecraft_fire_safety": {
        "label": "spacecraft fire safety and material flammability",
        "terms": {"fire", "safety", "flammability", "spacecraft", "habitat", "iss", "microgravity", "ignition"},
        "experiments": {"bass", "bass-ii", "sofie", "flex", "saffire"},
    },
}


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


def project_files() -> list[Path]:
    files: list[Path] = []
    for directory, directories, names in os.walk(ROOT):
        directories[:] = [name for name in directories if name not in IGNORED_DIRECTORIES and not name.startswith(".")]
        for name in names:
            path = Path(directory) / name
            if path.suffix.lower() in TEXT_EXTENSIONS:
                files.append(path)
    return files


def project_tree() -> str:
    """Return a compact, bounded file tree for file-path aware answers."""
    lines: list[str] = []
    for directory, directories, names in os.walk(ROOT):
        directories[:] = [name for name in directories if name not in IGNORED_DIRECTORIES and not name.startswith(".")]
        directories.sort()
        names.sort()
        relative_dir = Path(directory).relative_to(ROOT)
        depth = len(relative_dir.parts)
        if depth > 5:
            directories[:] = []
            continue
        for name in names:
            path = Path(directory) / name
            if path.suffix.lower() in TEXT_EXTENSIONS or path.name in {"README.md", "schema.sql"}:
                lines.append(f"{'  ' * depth}- {path.relative_to(ROOT)}")
                if len(lines) >= 500:
                    return "\n".join(lines) + "\n- ... tree truncated ..."
    return "\n".join(lines)


def database_schema() -> str:
    chunks = []
    for schema_file in SCHEMA_FILES:
        if schema_file.exists():
            try:
                chunks.append(f"SOURCE: {schema_file.relative_to(ROOT)}\n{schema_file.read_text(encoding='utf-8', errors='ignore')[:24000]}")
            except OSError:
                continue
    return "\n\n".join(chunks)


def requested_investigation_ids(query: str) -> list[str]:
    return sorted({match.replace(" ", "-") for match in re.findall(r"\bPSI[- ]?\d{1,3}\b", query.upper())})


def path_belongs_to_investigation(path: Path, investigation_id: str) -> bool:
    """Match PSI-10 as a path token, never as a substring of PSI-100 or PSI-102."""
    token = investigation_id.upper().replace(" ", "-")
    return any(part.upper().replace(" ", "-") == token for part in path.relative_to(PSI_TEXT_ROOT).parts)


def read_psi_file(path: Path, limit: int = 12000) -> str:
    suffix = path.suffix.lower()
    try:
        if suffix == ".pdf":
            completed = subprocess.run(
                ["pdftotext", "-layout", str(path), "-"],
                capture_output=True,
                text=True,
                timeout=15,
                check=False,
            )
            if completed.returncode != 0:
                return ""
            return completed.stdout[:limit]
        if suffix in {".json", ".csv", ".txt", ".md"}:
            return path.read_text(encoding="utf-8", errors="ignore")[:limit]
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return ""


def local_psi_text_context(query: str) -> tuple[list[str], str]:
    """Read the requested PSI investigation material when the text corpus is mounted locally."""
    ids = requested_investigation_ids(query)
    if not PSI_TEXT_ROOT.exists():
        return ids, "PSI-TEXT-FILES_1_1 qovluğu lokal checkout-da tapılmadı."
    candidates: list[Path] = []
    for investigation_id in ids:
        for path in PSI_TEXT_ROOT.rglob("*"):
            if path.is_file() and path_belongs_to_investigation(path, investigation_id):
                candidates.append(path)
    if not ids:
        return ids, "Sualda konkret PSI ID göstərilməyib."
    if not candidates:
        return ids, "İstənilən PSI ID üçün PSI-TEXT-FILES_1_1 daxilində uyğun fayl tapılmadı."
    chunks = []
    total_chars = 0
    priority = {"investigation.json": 0, ".csv": 1, ".txt": 2, ".md": 3, ".pdf": 4}
    candidates.sort(key=lambda path: (priority.get(path.name, priority.get(path.suffix.lower(), 5)), str(path)))
    for path in candidates[:16]:
        content = read_psi_file(path)
        if not content:
            continue
        if total_chars + len(content) > 70000:
            break
        chunks.append(f"FILE: {path.relative_to(ROOT)}\n{content}")
        total_chars += len(content)
    return ids, "\n\n".join(chunks)


def query_local_postgres(query: str, groups: list[str]) -> str:
    """Read the curated investigation metadata and routing layer from PostgreSQL."""
    search = query.replace("'", "''")
    search_terms = [
        term for term in re.split(r"[^a-zA-Z0-9_/-]+", query.lower())
        if len(term) > 2 and term not in SEARCH_STOP_WORDS
    ]
    term_literals = [term.replace("'", "''") for term in search_terms[:24] if not term.startswith("psi-")]
    title_score = " + ".join(f"CASE WHEN i.title ILIKE '%{term}%' THEN 100 ELSE 0 END" for term in term_literals) or "0"
    objectives_score = " + ".join(f"CASE WHEN i.objectives ILIKE '%{term}%' THEN 30 ELSE 0 END" for term in term_literals) or "0"
    approach_score = " + ".join(f"CASE WHEN i.approach ILIKE '%{term}%' THEN 20 ELSE 0 END" for term in term_literals) or "0"
    term_match = " OR ".join(
        f"i.title ILIKE '%{term}%' OR i.objectives ILIKE '%{term}%' OR i.approach ILIKE '%{term}%' OR i.project ILIKE '%{term}%'"
        for term in term_literals
    ) or "FALSE"
    keyword_match = " OR ".join(
        f"keyword ILIKE '%{term}%' OR '{term}' ILIKE '%' || keyword || '%'"
        for term in term_literals
    ) or "FALSE"
    material_name_match = " OR ".join(
        f"filtered_m.canonical_name ILIKE '%{term}%'"
        for term in term_literals
    ) or "FALSE"
    material_alias_match = " OR ".join(
        f"alias_name ILIKE '%{term}%' OR '{term}' ILIKE '%' || alias_name || '%'"
        for term in term_literals
    ) or "FALSE"
    requested_ids = requested_investigation_ids(query)
    requested_id_match = " OR ".join(
        f"i.id = '{investigation_id.replace(chr(39), chr(39) + chr(39))}'" for investigation_id in requested_ids
    ) or "FALSE"
    group_names = [DOMAIN_GROUPS[group]["label"].replace("'", "''") for group in groups]
    group_filter = " OR ".join(f"t.name ILIKE '%{name}%' OR t.description ILIKE '%{name}%'" for name in group_names)
    if not group_filter:
        group_filter = "TRUE"
    sql = f"""
        SELECT jsonb_agg(to_jsonb(result) ORDER BY result.match_score DESC, result.id) FROM (
        SELECT
          i.id,
          i.title,
          i.url,
          i.objectives,
          i.project,
          i.approach,
          i.hypothesis,
          i.research_impacts,
          i.contacts,
          i.updated_at,
          (
            CASE WHEN {requested_id_match} THEN 1000 ELSE 0 END
            + {title_score}
            + {objectives_score}
            + {approach_score}
          ) AS match_score,
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'investigation_id', ms.investigation_id,
              'title', ms.title,
              'materials', ms.materials
            ))
            FROM v_investigation_material_summary ms
            WHERE ms.investigation_id = i.id
          ), '[]'::jsonb) AS material_evidence,
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'topic_id', t.id, 'name', t.name, 'description', t.description,
              'keywords', t.keywords, 'relevance', l.relevance
            ) ORDER BY l.relevance, t.name)
            FROM investigation_topic_links l
            JOIN investigation_topics t ON t.id = l.topic_id
            WHERE l.investigation_id = i.id
              AND ({group_filter} OR i.objectives ILIKE '%{search}%' OR i.approach ILIKE '%{search}%')
          ), '[]'::jsonb) AS topic_evidence,
          COALESCE((
            SELECT jsonb_agg(DISTINCT evidence_file)
            FROM investigation_materials im
            CROSS JOIN LATERAL jsonb_array_elements_text(im.evidence_files) evidence_file
            WHERE im.investigation_id = i.id
          ), '[]'::jsonb) AS evidence_files
        FROM investigations i
        WHERE EXISTS (
          SELECT 1
          FROM investigation_topic_links tl
          JOIN investigation_topics matched_topic ON matched_topic.id = tl.topic_id
          WHERE tl.investigation_id = i.id
            AND (
              matched_topic.name ILIKE '%{search}%'
              OR matched_topic.description ILIKE '%{search}%'
              OR EXISTS (
                SELECT 1 FROM unnest(matched_topic.keywords) keyword
                WHERE {keyword_match}
              )
            )
        )
        OR EXISTS (
          SELECT 1
          FROM investigation_materials filtered_im
          JOIN materials filtered_m ON filtered_m.id = filtered_im.material_id
          WHERE filtered_im.investigation_id = i.id
            AND (
              {material_name_match}
              OR EXISTS (
                SELECT 1 FROM unnest(filtered_m.aliases) alias_name
                WHERE {material_alias_match}
              )
            )
        )
        OR {term_match}
        OR {requested_id_match}
        ORDER BY match_score DESC, i.id
        LIMIT 20
      ) result;
    """
    env = os.environ.copy()
    env.setdefault("PGHOST", "127.0.0.1")
    env.setdefault("PGPORT", "5432")
    env.setdefault("PGUSER", "postgres")
    env.setdefault("PGDATABASE", "lunatika")
    # Prefer a configured password; local development falls back to the project DB setup.
    env.setdefault("PGPASSWORD", "123")
    try:
        completed = subprocess.run(
            ["psql", "-X", "-q", "-t", "-A", "-c", sql],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return f"PostgreSQL query unavailable: {error}"
    if completed.returncode != 0:
        return f"PostgreSQL query failed: {completed.stderr.strip()}"
    output = completed.stdout.strip()
    if not output:
        return "PostgreSQL returned no investigation rows."
    try:
        rows = json.loads(output)
        return json.dumps(rows, ensure_ascii=False, indent=2)[:90000]
    except json.JSONDecodeError:
        return output[:90000]


def classify_query(query: str) -> list[str]:
    normalized = query.lower().replace("ı", "i").replace("ə", "e")
    terms = set(term for term in re.split(r"[^a-z0-9_/-]+", normalized) if len(term) > 2)
    selected = []
    for group, definition in DOMAIN_GROUPS.items():
        if terms.intersection(definition["terms"]):
            selected.append(group)
    return selected or ["spacecraft_fire_safety"]


def relevant_files(query: str) -> tuple[list[str], list[Path]]:
    groups = classify_query(query)
    normalized = query.lower().replace("ı", "i").replace("ə", "e")
    terms = [term for term in re.split(r"[^a-z0-9_/-]+", normalized) if len(term) > 2]
    group_terms = set().union(*(DOMAIN_GROUPS[group]["terms"] for group in groups))
    if not terms:
        return groups, []
    matches: list[tuple[int, Path]] = []
    for path in project_files():
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        relative = str(path.relative_to(ROOT)).lower()
        haystack = f"{relative} {content}".lower()
        score = sum(term in haystack for term in terms)
        score += sum(term in haystack for term in group_terms) * 2
        if any(experiment in relative for group in groups for experiment in DOMAIN_GROUPS[group]["experiments"]):
            score += 8
        if path.name.lower() in {"investigation.json", "investigation_materials.json", "investigation_topics.json"}:
            score += 6
        if score:
            matches.append((score, path))
    matches.sort(key=lambda item: item[0], reverse=True)
    return groups, [path for _, path in matches[:16]]


def make_context(query: str) -> tuple[list[str], list[Path], str, str, str]:
    groups, files = relevant_files(query) if len(query.strip()) >= 4 else (["spacecraft_fire_safety"], [])
    chunks = []
    total_chars = 0
    for path in files:
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")[:8000]
        except OSError:
            continue
        if total_chars + len(content) > 60000:
            break
        chunks.append(f"FILE: {path.relative_to(ROOT)}\n{content}")
        total_chars += len(content)
    return groups, files, "\n\n".join(chunks), database_schema(), project_tree()


def ask_vialera(messages: list[dict[str, str]], query: str) -> tuple[str, list[str]]:
    api_key = os.getenv("VIALERA_API_KEY")
    if not api_key:
        raise RuntimeError("VIALERA_API_KEY tapılmadı. .env.local faylını yoxla.")
    groups, files, context, schema, tree = make_context(query)
    requested_ids, psi_text_context = local_psi_text_context(query)
    group_labels = [DOMAIN_GROUPS[group]["label"] for group in groups]
    postgres_context = query_local_postgres(query, groups)
    system = {
        "role": "system",
        "content": (
            "Sən NASA microgravity combustion və spacecraft fire-safety üzrə elmi köməkçisən. "
            "Cavabı yalnız aşağıdakı lokal NASA materiallarına əsasən hazırla. Məlumat faylda yoxdursa "
            "null və ya 'not_reported' yaz; rəqəm və alim adlarını uydurma.\n\n"
            f"İstifadəçi intent qrupları: {json.dumps(group_labels, ensure_ascii=False)}\n"
            "Bu qruplar üzrə seçilən namizədləri əvvəlcə müqayisə et. BASS, BASS-II, SoFIE, FLEX, "
            "Saffire və digər layihələri yalnız materialda həqiqətən keçirsə istifadə et.\n\n"
            "PostgreSQL metadata aşağıdakı LOCAL DATABASE RESULTS bölməsində əsas mənbədir. Abstract üçün "
            "investigations.objectives, approach, hypothesis, research_impacts, project və contacts sahələrini "
            "istifadə et. Material, topic, evidence_quality, data_completeness, evidence_quote və evidence_files "
            "sahələrini də nəzərə al. DB nəticəsində olmayan məlumatı lokal fayllardan təsdiqləmədən əlavə etmə.\n\n"
            "Hər investigation üçün 0-100 arası bu çəkili qiymətləri hesabla: relevance_to_query 40%, "
            "experimental_condition_similarity 25%, safety_significance 20%, data_completeness 15%. "
            "total_score çəkili cəm olmalıdır. Evidence quality ayrıca 0-100 və mənbə faylları ilə izah edilməlidir.\n\n"
            "Cavabı insan üçün oxunaqlı Markdown formatında qaytar; JSON və JSON code block qaytarma. "
            "Başlıqlar, qısa cədvəllər və bullet list istifadə et. Abstract sahəsini lokal metadata-dakı "
            "abstract, summary, objectives, approach, hypothesis və research_impacts məlumatından yığcam "
            "elmi xülasə kimi çıxar; bu sahələr yoxdursa 'not_reported' yaz. Hər abstract üçün abstract_source "
            "mənbə faylını göstər. Abstract-a yeni fakt əlavə etmə. Konkret PSI ID verilirsə həmin investigation-ı "
            "mütləq ayrıca göstər, PostgreSQL metadata və PSI-TEXT-FILES_1_1 mənbələrini müqayisə et. "
            "Cavabda Intent analysis, Top ranked investigations, Detailed experiment summary, AI recommendation, "
            "Future fire-safety insights və Limitations bölmələrini saxla. Score breakdown üçün 40/25/20/15 "
            "çəkilərini və evidence quality-ni cədvəldə göstər. Məlumat yoxdursa not reported yaz.\n\n"
            + (f"LOCAL SOURCE FILES:\n\n{context}" if context else "Uyğun lokal mənbə faylı tapılmadı.")
            + "\n\nREQUESTED PSI IDs: " + (", ".join(requested_ids) if requested_ids else "none")
            + "\n\nPSI-TEXT-FILES_1_1 REQUESTED MATERIALS:\n"
            + psi_text_context
            + "\n\nLOCAL DATABASE RESULTS (PostgreSQL; queried read-only):\n"
            + postgres_context
            + "\n\nDATABASE SCHEMA (PostgreSQL source schema; do not invent columns):\n"
            + (schema or "Schema faylı tapılmadı.")
            + "\n\nPROJECT FILE TREE (use these exact relative paths when citing files):\n"
            + (tree or "Fayl ağacı tapılmadı.")
            + "\n\nSQL RULES: Use PostgreSQL syntax for queries against the local database. Only propose read-only SELECT/WITH queries. "
            "Join investigations.id = investigation_files.investigation_id and investigation_materials.investigation_id; "
            "join investigation_materials.material_id = materials.id; join investigation_topic_links.topic_id = investigation_topics.id. "
            "Do not claim a query was executed unless an execution result is explicitly provided."
        ),
    }
    payload = json.dumps({
        "model": os.getenv("VIALERA_MODEL", MODEL),
        "messages": [system, *messages],
        "temperature": 0.4,
    }).encode("utf-8")
    request = Request(API_URL, data=payload, method="POST", headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Lunatika/1.0",
    })
    try:
        with urlopen(request, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Vialera API xətası ({error.code}): {detail}") from error
    except URLError as error:
        raise RuntimeError(f"Vialera API-yə qoşulmaq olmadı: {error.reason}") from error
    content = result.get("choices", [{}])[0].get("message", {}).get("content")
    if not content:
        raise RuntimeError("Vialera API boş cavab qaytardı.")
    return content, [str(path.relative_to(ROOT)) for path in files]


class Handler(BaseHTTPRequestHandler):
    def send_json(self, payload: dict, status: int = 200) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:
        self.send_json({"ok": True})

    def do_GET(self) -> None:
        if self.path == "/api/health":
            self.send_json({"ok": True, "model": os.getenv("VIALERA_MODEL", MODEL)})
        else:
            self.send_json({"error": "Not found"}, 404)

    def do_POST(self) -> None:
        if self.path != "/api/chat":
            self.send_json({"error": "Not found"}, 404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            incoming = body.get("messages", [])
            messages = [
                {"role": "assistant" if item.get("role") == "bot" else item.get("role"), "content": item.get("content", "")}
                for item in incoming
                if item.get("role") in {"user", "assistant", "bot"}
            ]
            query = next((item["content"] for item in reversed(messages) if item["role"] == "user"), "")
            content, files = ask_vialera(messages, query)
            self.send_json({"content": content, "files": files})
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
