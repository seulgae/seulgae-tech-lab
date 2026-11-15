#!/usr/bin/env python3
"""Explicit one-time existing V1 migration. Never called by deploy/start/rollback."""
import fcntl
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import ops


def main():
    if len(sys.argv) != 1:
        raise ops.OpsError('No arguments accepted')
    os.umask(0o077)
    ops.STATE.mkdir(parents=True, exist_ok=True)
    with (ops.STATE / 'operations.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        version = ops.schema_version()
        if version == 1:
            print('Production schema is already V1. No migration performed.')
            return
        if version != 0:
            raise ops.OpsError('Only the initial V1 migration is supported; inspect schema manually')
        release = ops.select_release()
        if release['db_schema'] != {'min': 1, 'max': 1}:
            raise ops.OpsError('Release does not match initial V1 schema')
        ops.command(['git', '-C', str(ops.ROOT), 'fetch', '--quiet', 'origin', 'main'])
        ops.command(['git', '-C', str(ops.ROOT), 'merge-base', '--is-ancestor', release['sha'], 'origin/main'])
        before = ops.shared_snapshot()
        backups = ops.STATE / 'backups'
        backups.mkdir(exist_ok=True)
        backup = backups / ('stlab-prod-before-v1-' + ops.stamp().replace(':', '-') + '.dump')
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
                         'exec mvn -B -f /work/pom.xml -Dflyway.target=1 flyway:migrate flyway:validate'])
        if ops.schema_version() != 1 or ops.shared_snapshot() != before:
            raise ops.OpsError('Post-migration verification failed; inspect backup and logs, no DB auto-restore')
        ops.event('migrate-prod-v1', 'success', sha=release['sha'], backup=str(backup))
        print(f'Production V1 applied and validated. Backup: {backup}. No DB rollback performed.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)
