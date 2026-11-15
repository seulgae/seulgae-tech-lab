import copy
import importlib.util
import json
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
    def shared_containers(self):
        return [dict(Name='/' + name, Id=name, RestartCount=0,
                     State=dict(Running=index >= 2, Status='running' if index >= 2 else 'exited',
                                StartedAt='baseline', Health={'Status': 'healthy'}))
                for index, name in enumerate(ops.SHARED)]

    def test_intentionally_stopped_invencore_is_preserved_without_health_request(self):
        with patch.object(ops, 'containers', return_value=self.shared_containers()), \
                patch.object(ops, 'request_json') as request:
            snapshot = ops.shared_snapshot()
            self.assertEqual(snapshot['/' + ops.SHARED[0]][3:], [False, 'exited'])
            request.assert_not_called()

    def test_stopped_shared_database_is_rejected(self):
        data = self.shared_containers()
        data[-1]['State']['Running'] = False
        with patch.object(ops, 'containers', return_value=data), self.assertRaises(ops.OpsError):
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


if __name__ == '__main__':
    unittest.main()
