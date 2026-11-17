#!/usr/bin/env python3
"""Explicit production migration up to the latest schema (V6). Never called by deploy/start/rollback.

Supported paths: empty DB or V1-V5 -> V6. A verified pg_dump backup is taken first;
there is no automatic DB rollback.

Expand-then-use: a schema change first ships in a release whose db_schema range already includes the
new version (for V6: 5..6), so it deploys on the old schema. This script then migrates while that
release keeps running, and only afterwards does code that needs the new schema (6..6) get merged.
"""
import fcntl
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import ops

LATEST_SCHEMA = 6


def migration_plan(version, release, running=None):
    """Return the target schema, or None when production is already current.

    release: latest main release (source of the migration files); its range must include the target.
    running: release currently serving production (current.json); when present it must also accept
    the target, so migrating never breaks the live application.
    """
    if version == LATEST_SCHEMA:
        return None
    if not 0 <= version < LATEST_SCHEMA:
        raise ops.OpsError(f'Unsupported production schema V{version}; inspect schema manually')
    if not release['db_schema']['min'] <= LATEST_SCHEMA <= release['db_schema']['max']:
        raise ops.OpsError(f'Release does not declare schema V{LATEST_SCHEMA}')
    if running and not running['db_schema']['min'] <= LATEST_SCHEMA <= running['db_schema']['max']:
        raise ops.OpsError(f'Running release does not support schema V{LATEST_SCHEMA}; deploy the expand release first')
    return LATEST_SCHEMA


def main():
    if len(sys.argv) != 1:
        raise ops.OpsError('No arguments accepted')
    os.umask(0o077)
    ops.STATE.mkdir(parents=True, exist_ok=True)
    with (ops.STATE / 'operations.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        version = ops.schema_version()
        if version == LATEST_SCHEMA:
            print(f'Production schema is already V{LATEST_SCHEMA}. No migration performed.')
            return
        release = ops.select_release()
        target = migration_plan(version, release, ops.read(ops.STATE / 'current.json'))
        ops.command(['git', '-C', str(ops.ROOT), 'fetch', '--quiet', 'origin', 'main'])
        ops.command(['git', '-C', str(ops.ROOT), 'merge-base', '--is-ancestor', release['sha'], 'origin/main'])
        before = ops.shared_snapshot()
        backups = ops.STATE / 'backups'
        backups.mkdir(exist_ok=True)
        backup = backups / (f'stlab-prod-before-v{target}-' + ops.stamp().replace(':', '-') + '.dump')
        with backup.open('wb') as f:
            subprocess.run(['docker', 'exec', 'postgres-postgres-1', 'sh', '-c',
                            'exec pg_dump -Fc -U "$POSTGRES_USER" -d stlab_prod'], stdout=f, check=True)
        if backup.stat().st_size == 0:
            raise ops.OpsError('Backup is empty')
        with backup.open('rb') as f:
            subprocess.run(['docker', 'exec', '-i', 'postgres-postgres-1', 'pg_restore', '--list'],
                           stdin=f, stdout=subprocess.DEVNULL, check=True)
        with tempfile.TemporaryDirectory(dir=ops.STATE) as directory:
            directory = Path(directory)
            archive = directory / 'source.tar'
            with archive.open('wb') as f:
                subprocess.run(['git', '-C', str(ops.ROOT), 'archive', release['sha'], 'backend'], stdout=f, check=True)
            # The archive is generated from the trusted main commit above, not downloaded input.
            ops.command(['tar', '-xf', str(archive), '-C', str(directory)])
            cache = ops.STATE / 'maven-cache'
            cache.mkdir(exist_ok=True)
            password = ops.STATE.parent / 'prod-migrator-password'
            if not password.is_file():
                raise ops.OpsError('Production migration credential file missing')
            ops.command(['docker', 'run', '--rm', '--network', 'postgres_backend', '--memory', '768m', '--cpus', '1',
                         '-v', f'{directory}/backend:/work:ro', '-v', f'{cache}:/root/.m2',
                         '-v', f'{password}:/run/secrets/migration-password:ro',
                         '-e', 'DB_URL=jdbc:postgresql://postgres-postgres-1:5432/stlab_prod?currentSchema=lab',
                         '-e', 'DB_USERNAME=stlab_prod_migrator', '-e', 'MAVEN_OPTS=-Xmx512m -XX:ActiveProcessorCount=1',
                         'maven:3.9-eclipse-temurin-17', 'sh', '-c',
                         'export DB_PASSWORD="$(cat /run/secrets/migration-password)"; '
                         f'exec mvn -B -f /work/pom.xml -Dflyway.target={target} flyway:migrate flyway:validate'])
        if ops.schema_version() != target or ops.shared_snapshot() != before:
            raise ops.OpsError('Post-migration verification failed; inspect backup and logs, no DB auto-restore')
        ops.event(f'migrate-prod-v{target}', 'success', sha=release['sha'], backup=str(backup))
        print(f'Production V{target} applied and validated. Backup: {backup}. No DB rollback performed.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)
