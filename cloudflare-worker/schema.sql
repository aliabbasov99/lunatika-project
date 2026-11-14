-- Lunatika PSI D1 schema (SQLite)
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS investigations (
  id TEXT PRIMARY KEY,
  url TEXT,
  title TEXT,
  objectives TEXT,
  project TEXT,
  approach TEXT,
  hypothesis TEXT,
  research_impacts TEXT,
  contacts TEXT,
  raw_json TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS investigation_files (
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  type TEXT,
  size TEXT,
  depth INTEGER,
  PRIMARY KEY (investigation_id, path)
);
CREATE INDEX IF NOT EXISTS idx_inv_files_inv ON investigation_files(investigation_id);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  category TEXT NOT NULL,
  phase TEXT,
  chemical_formula TEXT,
  aliases TEXT DEFAULT '[]',
  spacecraft_relevance TEXT,
  fire_safety_notes TEXT,
  is_fuel INTEGER NOT NULL DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS investigation_materials (
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  confidence TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  evidence_quality INTEGER DEFAULT 0,
  data_completeness INTEGER DEFAULT 0,
  evidence_files TEXT DEFAULT '[]',
  evidence_quote TEXT,
  notes TEXT,
  created_at TEXT,
  PRIMARY KEY (investigation_id, material_id)
);
CREATE INDEX IF NOT EXISTS idx_im_material ON investigation_materials(material_id);
CREATE INDEX IF NOT EXISTS idx_im_role ON investigation_materials(role);

CREATE TABLE IF NOT EXISTS investigation_topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  keywords TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS investigation_topic_links (
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES investigation_topics(id) ON DELETE CASCADE,
  relevance TEXT NOT NULL DEFAULT 'primary',
  PRIMARY KEY (investigation_id, topic_id)
);

CREATE VIEW IF NOT EXISTS v_investigation_material_summary AS
SELECT i.id AS investigation_id, i.title,
       group_concat(m.canonical_name, ', ') AS materials
FROM investigations i
LEFT JOIN investigation_materials im ON im.investigation_id = i.id
LEFT JOIN materials m ON m.id = im.material_id
GROUP BY i.id, i.title;
