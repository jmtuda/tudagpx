CREATE TABLE IF NOT EXISTS tudagpx_upload_parts (
  owner_id text NOT NULL,
  upload_id text NOT NULL,
  part integer NOT NULL CHECK (part >= 0 AND part < 1024),
  total integer NOT NULL CHECK (total > 0 AND total <= 1024),
  chunk text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, upload_id, part),
  CHECK (part < total)
);
