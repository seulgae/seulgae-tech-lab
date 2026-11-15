CREATE TABLE lab.research_records (
    id uuid PRIMARY KEY,
    title varchar(120) NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
    summary varchar(500) NOT NULL CHECK (char_length(btrim(summary)) BETWEEN 1 AND 500),
    content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 20000),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX research_records_created_at_id_idx
    ON lab.research_records (created_at DESC, id DESC);

-- Provisioning grants default table DML to the runtime role. History is migration-only.
DO $$
DECLARE
    runtime_role text := regexp_replace(current_user, '_migrator$', '_app');
BEGIN
    IF current_user !~ '_migrator$' THEN
        RAISE EXCEPTION 'Use a dedicated migration role';
    END IF;
    EXECUTE format('REVOKE ALL ON TABLE lab.flyway_schema_history FROM %I', runtime_role);
END $$;
