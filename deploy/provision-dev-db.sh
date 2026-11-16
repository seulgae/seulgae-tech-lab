#!/usr/bin/env bash
# 이미 있는 빈 개발 DB(stlab_dev)에 개발 전용 계정·lab 스키마·권한만 추가한다.
# 운영 DB(stlab_prod)·운영 계정·다른 DB는 바꾸지 않는다. 조건이 하나라도 다르면 아무것도 하지 않고 멈춘다.
#  - stlab_dev가 있고, 시스템 외 스키마에 객체가 하나도 없어야 한다.
#  - stlab_dev_owner/app/migrator 계정과 dev 비밀번호 파일이 아직 없어야 한다.
# 비밀번호는 서버에서 생성하며 SQL은 stdin으로만 전달한다(명령 인자·출력에 남기지 않음).
set -euo pipefail
umask 077
config=${STLAB_SECRETS_DIR:-/opt/homeserver/config/seulgae-tech-lab}
pg() { docker exec -i postgres-postgres-1 sh -c "exec psql -X -qAt -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d $1"; }

exists=$(pg postgres <<'SQL'
SELECT count(*) FROM pg_database WHERE datname = 'stlab_dev';
SQL
)
[[ "$exists" == 1 ]] || { echo 'stlab_dev does not exist; nothing changed.'; exit 1; }
objects=$(pg stlab_dev <<'SQL'
SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT LIKE 'pg\_%' AND n.nspname <> 'information_schema';
SQL
)
[[ "$objects" == 0 ]] || { echo "stlab_dev is not empty ($objects objects); inspect before provisioning."; exit 1; }
roles=$(pg postgres <<'SQL'
SELECT count(*) FROM pg_roles WHERE rolname IN ('stlab_dev_owner', 'stlab_dev_app', 'stlab_dev_migrator');
SQL
)
[[ "$roles" == 0 ]] || { echo 'stlab_dev roles already exist; inspect before provisioning.'; exit 1; }
for kind in app migrator; do
  test ! -e "$config/dev-$kind-password" || { echo "Secret exists: $config/dev-$kind-password; inspect before retry."; exit 1; }
done

for kind in app migrator; do openssl rand -hex 32 | tr -d '\n' > "$config/dev-$kind-password"; done
app_password=$(cat "$config/dev-app-password")
migrator_password=$(cat "$config/dev-migrator-password")

pg postgres <<SQL
BEGIN;
CREATE ROLE stlab_dev_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE stlab_dev_app LOGIN PASSWORD '$app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 8;
CREATE ROLE stlab_dev_migrator LOGIN PASSWORD '$migrator_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 2;
ALTER DATABASE stlab_dev OWNER TO stlab_dev_owner;
ALTER DATABASE stlab_dev CONNECTION LIMIT 15;
REVOKE ALL ON DATABASE stlab_dev FROM PUBLIC;
GRANT CONNECT ON DATABASE stlab_dev TO stlab_dev_app, stlab_dev_migrator;
ALTER ROLE stlab_dev_app IN DATABASE stlab_dev SET search_path = lab;
ALTER ROLE stlab_dev_migrator IN DATABASE stlab_dev SET search_path = lab;
COMMIT;
SQL
pg stlab_dev <<'SQL'
BEGIN;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA lab AUTHORIZATION stlab_dev_migrator;
GRANT USAGE ON SCHEMA lab TO stlab_dev_app;
ALTER DEFAULT PRIVILEGES FOR ROLE stlab_dev_migrator IN SCHEMA lab GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO stlab_dev_app;
ALTER DEFAULT PRIVILEGES FOR ROLE stlab_dev_migrator IN SCHEMA lab GRANT USAGE, SELECT ON SEQUENCES TO stlab_dev_app;
ALTER DEFAULT PRIVILEGES FOR ROLE stlab_dev_migrator IN SCHEMA lab REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
SQL
echo 'Provisioned stlab_dev: owner/app/migrator roles, lab schema and default privileges. Production untouched.'
