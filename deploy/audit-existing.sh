#!/usr/bin/env bash
set -euo pipefail
config=/opt/homeserver/config/seulgae-tech-lab
mkdir -p "$config"
chmod 700 "$config"
mode=${1:-check}
snapshot() {
  docker inspect invencore-app-frontend-1 invencore-app-backend-1 \
    invencore-infra-kafka-1 invencore-infra-redis-1 \
    invencore-pg-local-proxy postgres-postgres-1 \
    --format '{{.Name}}|{{.Id}}|{{.State.StartedAt}}|{{.RestartCount}}|{{.State.Status}}'
  find /opt/homeserver/apps/InvenCore /opt/homeserver/apps/postgres /home/seulgae/invencore-infra \
    -maxdepth 1 -type f -readable \( -name '*compose*' -o -name '.env*' \) -print0 | sort -z | xargs -0 sha256sum
}
if [[ "$mode" == baseline ]]; then
  test ! -e "$config/existing-baseline.txt" || { echo 'Baseline already exists'; exit 1; }
  snapshot > "$config/existing-baseline.tmp"
  mv "$config/existing-baseline.tmp" "$config/existing-baseline.txt"
else
  diff -u "$config/existing-baseline.txt" <(snapshot)
fi
docker inspect invencore-app-frontend-1 invencore-app-backend-1 \
  invencore-infra-kafka-1 invencore-infra-redis-1 postgres-postgres-1 \
  --format '{{.Name}} {{.State.Health.Status}}' | tee "$config/existing-health.txt"
! grep -v ' healthy$' "$config/existing-health.txt"
backend_ip=$(docker inspect invencore-app-backend-1 --format '{{(index .NetworkSettings.Networks "invencore-app_default").IPAddress}}')
curl --fail --silent --show-error --max-time 10 "http://$backend_ip:8080/api/health" | tee "$config/invencore-health.json"
grep -q '"status":"UP"' "$config/invencore-health.json"
curl --fail --silent --show-error --max-time 10 -o /dev/null http://127.0.0.1:8082/
echo 'Existing container identities, start times, config hashes and health verified.'
