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

-- Каталог компании: фасады, столешницы, корпуса, фурнитура, техника, свет.
-- Атрибуты хранятся как JSON: набор полей зависит от типа записи и
-- проверяется схемой в общем пакете.
CREATE TABLE IF NOT EXISTS catalog_items (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  sku             TEXT NOT NULL DEFAULT '',
  name            TEXT NOT NULL,
  attributes      TEXT NOT NULL,
  -- Цены целыми копейками. REAL в деньгах теряет копейки на округлении,
  -- а смета из тысячи позиций расходится с накладной.
  price_unit               TEXT NOT NULL DEFAULT 'piece',
  purchase_price_kopecks   INTEGER,
  sale_price_kopecks       INTEGER,
  active          INTEGER NOT NULL DEFAULT 1,
  demo            INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS catalog_company_type ON catalog_items(company_id, type, active);

-- Тарифы и подписки.
-- Деньги хранятся в копейках целыми числами: с плавающей точкой в деньгах
-- рано или поздно теряются копейки.
CREATE TABLE IF NOT EXISTS plans (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  monthly_price    INTEGER NOT NULL,
  included_credits INTEGER NOT NULL,
  max_users        INTEGER NOT NULL DEFAULT 5,
  features         TEXT NOT NULL DEFAULT '{}',
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id       TEXT NOT NULL REFERENCES plans(id),
  status        TEXT NOT NULL DEFAULT 'active',
  period_start  TEXT NOT NULL,
  period_end    TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS subscriptions_company ON subscriptions(company_id, status);

-- Кошелёк кредитов компании. Баланс не редактируется напрямую:
-- любое изменение проходит через журнал операций.
CREATE TABLE IF NOT EXISTS credit_wallets (
  company_id  TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  balance     INTEGER NOT NULL DEFAULT 0,
  reserved    INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL
);

-- Журнал операций с кредитами: нужен для поддержки, споров и возвратов.
CREATE TABLE IF NOT EXISTS usage_transactions (
  id                      TEXT PRIMARY KEY,
  company_id              TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id                 TEXT REFERENCES users(id),
  project_id              TEXT REFERENCES projects(id) ON DELETE SET NULL,
  job_id                  TEXT,
  type                    TEXT NOT NULL,
  credit_delta            INTEGER NOT NULL,
  balance_before          INTEGER NOT NULL,
  balance_after           INTEGER NOT NULL,
  estimated_cost_kopecks  INTEGER NOT NULL DEFAULT 0,
  actual_cost_kopecks     INTEGER,
  provider                TEXT,
  model                   TEXT,
  status                  TEXT NOT NULL DEFAULT 'completed',
  created_at              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS usage_company ON usage_transactions(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_job ON usage_transactions(job_id);

-- Задание на генерацию. Долгая операция не живёт в одном HTTP-запросе.
CREATE TABLE IF NOT EXISTS generation_jobs (
  id                TEXT PRIMARY KEY,
  company_id        TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revision_id       TEXT NOT NULL REFERENCES project_revisions(id),
  created_by        TEXT NOT NULL REFERENCES users(id),
  status            TEXT NOT NULL DEFAULT 'queued',
  stage             TEXT,
  variants          INTEGER NOT NULL DEFAULT 3,
  quality           TEXT NOT NULL DEFAULT 'preview',
  size              TEXT NOT NULL DEFAULT '1536x1024',
  seed              INTEGER NOT NULL DEFAULT 0,
  notes             TEXT NOT NULL DEFAULT '',
  reference_file_id TEXT REFERENCES project_files(id) ON DELETE SET NULL,
  provider          TEXT NOT NULL,
  model             TEXT,
  credits_reserved  INTEGER NOT NULL DEFAULT 0,
  estimated_cost_kopecks INTEGER NOT NULL DEFAULT 0,
  actual_cost_kopecks    INTEGER,
  attempts          INTEGER NOT NULL DEFAULT 0,
  error_code        TEXT,
  error_message     TEXT,
  idempotency_key   TEXT,
  created_at        TEXT NOT NULL,
  started_at        TEXT,
  finished_at       TEXT
);
CREATE INDEX IF NOT EXISTS jobs_company ON generation_jobs(company_id, status);
CREATE INDEX IF NOT EXISTS jobs_queue ON generation_jobs(status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_idempotency
  ON generation_jobs(company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS visualization_options (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revision_id   TEXT NOT NULL REFERENCES project_revisions(id),
  job_id        TEXT NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  option_index  INTEGER NOT NULL,
  file_id       TEXT REFERENCES project_files(id) ON DELETE SET NULL,
  provider      TEXT NOT NULL,
  model         TEXT,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  params        TEXT NOT NULL DEFAULT '{}',
  selected      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS options_project ON visualization_options(project_id, created_at DESC);

-- Настройки платформы: стоимость операций в кредитах и жёсткие лимиты.
-- Меняются администратором без пересборки приложения.
CREATE TABLE IF NOT EXISTS platform_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Диалог уточнения замеров. Хранится, чтобы было видно, откуда взялось
-- значение: кто написал, что распознал разбор и что подтвердил человек.
CREATE TABLE IF NOT EXISTS project_messages (
  id           TEXT PRIMARY KEY,
  company_id   TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      TEXT REFERENCES users(id),
  role         TEXT NOT NULL,
  text         TEXT NOT NULL,
  suggestions  TEXT NOT NULL DEFAULT '[]',
  source       TEXT NOT NULL DEFAULT 'rules',
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_project ON project_messages(project_id, created_at);

-- Смета с зафиксированными ценами.
-- Цены меняются, а согласованная с клиентом смета — нет: снимок хранится
-- целиком, чтобы через полгода было видно, из чего сложилась сумма.
CREATE TABLE IF NOT EXISTS estimates (
  id             TEXT PRIMARY KEY,
  company_id     TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revision_id    TEXT NOT NULL REFERENCES project_revisions(id),
  created_by     TEXT NOT NULL REFERENCES users(id),
  lines          TEXT NOT NULL,
  totals         TEXT NOT NULL,
  markup_percent INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS estimates_project ON estimates(project_id, created_at DESC);

-- Приглашение сотрудника.
-- Пароль сотрудник задаёт сам: владелец не должен знать чужой пароль,
-- а временный пароль в переписке живёт дольше, чем нужно.
CREATE TABLE IF NOT EXISTS invitations (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  invited_by  TEXT NOT NULL REFERENCES users(id),
  accepted_at TEXT,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS invitations_company ON invitations(company_id, accepted_at);
CREATE UNIQUE INDEX IF NOT EXISTS invitations_token ON invitations(token_hash);
