
-- Material <-> PSI investigation link layer.
-- Run with: psql -U postgres -h 127.0.0.1 -d lunatika -f sql/01_schema_materials.sql
BEGIN;

DROP VIEW IF EXISTS v_investigation_material_summary, v_material_investigations, v_topic_investigations CASCADE;
DROP TABLE IF EXISTS investigation_topic_links CASCADE;
DROP TABLE IF EXISTS investigation_topics CASCADE;
DROP TABLE IF EXISTS investigation_materials CASCADE;
DROP TABLE IF EXISTS materials CASCADE;

CREATE TABLE materials (
    id                  text PRIMARY KEY,
    canonical_name      text NOT NULL,
    category            text NOT NULL,
    phase               text,
    chemical_formula    text,
    aliases             text[] NOT NULL DEFAULT '{}',
    spacecraft_relevance text,
    fire_safety_notes   text,
    is_fuel             boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE investigation_materials (
    investigation_id  text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    material_id       text NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    role              text NOT NULL CHECK (role IN (
                          'test_material', 'fuel', 'constituent', 'emulated_material',
                          'planned_not_tested', 'replaced_material', 'test_aerosol',
                          'combustion_product', 'suppressant', 'diluent', 'additive',
                          'reference_material')),
    confidence        text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    is_primary        boolean NOT NULL DEFAULT false,
    evidence_quality  integer NOT NULL DEFAULT 0 CHECK (evidence_quality BETWEEN 0 AND 100),
    data_completeness integer NOT NULL DEFAULT 0 CHECK (data_completeness BETWEEN 0 AND 100),
    evidence_files    jsonb NOT NULL DEFAULT '[]'::jsonb,
    evidence_quote    text,
    notes             text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (investigation_id, material_id)
);

CREATE INDEX idx_investigation_materials_material ON investigation_materials(material_id);
CREATE INDEX idx_investigation_materials_role ON investigation_materials(role);
CREATE INDEX idx_investigation_materials_confidence ON investigation_materials(confidence);

CREATE TABLE investigation_topics (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    description text,
    keywords    text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE investigation_topic_links (
    investigation_id text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    topic_id         text NOT NULL REFERENCES investigation_topics(id) ON DELETE CASCADE,
    relevance        text NOT NULL DEFAULT 'primary' CHECK (relevance IN ('primary', 'secondary')),
    PRIMARY KEY (investigation_id, topic_id)
);

CREATE VIEW v_investigation_material_summary AS
SELECT
    i.id AS investigation_id,
    i.title,
    coalesce(
        jsonb_agg(
            jsonb_build_object(
                'material_id', m.id,
                'material', m.canonical_name,
                'category', m.category,
                'phase', m.phase,
                'role', im.role,
                'is_primary', im.is_primary,
                'confidence', im.confidence,
                'evidence_quality', im.evidence_quality,
                'data_completeness', im.data_completeness,
                'evidence_files', im.evidence_files,
                'evidence_quote', im.evidence_quote,
                'notes', im.notes
            ) ORDER BY im.is_primary DESC, im.evidence_quality DESC, m.canonical_name
        ) FILTER (WHERE m.id IS NOT NULL),
        '[]'::jsonb
    ) AS materials
FROM investigations i
LEFT JOIN investigation_materials im ON im.investigation_id = i.id
LEFT JOIN materials m ON m.id = im.material_id
GROUP BY i.id, i.title;

COMMIT;
