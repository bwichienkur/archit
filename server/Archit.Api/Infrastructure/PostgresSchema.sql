CREATE TABLE IF NOT EXISTS tenants (
    id uuid PRIMARY KEY,
    name varchar(160) NOT NULL,
    created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id varchar(320) NOT NULL,
    role varchar(40) NOT NULL,
    project_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL,
    PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS projects (
    id uuid PRIMARY KEY,
    tenant_id uuid NULL REFERENCES tenants(id),
    name varchar(160) NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS project_revisions (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_revision_id uuid NULL REFERENCES project_revisions(id),
    kind varchar(40) NOT NULL,
    created_at timestamptz NOT NULL,
    created_by varchar(320) NOT NULL,
    source_import_id uuid NULL,
    model jsonb NOT NULL,
    note text NULL
);
CREATE INDEX IF NOT EXISTS ix_project_revisions_project_created ON project_revisions(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS cad_import_jobs (
    id uuid PRIMARY KEY,
    project_id uuid NULL REFERENCES projects(id) ON DELETE SET NULL,
    file_name text NOT NULL,
    status varchar(40) NOT NULL,
    progress integer NOT NULL,
    error text NULL,
    document jsonb NULL,
    validation jsonb NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cad_import_queue (
    job_id uuid PRIMARY KEY REFERENCES cad_import_jobs(id) ON DELETE CASCADE,
    enqueued_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_cad_import_queue_enqueued ON cad_import_queue(enqueued_at, job_id);

CREATE TABLE IF NOT EXISTS catalog_products (
    id uuid PRIMARY KEY,
    external_id text NOT NULL UNIQUE,
    manufacturer text NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    category varchar(80) NOT NULL,
    unit_of_measure varchar(40) NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_catalog_products_manufacturer_category ON catalog_products(manufacturer, category);

CREATE TABLE IF NOT EXISTS collaboration_events (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    revision_id uuid NULL REFERENCES project_revisions(id) ON DELETE SET NULL,
    actor_id text NOT NULL,
    actor_role varchar(40) NOT NULL,
    type varchar(80) NOT NULL,
    target_kind varchar(40) NULL,
    target_id text NULL,
    created_at timestamptz NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_collaboration_events_project_created ON collaboration_events(project_id, created_at);

CREATE TABLE IF NOT EXISTS collaboration_comments (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    revision_id uuid NULL REFERENCES project_revisions(id) ON DELETE SET NULL,
    author_id text NOT NULL,
    author_role varchar(40) NOT NULL,
    target_kind varchar(40) NOT NULL,
    target_id text NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL,
    resolved_at timestamptz NULL,
    resolved_by text NULL
);

CREATE TABLE IF NOT EXISTS export_jobs (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    revision_id uuid NOT NULL REFERENCES project_revisions(id),
    format varchar(20) NOT NULL,
    status varchar(40) NOT NULL,
    progress integer NOT NULL,
    requested_by text NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    artifact_path text NULL,
    error text NULL
);
