#!/usr/bin/env python3
"""Fixed tech-lab project, pinned images, no DB migrations or host reboot."""
import contextlib
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
STATE = Path('/opt/homeserver/config/seulgae-tech-lab/ops')
REPO = 'seulgae/seulgae-tech-lab'
PROJECT = 'seulgae-tech-lab'
SERVICES = ('backend', 'frontend')
SHARED = ('invencore-app-frontend-1', 'invencore-app-backend-1',
          'invencore-infra-kafka-1', 'invencore-infra-redis-1',
          'invencore-pg-local-proxy', 'kafka-kafka-1', 'postgres-postgres-1')
DATABASE = 'postgres-postgres-1'
DATABASE_NETWORK = 'postgres_backend'
# Set when deploy re-executes itself after moving the checkout, so it never loops.
SYNCED_ENV = 'STLAB_DEPLOY_SYNCED'


class OpsError(RuntimeError):
    pass


def command(args, capture=False, input=None):
    if capture:
        result = subprocess.run(args, text=True, input=input, capture_output=True)
        if result.returncode:
            raise OpsError(f'Command failed ({result.returncode}): {args[0]} {args[1] if len(args) > 1 else ""}')
        return result.stdout.strip()
    process = subprocess.Popen(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for line in process.stdout:
        print(line, end='', flush=True)
        if STATE.exists():
            log = STATE / 'commands.log'
            if log.exists() and log.stat().st_size > 10_000_000:
                os.replace(log, STATE / 'commands.previous.log')
            with log.open('a') as f:
                f.write(line)
    if process.wait():
        raise OpsError(f'Command failed: {args[0]} {args[1] if len(args) > 1 else ""}; see commands.log')
    return ''


def stamp():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def save(path, value):
    with tempfile.NamedTemporaryFile('w', dir=path.parent, delete=False, encoding='utf-8') as f:
        json.dump(value, f, indent=2)
        temporary = f.name
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)


def read(path):
    return json.loads(path.read_text()) if path.exists() else None


def event(action, result, **details):
    with (STATE / 'history.jsonl').open('a') as f:
        f.write(json.dumps(dict(time=stamp(), action=action, result=result, **details)) + '\n')


def validate(release, local=False):
    if not isinstance(release, dict) or release.get('format') != 1 or release.get('repository') != REPO:
        raise OpsError('Invalid release manifest/repository')
    if not re.fullmatch(r'[0-9a-f]{40}', str(release.get('sha', ''))):
        raise OpsError('Invalid commit')
    legacy = release.get('legacy') is True
    if legacy and not local:
        raise OpsError('Remote manifests cannot use legacy mode')
    if not legacy and (type(release.get('run_id')) is not int or release['run_id'] <= 0):
        raise OpsError('Invalid CI run ID')
    for service in SERVICES:
        pattern = (r'sha256:[0-9a-f]{64}' if legacy else
                   rf'ghcr\.io/seulgae/seulgae-tech-lab-{service}@sha256:[0-9a-f]{{64}}')
        if not re.fullmatch(pattern, release.get('images', {}).get(service, '')):
            raise OpsError(f'Invalid pinned image: {service}')
    bounds = release.get('db_schema', {})
    if type(bounds.get('min')) is not int or type(bounds.get('max')) is not int or not 0 <= bounds['min'] <= bounds['max']:
        raise OpsError('Invalid schema compatibility range')
    return release


def request_json(url, api=False):
    headers = {'User-Agent': 'seulgae-tech-lab-ops', 'Accept': 'application/json'}
    token = STATE.parent / 'github-read-token'
    if api and token.exists():
        headers['Authorization'] = 'Bearer ' + token.read_text().strip()
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args):
            return None
    opener = urllib.request.build_opener(NoRedirect()) if api else urllib.request.build_opener()
    with opener.open(urllib.request.Request(url, headers=headers), timeout=20) as response:
        data = response.read(2_000_001)
        if len(data) > 2_000_000:
            raise OpsError('Response too large')
        return json.loads(data)


def select_release(fetch=request_json):
    url = f'https://api.github.com/repos/{REPO}/actions/workflows/ci.yml/runs?branch=main&status=success&per_page=50'
    for run in sorted(fetch(url, api=True).get('workflow_runs', []), key=lambda r: r['id'], reverse=True):
        if (run.get('status') != 'completed' or run.get('conclusion') != 'success' or run.get('head_branch') != 'main'
                or run.get('event') not in ('push', 'workflow_dispatch') or run.get('head_repository', {}).get('full_name') != REPO):
            continue
        try:
            release = validate(fetch(f'https://github.com/{REPO}/releases/download/deploy-run-{run["id"]}/release.json'))
        except urllib.error.HTTPError as error:
            if error.code == 404:
                continue
            raise
        if release['run_id'] != run['id'] or release['sha'] != run['head_sha']:
            raise OpsError('CI provenance mismatch')
        return release
    raise OpsError('No successful main CI release with a published image manifest. Nothing deployed.')


def sync_checkout(candidate, git=None):
    """Detach the server checkout at the release commit so compose.yml and ops.py match the images.

    CI deployments only run ./deploy.sh; without this the checkout keeps old Compose settings
    (new environment variables and secrets never reach the containers). Returns True if HEAD moved.
    """
    git = git or command  # resolved at call time so tests that patch ops.command also cover git
    root = str(ROOT)
    git(['git', '-C', root, 'fetch', '--quiet', 'origin', 'main'])
    git(['git', '-C', root, 'merge-base', '--is-ancestor', candidate['sha'], 'origin/main'])
    if git(['git', '-C', root, 'rev-parse', 'HEAD'], capture=True) == candidate['sha']:
        return False
    if git(['git', '-C', root, 'status', '--porcelain', '--untracked-files=no'], capture=True):
        raise OpsError('Server checkout has local changes to tracked files; discard them before deploying')
    git(['git', '-C', root, 'checkout', '--quiet', '--detach', candidate['sha']])
    return True


def containers(names):
    if not names:
        return []
    return json.loads(command(['docker', 'inspect', *names], capture=True))


def container_names():
    return set(command(['docker', 'ps', '--all', '--format', '{{.Names}}'], capture=True).splitlines())


def application_containers():
    names = container_names()
    data = containers([f'{PROJECT}-{s}-1' for s in SERVICES if f'{PROJECT}-{s}-1' in names])
    for c in data:
        labels = c['Config'].get('Labels') or {}
        service = labels.get('com.docker.compose.service')
        if (labels.get('com.docker.compose.project') != PROJECT or service not in SERVICES
                or c['Name'].lstrip('/') != f'{PROJECT}-{service}-1'):
            raise OpsError('Application name collision; refusing to modify an unmanaged container')
    return data


def shared_snapshot():
    result = {}
    invencore_running = []
    present = container_names()
    if DATABASE not in present:
        raise OpsError('Required PostgreSQL container is missing')
    for c in containers([name for name in SHARED if name in present]):
        s = c['State']
        is_invencore_app = c['Name'].lstrip('/') in SHARED[:2]
        if is_invencore_app:
            invencore_running.append(s['Running'])
        if ((not s['Running'] and not is_invencore_app)
                or (s['Running'] and s.get('Health', {}).get('Status', 'healthy') != 'healthy')):
            raise OpsError('Shared infrastructure is not healthy')
        result[c['Name']] = [c['Id'], s['StartedAt'], c['RestartCount'], s['Running'], s['Status']]
    if any(invencore_running) and not all(invencore_running):
        raise OpsError('InvenCore application is only partially running; inspect manually')
    if any(invencore_running) and len(invencore_running) != 2:
        raise OpsError('InvenCore application is incomplete; inspect manually')
    if invencore_running and all(invencore_running) and request_json('http://127.0.0.1:8082/api/health').get('status') != 'UP':
        raise OpsError('InvenCore health failed')
    return result


def preflight():
    """Check host prerequisites without pulling images, starting services or migrating DB."""
    command(['docker', 'compose', 'version'], capture=True)
    shared_snapshot()
    network = json.loads(command(['docker', 'network', 'inspect', DATABASE_NETWORK], capture=True))[0]
    if network['Name'] != DATABASE_NETWORK:
        raise OpsError('Unexpected PostgreSQL network')
    database = containers([DATABASE])[0]
    if DATABASE_NETWORK not in database.get('NetworkSettings', {}).get('Networks', {}):
        raise OpsError('PostgreSQL is not attached to postgres_backend')
    raw = os.environ.get('STLAB_SECRETS_DIR', str(STATE.parent))
    directory = Path(raw)
    if not directory.is_absolute() or any(char in raw for char in '\r\n'):
        raise OpsError('STLAB_SECRETS_DIR must be an absolute path')
    if not directory.is_dir() or directory.stat().st_mode & 0o077:
        raise OpsError('Secret directory must exist and deny group/other access (0700)')
    for name in ('prod-app-password', 'prod-migrator-password'):
        path = directory / name
        if path.is_symlink() or not path.is_file() or not os.access(path, os.R_OK) or path.stat().st_size == 0:
            raise OpsError(f'Missing, empty or unreadable credential file: {name}')
        info = path.stat()
        if info.st_mode & 0o022:
            raise OpsError(f'Credential must not be writable by group/others: {name}')
        if name == 'prod-app-password':
            readable = (info.st_uid == 10001 and info.st_mode & stat.S_IRUSR
                        or info.st_gid == 10001 and info.st_mode & stat.S_IRGRP
                        or info.st_mode & stat.S_IROTH)
            if not readable:
                raise OpsError('prod-app-password must be readable by backend UID/GID 10001; see operations.md')
        elif info.st_mode & 0o077:
            raise OpsError('prod-migrator-password must be private (0600)')
    # 카카오 로그인 비밀 값. 백엔드 컨테이너(UID 10001)가 읽어야 하며, 세션 서명 비밀값은 32바이트 이상이어야 한다.
    for name, minimum in (('kakao-client-secret', 1), ('auth-session-secret', 32)):
        path = directory / name
        if path.is_symlink() or not path.is_file() or not os.access(path, os.R_OK) or path.stat().st_size < minimum:
            raise OpsError(f'Missing, too short or unreadable login secret: {name}; see docs/kakao-login.md')
        info = path.stat()
        if info.st_mode & 0o022:
            raise OpsError(f'Credential must not be writable by group/others: {name}')
        if not (info.st_uid == 10001 and info.st_mode & stat.S_IRUSR or info.st_gid == 10001 and info.st_mode & stat.S_IRGRP
                or info.st_mode & stat.S_IROTH):
            raise OpsError(f'{name} must be readable by backend UID/GID 10001; see docs/kakao-login.md')
    # Capture resolved configuration, never print it or any credentials from a local .env.
    placeholder = dict(images={s: f'ghcr.io/seulgae/seulgae-tech-lab-{s}@sha256:' + '0' * 64 for s in SERVICES})
    with compose_args(placeholder) as prefix:
        config = json.loads(command([*prefix, 'config', '--format', 'json'], capture=True))
    services = config.get('services', {})
    env = services.get('backend', {}).get('environment', {})
    if (set(services) != set(SERVICES)
            or env.get('DB_URL') != 'jdbc:postgresql://postgres-postgres-1:5432/stlab_prod?currentSchema=lab'
            or env.get('DB_USERNAME') != 'stlab_prod_app'
            or env.get('SPRING_SQL_INIT_MODE') != 'never'
            or env.get('SPRING_FLYWAY_ENABLED') != 'false'
            or env.get('SPRING_CONFIG_IMPORT') != 'configtree:/run/secrets/'
            or Path(config.get('secrets', {}).get('prod_db_password', {}).get('file', '')) != directory / 'prod-app-password'
            or Path(config.get('secrets', {}).get('kakao_client_secret', {}).get('file', '')) != directory / 'kakao-client-secret'
            or Path(config.get('secrets', {}).get('auth_session_secret', {}).get('file', '')) != directory / 'auth-session-secret'):
        raise OpsError('Resolved Compose runtime/DB configuration is unsafe or inconsistent')
    version = schema_version()
    if version not in SUPPORTED_SCHEMAS:
        raise OpsError(f'Expected existing Flyway V1-V7; found schema {version}. No migration performed.')
    print(f'Prerequisites verified: PostgreSQL, network, credential files, runtime config and existing schema V{version}.')


# Flyway versions this repository knows how to run against. Releases still declare their own range.
SUPPORTED_SCHEMAS = (1, 2, 3, 4, 5, 6, 7)


def schema_version():
    def pg(sql):
        return command(['docker', 'exec', '-i', 'postgres-postgres-1', 'sh', '-c',
                        'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d stlab_prod'],
                       capture=True, input='BEGIN READ ONLY;\n' + sql + 'COMMIT;\n')
    if not pg("SELECT to_regclass('lab.flyway_schema_history');\n"):
        return 0
    if pg('SELECT count(*) FROM lab.flyway_schema_history WHERE NOT success;\n') != '0':
        raise OpsError('Failed migration recorded; manual schema investigation required')
    versions = pg('SELECT version FROM lab.flyway_schema_history WHERE success AND version IS NOT NULL;\n').splitlines()
    if any(not re.fullmatch(r'\d+', version) for version in versions):
        raise OpsError('Cannot determine production schema version')
    return max(map(int, versions), default=0)


def compatible(release, version):
    b = release['db_schema']
    if not b['min'] <= version <= b['max']:
        raise OpsError(f'DB schema {version} outside compatible range {b["min"]}..{b["max"]}; no DB changes performed')


@contextlib.contextmanager
def compose_args(release):
    with tempfile.NamedTemporaryFile('w', dir=STATE, delete=False) as f:
        for service in SERVICES:
            f.write(f'{service.upper()}_IMAGE={release["images"][service]}\n')
        name = f.name
    try:
        yield ['docker', 'compose', '--project-name', PROJECT, '--project-directory', str(ROOT), '--env-file', name,
               '-f', str(ROOT / 'compose.yml'), '-f', str(ROOT / 'deploy/compose.release.yml')]
    finally:
        Path(name).unlink(missing_ok=True)


def compose(release, *args):
    with compose_args(release) as prefix:
        command([*prefix, *args])


def health(release):
    for c in containers([f'{PROJECT}-{s}-1' for s in SERVICES]):
        if not c['State']['Running'] or c['State'].get('Health', {}).get('Status') != 'healthy':
            raise OpsError('Application container is not healthy')
    if request_json('http://127.0.0.1:18082/api/health').get('status') != 'UP':
        raise OpsError('Application health API failed')
    with urllib.request.urlopen('http://127.0.0.1:18082/', timeout=10) as response:
        if b'<html' not in response.read(100000).lower():
            raise OpsError('Frontend HTML unavailable')
    if not release.get('legacy'):
        page = request_json('http://127.0.0.1:18082/api/research-records?limit=1')
        if not isinstance(page.get('items'), list) or type(page.get('hasMore')) is not bool:
            raise OpsError('Research read API failed')


def verify_images(release):
    for service in SERVICES:
        ref = release['images'][service]
        image = json.loads(command(['docker', 'image', 'inspect', ref], capture=True))[0]
        if release.get('legacy'):
            valid = image['Id'] == ref
        else:
            valid = image['Config'].get('Labels', {}).get('org.opencontainers.image.revision') == release['sha']
        if not valid:
            raise OpsError(f'Image revision mismatch: {service}')


def activate(release):
    validate(release, local=True)
    compatible(release, schema_version())
    verify_images(release)
    compose(release, 'up', '-d', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '150', *SERVICES)
    health(release)


def bootstrap():
    current = read(STATE / 'current.json')
    if current:
        return validate(current, local=True)
    data = application_containers()
    if not data:
        return None
    if len(data) != len(SERVICES):
        raise OpsError('Partial unmanaged application installation; inspect before bootstrap')
    data = sorted(data, key=lambda c: SERVICES.index(c['Config']['Labels']['com.docker.compose.service']))
    revisions = {c['Config']['Image'].rsplit(':', 1)[-1] for c in data}
    if len(revisions) != 1 or not re.fullmatch(r'[0-9a-f]{40}', next(iter(revisions))):
        raise OpsError('Initial application version is ambiguous')
    current = validate(dict(format=1, repository=REPO, sha=revisions.pop(), run_id=0, legacy=True,
                            images={s: c['Image'] for s, c in zip(SERVICES, data)}, db_schema={'min': 0, 'max': 1}), local=True)
    health(current)
    save(STATE / 'current.json', current)
    event('bootstrap', 'success', sha=current['sha'])
    return current


def verify_running_images(current, partial=False):
    data = application_containers()
    if not partial and len(data) != len(SERVICES):
        raise OpsError('Recorded application containers are missing; inspect state before continuing')
    for c in data:
        service = c['Config']['Labels']['com.docker.compose.service']
        expected = json.loads(command(['docker', 'image', 'inspect', current['images'][service]], capture=True))[0]['Id']
        if c['Image'] != expected:
            raise OpsError('Running images differ from recorded state')


def clean_initial(candidate, before):
    """Remove only the candidate's owned app containers; no down, volumes or shared services."""
    recorded = read(STATE / 'current.json')
    if recorded is not None and recorded != candidate:
        raise OpsError('Managed state changed since first installation; inspect before cleanup')
    verify_running_images(candidate, partial=True)
    compose(candidate, 'rm', '--stop', '--force', *SERVICES)
    if application_containers() or shared_snapshot() != before:
        raise OpsError('Initial deployment cleanup verification failed')
    # A crash may occur after current.json was saved but before transaction.json was removed.
    (STATE / 'current.json').unlink(missing_ok=True)
    (STATE / 'previous.json').unlink(missing_ok=True)


def transact(candidate, current, action):
    before = shared_snapshot()
    compatible(candidate, schema_version())
    save(STATE / 'transaction.json', dict(time=stamp(), action=action, previous=current, candidate=candidate,
                                         shared_before=before))
    try:
        activate(candidate)
        if shared_snapshot() != before:
            raise OpsError('Shared container identities changed')
    except Exception as failure:
        event(action, 'failed', sha=candidate['sha'], error=str(failure))
        print('Verification failed. Restoring previous application or cleaning first-install containers once.', flush=True)
        try:
            if current is None:
                clean_initial(candidate, before)
            else:
                activate(current)
            if shared_snapshot() != before:
                raise OpsError('Shared infrastructure changed')
            event(action, 'restored' if current else 'initial-cleaned', sha=current['sha'] if current else None)
            (STATE / 'transaction.json').unlink(missing_ok=True)
        except Exception as restoration:
            event(action, 'restoration-failed', error=str(restoration))
            raise OpsError('Rollback failed; inspect transaction.json, history.jsonl and logs. No retry loop.') from restoration
        raise OpsError('Deployment failed; previous application restored or first-install containers removed. DB unchanged.') from failure
    if current is not None:
        save(STATE / 'previous.json', current)
    else:
        (STATE / 'previous.json').unlink(missing_ok=True)
    save(STATE / 'current.json', candidate)
    (STATE / 'transaction.json').unlink(missing_ok=True)
    event(action, 'success', sha=candidate['sha'], run_id=candidate['run_id'], images=candidate['images'])
    print(f'SUCCESS {action}: {candidate["sha"]}', flush=True)


def main(argv):
    action = argv[0] if argv else ''
    if action not in ('check', 'deploy', 'start', 'stop', 'restart', 'status', 'logs', 'rollback'):
        raise OpsError('Unknown operation')
    if action != 'logs' and len(argv) != 1:
        raise OpsError('SHA, tag and Compose arguments are not accepted')
    os.umask(0o077)
    STATE.mkdir(parents=True, exist_ok=True)
    if action in ('status', 'logs'):
        current = read(STATE / 'current.json')
        if not current:
            print('No managed release yet. Run ./deploy.sh after image publication.')
            command(['docker', 'ps', '--filter', f'label=com.docker.compose.project={PROJECT}'])
            return
        validate(current, local=True)
        if action == 'status':
            print(json.dumps(dict(sha=current['sha'], run_id=current['run_id'], images=current['images'],
                                  schema=schema_version(), interrupted_operation=(STATE / 'transaction.json').exists()), indent=2))
            compose(current, 'ps', '--all')
            health(current)
            print('Legacy HTML and health verified (no research API in this initial release).' if current.get('legacy')
                  else 'Application HTML, health and read API verified.')
        else:
            extra = argv[1:]
            if any(a not in (*SERVICES, '--follow') for a in extra):
                raise OpsError('Usage: ./logs.sh [backend|frontend] [--follow]')
            compose(current, 'logs', '--tail', '100', *(['--follow'] if '--follow' in extra else []),
                    *([a for a in extra if a in SERVICES] or SERVICES))
        return
    with (STATE / 'operations.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise OpsError('Another tech-lab operation is running')
        if (STATE / 'transaction.json').exists():
            if action != 'rollback':
                raise OpsError('Interrupted operation recorded; inspect transaction.json, then explicitly run ./rollback.sh')
            transaction = read(STATE / 'transaction.json')
            before = shared_snapshot()
            if transaction['previous'] is None:
                candidate = validate(transaction['candidate'], local=True)
                clean_initial(candidate, transaction['shared_before'])
                (STATE / 'transaction.json').unlink()
                event('rollback', 'recovered-initial-cleanup', sha=candidate['sha'])
                print('SUCCESS removed interrupted first-install application containers. DB unchanged.')
                return
            preflight()
            target = validate(transaction['previous'], local=True)
            activate(target)
            if shared_snapshot() != before:
                raise OpsError('Shared infrastructure changed')
            save(STATE / 'current.json', target)
            (STATE / 'transaction.json').unlink()
            event('rollback', 'recovered-interrupted-operation', sha=target['sha'])
            print(f'SUCCESS recovered previous application: {target["sha"]}')
            return
        if action == 'deploy' and not os.environ.get(SYNCED_ENV):
            candidate = select_release()
            if sync_checkout(candidate):
                # Run the release's own ops.py so preflight and Compose files match the images.
                # The lock file is opened non-inheritable, so exec releases the lock for the new process.
                print(f'Checkout moved to release {candidate["sha"]}; continuing with its deployment files', flush=True)
                os.environ[SYNCED_ENV] = candidate['sha']
                os.execv(sys.executable, [sys.executable, str(ROOT / 'deploy' / 'ops.py'), 'deploy'])
        preflight()
        if action == 'check':
            return
        current = bootstrap()
        if current:
            verify_running_images(current)
        elif action != 'deploy':
            raise OpsError('No managed application yet; run ./deploy.sh for first installation')
        if action == 'deploy':
            candidate = select_release()
            if sync_checkout(candidate):
                raise OpsError('A newer release was published during this deployment; run ./deploy.sh again')
            compatible(candidate, schema_version())
            for service in SERVICES:
                command(['docker', 'pull', candidate['images'][service]])
            verify_images(candidate)
            if current and candidate['images'] == current['images']:
                # Same images, but Compose settings may have changed with the checkout: up -d recreates only changed services.
                activate(current)
                print(f'Already running latest verified release {current["sha"]}; Compose configuration re-applied')
            else:
                transact(candidate, current, action)
        elif action == 'rollback':
            previous = read(STATE / 'previous.json')
            if not previous:
                raise OpsError('No previous successful application recorded')
            transact(validate(previous, local=True), current, action)
        else:
            before = shared_snapshot()
            if action == 'stop':
                compose(current, 'stop', *SERVICES)
            elif action == 'start':
                activate(current)
            else:
                compose(current, 'restart', *SERVICES)
                deadline = time.monotonic() + 150
                while True:
                    try:
                        health(current)
                        break
                    except Exception:
                        if time.monotonic() >= deadline:
                            raise OpsError('Restart health timeout; inspect ./logs.sh')
                        time.sleep(2)
            if shared_snapshot() != before:
                raise OpsError('Shared infrastructure changed')
            event(action, 'success', sha=current['sha'])
            print(f'SUCCESS {action}: only {PROJECT} application containers affected')


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except Exception as error:
        if STATE.exists():
            try:
                event(sys.argv[1] if len(sys.argv) > 1 else 'unknown', 'error', error=str(error))
            except OSError:
                pass
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)
