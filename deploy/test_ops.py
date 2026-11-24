import copy
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

spec = importlib.util.spec_from_file_location('ops', Path(__file__).with_name('ops.py'))
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)


def release(sha='a' * 40, run=10):
    return dict(format=1, repository=ops.REPO, sha=sha, run_id=run,
                images={s: f'ghcr.io/seulgae/seulgae-tech-lab-{s}@sha256:' + sha[0] * 64 for s in ops.SERVICES},
                db_schema={'min': 1, 'max': 1})


class OperationsTests(unittest.TestCase):
    def test_supported_schemas_match_versioned_migration_files(self):
        versions = tuple(sorted(int(path.name.split('__', 1)[0][1:])
                                for path in (ops.ROOT / 'backend/src/main/resources/db/migration').glob('V*__*.sql')))
        self.assertEqual(ops.SUPPORTED_SCHEMAS, versions,
                         '새 마이그레이션 추가 시 배포 사전 검사 허용 목록도 갱신해야 한다')

    def test_v23_still_requires_a_release_that_declares_it(self):
        current = release()
        current['db_schema'] = {'min': 23, 'max': 23}
        ops.compatible(current, 23)
        for version in (0, 22, 24):
            with self.assertRaises(ops.OpsError):
                ops.compatible(current, version)
        current['db_schema'] = {'min': 22, 'max': 22}
        with self.assertRaises(ops.OpsError):
            ops.compatible(current, 23)

    def shared_containers(self):
        return [dict(Name='/' + name, Id=name, RestartCount=0,
                     State=dict(Running=index >= 2, Status='running' if index >= 2 else 'exited',
                                StartedAt='baseline', Health={'Status': 'healthy'}))
                for index, name in enumerate(ops.SHARED)]

    def test_intentionally_stopped_invencore_is_preserved_without_health_request(self):
        with patch.object(ops, 'container_names', return_value=set(ops.SHARED)), \
                patch.object(ops, 'containers', return_value=self.shared_containers()), \
                patch.object(ops, 'request_json') as request:
            snapshot = ops.shared_snapshot()
            self.assertEqual(snapshot['/' + ops.SHARED[0]][3:], [False, 'exited'])
            request.assert_not_called()

    def test_stopped_shared_database_is_rejected(self):
        data = self.shared_containers()
        data[-1]['State']['Running'] = False
        with patch.object(ops, 'container_names', return_value=set(ops.SHARED)), \
                patch.object(ops, 'containers', return_value=data), self.assertRaises(ops.OpsError):
            ops.shared_snapshot()

    def test_sha_arguments_are_not_accepted(self):
        with self.assertRaises(ops.OpsError):
            ops.main(['deploy', 'a' * 40])

    def test_mutating_operations_share_a_nonblocking_lock(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(ops, 'STATE', Path(directory)):
            with (ops.STATE / 'operations.lock').open('a') as lock:
                ops.fcntl.flock(lock, ops.fcntl.LOCK_EX | ops.fcntl.LOCK_NB)
                with self.assertRaisesRegex(ops.OpsError, 'Another'):
                    ops.main(['deploy'])

    def test_manifest_rejects_tags_other_registries_and_remote_legacy(self):
        for ref in ['ghcr.io/seulgae/seulgae-tech-lab-backend:latest', 'evil.example/backend@sha256:' + 'a' * 64, 'x\nOTHER=evil']:
            data = release()
            data['images']['backend'] = ref
            with self.assertRaises(ops.OpsError):
                ops.validate(data)
        data = release()
        data['legacy'] = True
        with self.assertRaises(ops.OpsError):
            ops.validate(data)

    def test_only_successful_main_published_run_is_selected(self):
        valid = dict(id=10, status='completed', conclusion='success', head_branch='main', event='push',
                     head_repository={'full_name': ops.REPO}, head_sha='a' * 40)
        cases = [dict(valid, id=15, conclusion='failure'), dict(valid, id=14, status='in_progress'),
                 dict(valid, id=13, event='pull_request'), dict(valid, id=12, head_branch='codex/test'),
                 dict(valid, id=11), valid]
        def fetch(url, api=False):
            if api:
                return {'workflow_runs': cases}
            if 'run-11/' in url:
                raise urllib.error.HTTPError(url, 404, '', {}, None)
            return release()
        self.assertEqual(ops.select_release(fetch)['run_id'], 10)

    def test_ci_sha_mismatch_stops_instead_of_falling_back(self):
        run = dict(id=10, status='completed', conclusion='success', head_branch='main', event='push',
                   head_repository={'full_name': ops.REPO}, head_sha='b' * 40)
        with self.assertRaises(ops.OpsError):
            ops.select_release(lambda url, api=False: {'workflow_runs': [run]} if api else release())

    def test_no_eligible_release_stops(self):
        with self.assertRaises(ops.OpsError):
            ops.select_release(lambda *args, **kwargs: {'workflow_runs': []})

    def test_schema_range_rejects_incompatible_rollback(self):
        ops.compatible(release(), 1)
        for version in (0, 2):
            with self.assertRaises(ops.OpsError):
                ops.compatible(release(), version)

    def test_failed_activation_restores_once_and_keeps_success_state(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(ops, 'STATE', Path(directory)), \
                patch.object(ops, 'shared_snapshot', return_value={}), patch.object(ops, 'schema_version', return_value=1):
            old, new = release(), release('b' * 40, 11)
            ops.save(ops.STATE / 'current.json', old)
            with patch.object(ops, 'activate', side_effect=[ops.OpsError('simulated failure'), None]) as activate:
                with self.assertRaises(ops.OpsError):
                    ops.transact(new, old, 'deploy')
                self.assertEqual(activate.call_args_list[1].args[0], old)
                self.assertEqual(activate.call_count, 2)
            self.assertEqual(ops.read(ops.STATE / 'current.json'), old)
            self.assertFalse((ops.STATE / 'transaction.json').exists())

    def test_failed_restoration_retains_recovery_record_without_loop(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(ops, 'STATE', Path(directory)), \
                patch.object(ops, 'shared_snapshot', return_value={}), patch.object(ops, 'schema_version', return_value=1), \
                patch.object(ops, 'activate', side_effect=ops.OpsError('simulated failure')) as activate:
            with self.assertRaises(ops.OpsError):
                ops.transact(release('b' * 40, 11), release(), 'deploy')
            self.assertEqual(activate.call_count, 2)
            self.assertTrue((ops.STATE / 'transaction.json').exists())

    def test_compose_targets_only_fixed_project_and_validated_images(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(ops, 'STATE', Path(directory)):
            with ops.compose_args(release()) as args:
                self.assertEqual(args[args.index('--project-name') + 1], 'seulgae-tech-lab')
                content = Path(args[args.index('--env-file') + 1]).read_text()
                self.assertIn('BACKEND_IMAGE=ghcr.io/', content)
                self.assertNotIn('PASSWORD', content)

    def fake_git(self, head, dirty='', ancestor=True):
        calls = []

        def git(args, capture=False):
            calls.append(args[3:])
            if args[3] == 'merge-base' and not ancestor:
                raise ops.OpsError('Command failed (1): git -C')
            if args[3] == 'rev-parse':
                return head
            if args[3] == 'status':
                return dirty
            return ''
        return git, calls

    def test_checkout_already_at_release_is_left_alone(self):
        git, calls = self.fake_git('a' * 40)
        self.assertFalse(ops.sync_checkout(release(), git))
        self.assertEqual([call[0] for call in calls], ['fetch', 'merge-base', 'rev-parse'])

    def test_stale_checkout_is_detached_at_the_release_commit(self):
        git, calls = self.fake_git('b' * 40)
        self.assertTrue(ops.sync_checkout(release(), git))
        self.assertEqual(calls[-1], ['checkout', '--quiet', '--detach', 'a' * 40])

    def test_checkout_with_local_changes_or_foreign_release_is_not_moved(self):
        git, calls = self.fake_git('b' * 40, dirty=' M compose.yml')
        with self.assertRaisesRegex(ops.OpsError, 'local changes'):
            ops.sync_checkout(release(), git)
        self.assertNotIn('checkout', [call[0] for call in calls])
        git, calls = self.fake_git('b' * 40, ancestor=False)
        with self.assertRaises(ops.OpsError):
            ops.sync_checkout(release(), git)
        self.assertNotIn('checkout', [call[0] for call in calls])

    def test_deploy_reexecutes_release_ops_before_preflight_once_checkout_moves(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(ops, 'STATE', Path(directory)), \
                patch.dict(os.environ, {}, clear=False), \
                patch.object(ops, 'select_release', return_value=release()), \
                patch.object(ops, 'sync_checkout', return_value=True), \
                patch.object(ops, 'preflight') as preflight, \
                patch.object(ops.os, 'execv', side_effect=SystemExit('exec')) as execv:
            os.environ.pop(ops.SYNCED_ENV, None)
            with self.assertRaises(SystemExit):
                ops.main(['deploy'])
            preflight.assert_not_called()
            self.assertEqual(execv.call_args.args[1][-2:], [str(ops.ROOT / 'deploy' / 'ops.py'), 'deploy'])
            self.assertEqual(os.environ[ops.SYNCED_ENV], 'a' * 40)

    def test_reexecuted_deploy_does_not_sync_before_preflight_again(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(ops, 'STATE', Path(directory)), \
                patch.dict(os.environ, {ops.SYNCED_ENV: 'a' * 40}), \
                patch.object(ops, 'sync_checkout') as sync, \
                patch.object(ops, 'preflight', side_effect=ops.OpsError('stop after preflight')):
            with self.assertRaisesRegex(ops.OpsError, 'stop after preflight'):
                ops.main(['deploy'])
            sync.assert_not_called()


if __name__ == '__main__':
    unittest.main()
