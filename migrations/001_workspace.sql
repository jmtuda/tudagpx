CREATE TABLE IF NOT EXISTS tudagpx_workspace_versions (
  owner_id text NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL CHECK (payload->>'schema' = '1'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, version)
);
-- Append-only snapshots: the application has no UPDATE/DELETE path.
