-- Idempotent import for the extended lunatika_skeleton dataset.
-- Run from the repository root with: PGPASSWORD=123 psql -h 127.0.0.1 -U postgres -d lunatika -f scripts/import_skeleton_postgres.sql

BEGIN;

CREATE TABLE IF NOT EXISTS skeleton_investigations (
  investigation_id text PRIMARY KEY,
  acronym text, title text, sub_area text, tier text, categories text,
  fuel_state text, hardware text, platform text, gravity text, challenge_note text,
  objective text, hypothesis text, approach text, research_impacts text,
  start_date text, end_date text, doi text, license text, psi_url text,
  total_gb_in_psi text, downloaded_gb text, downloaded_files text, related text
);

CREATE TABLE IF NOT EXISTS skeleton_tests (
  test_id text PRIMARY KEY,
  investigation_id text NOT NULL,
  source_table text, source_line text, row_kind text, label text, test_date text,
  fuel text, fuel_state text, flame_type text, thickness_mm text, length_mm text,
  width_mm text, diameter_mm text, o2_pct text, o2_pct_min text, o2_pct_max text,
  o2_note text, pressure_psi text, pressure_psi_min text, pressure_psi_max text,
  flow_cm_s text, flow_direction text, observation text, observation_source text,
  diluent text, ignited text, burn_time_s text, end_condition text,
  spread_rate_mm_s text, spread_rate_1g_mm_s text, burn_length_mm text,
  burn_length_1g text, outcome text, material text, relevant_habitats text,
  habitats_o2_only text, condition_tags text, qc_flags text, raw text
);

CREATE TABLE IF NOT EXISTS skeleton_documents (
  document_id text PRIMARY KEY,
  investigation_id text NOT NULL,
  title text, authors text, year text, doi text, doc_type text, source text,
  status text, ntrs_id text, file_path text, file_mb text, extracted text
);

CREATE TABLE IF NOT EXISTS skeleton_findings (
  finding_id text PRIMARY KEY,
  document_id text, investigation_id text NOT NULL, finding_type text, kind text,
  category text, material text, fuel_state text, gravity text, o2_pct text,
  pressure_psi text, flow_cm_s text, conditions_text text, quantity text,
  value text, unit text, statement text, importance text, duplicate_of text,
  safety_implication text, implication_source text, equipment_type text,
  equipment_source text, earth_application text, earth_application_source text,
  equipment_implication text, source_page text, source_quote text, quote_score text,
  verdict text, qc_flags text, confidence text, model text, prompt_version text
);

CREATE TABLE IF NOT EXISTS skeleton_finding_tests (
  finding_id text NOT NULL,
  test_id text NOT NULL,
  PRIMARY KEY (finding_id, test_id)
);

TRUNCATE skeleton_finding_tests, skeleton_findings, skeleton_documents,
  skeleton_tests, skeleton_investigations;

\copy skeleton_investigations FROM 'artifacts/lunatika_skeleton/csv/investigations.csv' WITH (FORMAT csv, HEADER true, NULL '')
\copy skeleton_tests FROM 'artifacts/lunatika_skeleton/csv/tests.csv' WITH (FORMAT csv, HEADER true, NULL '')
\copy skeleton_documents FROM 'artifacts/lunatika_skeleton/csv/documents.csv' WITH (FORMAT csv, HEADER true, NULL '')
\copy skeleton_findings FROM 'artifacts/lunatika_skeleton/csv/findings.csv' WITH (FORMAT csv, HEADER true, NULL '')
\copy skeleton_finding_tests FROM 'artifacts/lunatika_skeleton/csv/finding_tests.csv' WITH (FORMAT csv, HEADER true, NULL '')

CREATE INDEX IF NOT EXISTS skeleton_findings_investigation_idx ON skeleton_findings (investigation_id);
CREATE INDEX IF NOT EXISTS skeleton_findings_category_idx ON skeleton_findings (category);
CREATE INDEX IF NOT EXISTS skeleton_tests_investigation_idx ON skeleton_tests (investigation_id);
CREATE INDEX IF NOT EXISTS skeleton_documents_investigation_idx ON skeleton_documents (investigation_id);

COMMIT;
