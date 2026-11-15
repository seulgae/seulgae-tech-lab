#!/usr/bin/env bash
set -euo pipefail
docker exec -i postgres-postgres-1 sh -c 'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d stlab_dev' <<'SQL'
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolconnlimit FROM pg_roles WHERE rolname LIKE 'stlab\_%' ORDER BY rolname;
DO $$
BEGIN
  IF has_database_privilege('stlab_dev_app','stlab_prod','CONNECT')
     OR has_database_privilege('stlab_dev_migrator','stlab_prod','CONNECT')
     OR has_database_privilege('stlab_prod_app','stlab_dev','CONNECT')
     OR has_database_privilege('stlab_prod_migrator','stlab_dev','CONNECT')
     OR has_schema_privilege('stlab_dev_app','lab','CREATE') THEN
    RAISE EXCEPTION 'Unexpected cross-environment or runtime DDL privilege';
  END IF;
END $$;
-- Exercise migration defaults and runtime DML entirely inside a rolled-back dev transaction.
BEGIN;
SET LOCAL ROLE stlab_dev_migrator;
CREATE TABLE lab.__infrastructure_permission_check(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, label text);
RESET ROLE;
SET LOCAL ROLE stlab_dev_app;
INSERT INTO lab.__infrastructure_permission_check(label) VALUES ('check');
SELECT count(*) AS runtime_select_check FROM lab.__infrastructure_permission_check;
UPDATE lab.__infrastructure_permission_check SET label='updated';
DELETE FROM lab.__infrastructure_permission_check;
ROLLBACK;
SQL
docker exec -i postgres-postgres-1 sh -c 'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d invencore' <<'SQL'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_toast'
      AND c.relkind IN ('r','p','v','m')
      AND (has_table_privilege('stlab_dev_app',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_table_privilege('stlab_prod_app',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_table_privilege('stlab_dev_migrator',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        OR has_table_privilege('stlab_prod_migrator',c.oid,'SELECT,INSERT,UPDATE,DELETE'))
  ) THEN RAISE EXCEPTION 'Tech-lab role has access to InvenCore application tables'; END IF;
END $$;
SQL
echo 'Cross-environment denial, runtime DML, migration defaults and InvenCore table isolation verified.'
