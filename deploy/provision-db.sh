#!/usr/bin/env bash
# One-time additive provisioning. No existing DB, role, config or volume is altered.
set -euo pipefail
umask 077
config=/opt/homeserver/config/seulgae-tech-lab
mkdir -p "$config"
chmod 700 "$config"
pg() { docker exec -i postgres-postgres-1 sh -c 'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres'; }
collision=$(pg <<'SQL'
SELECT count(*) FROM (SELECT datname AS name FROM pg_database WHERE datname IN ('stlab_dev','stlab_prod') UNION ALL SELECT rolname FROM pg_roles WHERE rolname LIKE 'stlab\_%') s;
SQL
)
[[ "$collision" =~ [[:space:]]0[[:space:]] ]] || { echo 'stlab DB/role exists; inspect before provisioning.'; exit 1; }
for environment in dev prod; do
  for kind in app migrator; do
    file="$config/$environment-$kind-password"
    test ! -e "$file" || { echo "Secret exists: $file; inspect before retry."; exit 1; }
    openssl rand -hex 32 | tr -d '\n' > "$file"
  done
done
# SQL goes through stdin, never shell arguments or tool output. Passwords stay on server.
for environment in dev prod; do
  app_password=$(cat "$config/$environment-app-password")
  migrator_password=$(cat "$config/$environment-migrator-password")
  pg <<SQL
CREATE ROLE stlab_${environment}_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE stlab_${environment}_app LOGIN PASSWORD '$app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 8;
CREATE ROLE stlab_${environment}_migrator LOGIN PASSWORD '$migrator_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 2;
CREATE DATABASE stlab_${environment} OWNER stlab_${environment}_owner CONNECTION LIMIT 15;
REVOKE ALL ON DATABASE stlab_${environment} FROM PUBLIC;
GRANT CONNECT ON DATABASE stlab_${environment} TO stlab_${environment}_app, stlab_${environment}_migrator;
ALTER ROLE stlab_${environment}_app IN DATABASE stlab_${environment} SET search_path = lab;
ALTER ROLE stlab_${environment}_migrator IN DATABASE stlab_${environment} SET search_path = lab;
\connect stlab_${environment}
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA lab AUTHORIZATION stlab_${environment}_migrator;
GRANT USAGE ON SCHEMA lab TO stlab_${environment}_app;
ALTER DEFAULT PRIVILEGES FOR ROLE stlab_${environment}_migrator IN SCHEMA lab GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO stlab_${environment}_app;
ALTER DEFAULT PRIVILEGES FOR ROLE stlab_${environment}_migrator IN SCHEMA lab GRANT USAGE,SELECT ON SEQUENCES TO stlab_${environment}_app;
ALTER DEFAULT PRIVILEGES FOR ROLE stlab_${environment}_migrator IN SCHEMA lab REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
SQL
done
# Compose bind-mounted secrets retain host permissions. The containing directory is 0700.
chmod 444 "$config/prod-app-password"
echo 'Created independent development/production DBs, owners, migrators and runtime roles.'
