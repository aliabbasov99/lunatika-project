
-- Convenience views for the AI / dashboard layer.
BEGIN;

CREATE OR REPLACE VIEW v_investigation_material_summary AS
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

CREATE OR REPLACE VIEW v_material_investigations AS
SELECT
    m.id AS material_id,
    m.canonical_name,
    m.category,
    m.phase,
    m.is_fuel,
    count(im.investigation_id) AS investigation_count,
    jsonb_agg(
        jsonb_build_object(
            'investigation_id', im.investigation_id,
            'title', i.title,
            'role', im.role,
            'is_primary', im.is_primary,
            'confidence', im.confidence,
            'evidence_quality', im.evidence_quality
        ) ORDER BY im.is_primary DESC, im.evidence_quality DESC
    ) FILTER (WHERE im.investigation_id IS NOT NULL) AS investigations
FROM materials m
LEFT JOIN investigation_materials im ON im.material_id = m.id
LEFT JOIN investigations i ON i.id = im.investigation_id
GROUP BY m.id, m.canonical_name, m.category, m.phase, m.is_fuel;

CREATE OR REPLACE VIEW v_topic_investigations AS
SELECT
    t.id AS topic_id,
    t.name,
    t.description,
    t.keywords,
    jsonb_agg(
        jsonb_build_object('investigation_id', i.id, 'title', i.title)
        ORDER BY i.id
    ) FILTER (WHERE i.id IS NOT NULL) AS investigations
FROM investigation_topics t
LEFT JOIN investigation_topic_links l ON l.topic_id = t.id
LEFT JOIN investigations i ON i.id = l.investigation_id
GROUP BY t.id, t.name, t.description, t.keywords;

COMMIT;
