-- quasiAthlete v1 Postgres schema (additive-only migration)
-- Matches src/db/schema.ts (Drizzle ORM) 1:1.

CREATE TABLE IF NOT EXISTS athletes (
  id TEXT PRIMARY KEY,
  owner_sub TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT 'Athlete',
  main_sport TEXT NOT NULL,
  track_branch TEXT NOT NULL,
  gym_modality TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'baseline',
  baseline_start_date TEXT NOT NULL,
  baseline_weeks_completed INTEGER NOT NULL DEFAULT 0,
  weekly_hard_budget_cap INTEGER,
  injury_history_regions JSONB NOT NULL DEFAULT '[]'::jsonb,
  upcoming_competitions JSONB NOT NULL DEFAULT '[]'::jsonb,
  consent_settings JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_logs (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  owner_sub TEXT NOT NULL,
  date TEXT NOT NULL,
  sport TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  intensity_tag TEXT NOT NULL,
  is_key_session BOOLEAN NOT NULL DEFAULT FALSE,
  session_rpe REAL,
  session_load REAL,
  rpe_higher_than_expected BOOLEAN NOT NULL DEFAULT FALSE,
  sleep_hours REAL,
  sleep_quality INTEGER,
  perceived_fatigue REAL,
  avg_hr_bpm INTEGER,
  hr_zone_minutes JSONB,
  symptoms JSONB NOT NULL DEFAULT '[]'::jsonb,
  sport_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_logs_athlete_date
  ON session_logs (athlete_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_session_logs_owner
  ON session_logs (owner_sub);

CREATE TABLE IF NOT EXISTS benchmarks (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  owner_sub TEXT NOT NULL,
  sport TEXT NOT NULL,
  metric_label TEXT NOT NULL,
  value_text TEXT NOT NULL,
  recorded_date TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_athlete_date
  ON benchmarks (athlete_id, recorded_date DESC);

CREATE TABLE IF NOT EXISTS consent_audit_logs (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  owner_sub TEXT NOT NULL,
  tier TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  consent_version TEXT NOT NULL,
  purpose_version TEXT NOT NULL,
  oauth_provider TEXT,
  oauth_scopes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_audit_athlete
  ON consent_audit_logs (athlete_id, created_at DESC);
