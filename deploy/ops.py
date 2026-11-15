#!/usr/bin/env python3
"""Fixed tech-lab project, pinned images, no DB migrations or host reboot."""
import contextlib
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import re
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
          'invencore-pg-local-proxy', 'postgres-postgres-1')


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


def containers(names):
    return json.loads(command(['docker', 'inspect', *names], capture=True))


def shared_snapshot():
    result = {}
    for c in containers(SHARED):
        s = c['State']
        if not s['Running'] or s.get('Health', {}).get('Status', 'healthy') != 'healthy':
            raise OpsError('Shared infrastructure is not healthy')
        result[c['Name']] = [c['Id'], s['StartedAt'], c['RestartCount']]
    if request_json('http://127.0.0.1:8082/api/health').get('status') != 'UP':
        raise OpsError('InvenCore health failed')
    return result


def schema_version():
    def pg(sql):
        return command(['docker', 'exec', '-i', 'postgres-postgres-1', 'sh', '-c',
                        'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d stlab_prod'], capture=True, input=sql)
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
    data = containers([f'{PROJECT}-{s}-1' for s in SERVICES])
    revisions = {c['Config']['Image'].rsplit(':', 1)[-1] for c in data}
    if len(revisions) != 1 or not re.fullmatch(r'[0-9a-f]{40}', next(iter(revisions))):
        raise OpsError('Initial application version is ambiguous')
    current = validate(dict(format=1, repository=REPO, sha=revisions.pop(), run_id=0, legacy=True,
                            images={s: c['Image'] for s, c in zip(SERVICES, data)}, db_schema={'min': 0, 'max': 1}), local=True)
    health(current)
    save(STATE / 'current.json', current)
    event('bootstrap', 'success', sha=current['sha'])
    return current


def transact(candidate, current, action):
    before = shared_snapshot()
    compatible(candidate, schema_version())
    save(STATE / 'transaction.json', dict(time=stamp(), action=action, previous=current, candidate=candidate))
    try:
        activate(candidate)
        if shared_snapshot() != before:
            raise OpsError('Shared container identities changed')
    except Exception as failure:
        event(action, 'failed', sha=candidate['sha'], error=str(failure))
        print('Verification failed. Restoring the previous application once.', flush=True)
        try:
            activate(current)
            if shared_snapshot() != before:
                raise OpsError('Shared infrastructure changed')
            event(action, 'restored', sha=current['sha'])
            (STATE / 'transaction.json').unlink(missing_ok=True)
        except Exception as restoration:
            event(action, 'restoration-failed', error=str(restoration))
            raise OpsError('Rollback failed; inspect transaction.json, history.jsonl and logs. No retry loop.') from restoration
        raise OpsError('Deployment failed; previous application restored. DB was not rolled back.') from failure
    save(STATE / 'previous.json', current)
    save(STATE / 'current.json', candidate)
    (STATE / 'transaction.json').unlink(missing_ok=True)
    event(action, 'success', sha=candidate['sha'], run_id=candidate['run_id'], images=candidate['images'])
    print(f'SUCCESS {action}: {candidate["sha"]}', flush=True)


def main(argv):
    action = argv[0] if argv else ''
    if action not in ('deploy', 'start', 'stop', 'restart', 'status', 'logs', 'rollback'):
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
            target = validate(read(STATE / 'transaction.json')['previous'], local=True)
            before = shared_snapshot()
            activate(target)
            if shared_snapshot() != before:
                raise OpsError('Shared infrastructure changed')
            save(STATE / 'current.json', target)
            (STATE / 'transaction.json').unlink()
            event('rollback', 'recovered-interrupted-operation', sha=target['sha'])
            print(f'SUCCESS recovered previous application: {target["sha"]}')
            return
        current = bootstrap()
        for service, c in zip(SERVICES, containers([f'{PROJECT}-{s}-1' for s in SERVICES])):
            expected = json.loads(command(['docker', 'image', 'inspect', current['images'][service]], capture=True))[0]['Id']
            if c['Image'] != expected:
                raise OpsError('Running images differ from recorded state')
        if action == 'deploy':
            candidate = select_release()
            command(['git', '-C', str(ROOT), 'fetch', '--quiet', 'origin', 'main'])
            command(['git', '-C', str(ROOT), 'merge-base', '--is-ancestor', candidate['sha'], 'origin/main'])
            compatible(candidate, schema_version())
            for service in SERVICES:
                command(['docker', 'pull', candidate['images'][service]])
            verify_images(candidate)
            if candidate['images'] == current['images']:
                health(current)
                print(f'Already running latest verified release {current["sha"]}')
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
