#!/usr/bin/env bash
set -euo pipefail
cd /opt/homeserver/apps/seulgae-tech-lab
exec 9>/opt/homeserver/config/seulgae-tech-lab/deploy.lock
flock -n 9 || { echo 'Another tech-lab deployment is running'; exit 1; }
sha=${1:?Usage: deploy.sh FULL_COMMIT_SHA}
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid commit'; exit 1; }
test -z "$(git status --porcelain)" || { echo 'Working tree is dirty'; exit 1; }
git fetch origin main
git merge-base --is-ancestor "$sha" origin/main
git checkout --detach "$sha"
bash deploy/audit-existing.sh check
previous=$(cat /opt/homeserver/config/seulgae-tech-lab/deployed-sha 2>/dev/null || true)
export IMAGE_TAG="$sha"
docker compose --parallel 1 build
rollback() {
  echo 'New release failed verification.'
  if [[ "$previous" =~ ^[a-f0-9]{40}$ ]]; then
    echo "Restoring tech-lab images: $previous"
    IMAGE_TAG="$previous" docker compose up -d --no-build --wait --wait-timeout 180
  fi
  bash deploy/audit-existing.sh check
  exit 1
}
docker compose up -d --wait --wait-timeout 180 || rollback
curl --fail --silent --show-error http://127.0.0.1:18082/api/health || rollback
bash deploy/audit-existing.sh check
printf '%s\n' "$sha" > /opt/homeserver/config/seulgae-tech-lab/deployed-sha
echo 'Deployment verified. Only seulgae-tech-lab services were updated.'
