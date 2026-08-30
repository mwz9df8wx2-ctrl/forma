-- Схема базы данных платформы.
-- SQL намеренно переносимый: переезд на MySQL или PostgreSQL механический.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS companies (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  logo_file_id  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  company_id     TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'estimator',
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS users_company ON users(company_id);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

-- Производственный профиль компании: толщины, зазоры, глубины по умолчанию.
CREATE TABLE IF NOT EXISTS production_profiles (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  settings    TEXT NOT NULL,
  is_default  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS profiles_company ON production_profiles(company_id);

CREATE TABLE IF NOT EXISTS projects (
  id                    TEXT PRIMARY KEY,
  company_id            TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by            TEXT NOT NULL REFERENCES users(id),
  assigned_to           TEXT REFERENCES users(id),
  title                 TEXT NOT NULL,
  category              TEXT NOT NULL DEFAULT 'kitchen',
  status                TEXT NOT NULL DEFAULT 'draft',
  client_name           TEXT,
  client_phone          TEXT,
  client_email          TEXT,
  client_address        TEXT,
  current_revision_id   TEXT,
  selected_revision_id  TEXT,
  selected_option_id    TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  archived_at           TEXT
);
CREATE INDEX IF NOT EXISTS projects_company ON projects(company_id, updated_at DESC);

-- Ревизия — неизменяемый снимок спецификации.
-- После согласования правки запрещены: создаётся новая ревизия.
CREATE TABLE IF NOT EXISTS project_revisions (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revision_number     INTEGER NOT NULL,
  parent_revision_id  TEXT REFERENCES project_revisions(id),
  created_by          TEXT NOT NULL REFERENCES users(id),
  source              TEXT NOT NULL DEFAULT 'manual',
  spec_snapshot       TEXT NOT NULL,
  locked              INTEGER NOT NULL DEFAULT 0,
  approval_status     TEXT NOT NULL DEFAULT 'draft',
  created_at          TEXT NOT NULL,
  UNIQUE (project_id, revision_number)
);
CREATE INDEX IF NOT EXISTS revisions_project ON project_revisions(project_id, revision_number DESC);

CREATE TABLE IF NOT EXISTS project_files (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL,
  object_key  TEXT NOT NULL,
  mime        TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  width       INTEGER,
  height      INTEGER,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS files_project ON project_files(project_id);

CREATE TABLE IF NOT EXISTS project_approvals (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revision_id  TEXT NOT NULL REFERENCES project_revisions(id),
  option_id    TEXT,
  approved_by  TEXT NOT NULL REFERENCES users(id),
  client_name  TEXT,
  note         TEXT,
  approved_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS approvals_project ON project_approvals(project_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL,
  user_id     TEXT,
  project_id  TEXT,
  action      TEXT NOT NULL,
  details     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_company ON audit_log(company_id, created_at DESC);
