"""First install/update/recovery run entirely against disposable state and fake Docker."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from test_ops import ops, release


def container(name, running=True):
    service = name.removeprefix(ops.PROJECT + '-').removesuffix('-1')
    return dict(Name='/' + name, Id=name, Image='sha256:' + 'a' * 64, RestartCount=0,
                Config={'Image': 'local:' + 'a' * 40, 'Labels': {
                    'com.docker.compose.project': ops.PROJECT, 'com.docker.compose.service': service}},
                State=dict(Running=running, Status='running' if running else 'exited',
                           StartedAt='baseline', Health={'Status': 'healthy'}),
                NetworkSettings={'Networks': {ops.DATABASE_NETWORK: {}}})


class BootstrapTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.state = Path(self.directory.name)
        self.enterContext(patch.object(ops, 'STATE', self.state))

    def test_new_host_only_requires_postgres_and_preserves_new_kafka(self):
        for names in ({ops.DATABASE}, {ops.DATABASE, 'kafka-kafka-1'}):
            with patch.object(ops, 'container_names', return_value=names), \
                    patch.object(ops, 'containers', side_effect=lambda ns: [container(n) for n in ns]) as inspect, \
                    patch.object(ops, 'request_json') as http:
                snapshot = ops.shared_snapshot()
                self.assertEqual(set(snapshot), {'/' + n for n in names})
                self.assertEqual(set(inspect.call_args.args[0]), names)
                http.assert_not_called()

    def test_absent_or_unhealthy_postgres_stops(self):
        with patch.object(ops, 'container_names', return_value=set()), self.assertRaises(ops.OpsError):
            ops.shared_snapshot()
        pg = container(ops.DATABASE)
        pg['State']['Health']['Status'] = 'unhealthy'
        with patch.object(ops, 'container_names', return_value={ops.DATABASE}), \
                patch.object(ops, 'containers', return_value=[pg]), self.assertRaises(ops.OpsError):
            ops.shared_snapshot()

    def test_empty_host_bootstrap_does_not_create_fake_previous_release(self):
        with patch.object(ops, 'application_containers', return_value=[]):
            self.assertIsNone(ops.bootstrap())
        self.assertFalse((self.state / 'current.json').exists())

    def test_partial_existing_app_and_foreign_name_collision_are_rejected(self):
        data = [container(ops.PROJECT + '-backend-1')]
        with patch.object(ops, 'application_containers', return_value=data), self.assertRaises(ops.OpsError):
            ops.bootstrap()
        data[0]['Config']['Labels']['com.docker.compose.project'] = 'another-project'
        with patch.object(ops, 'container_names', return_value={data[0]['Name'].lstrip('/')}), \
                patch.object(ops, 'containers', return_value=data), self.assertRaises(ops.OpsError):
            ops.application_containers()

    def test_existing_legacy_app_can_still_be_adopted(self):
        data = [container(ops.PROJECT + '-' + s + '-1') for s in reversed(ops.SERVICES)]
        with patch.object(ops, 'application_containers', return_value=data), patch.object(ops, 'health'):
            current = ops.bootstrap()
        self.assertTrue(current['legacy'])
        self.assertEqual(ops.read(self.state / 'current.json'), current)

    def test_first_success_then_update_then_explicit_rollback(self):
        old, new = release(), release('b' * 40, 11)
        with patch.object(ops, 'shared_snapshot', return_value={'pg': ['stable']}), \
                patch.object(ops, 'schema_version', return_value=1), patch.object(ops, 'activate') as activate:
            ops.transact(old, None, 'deploy')
            self.assertEqual(ops.read(self.state / 'current.json'), old)
            self.assertFalse((self.state / 'previous.json').exists())
            ops.transact(new, old, 'deploy')
            self.assertEqual(ops.read(self.state / 'previous.json'), old)
            ops.transact(old, new, 'rollback')
            self.assertEqual(ops.read(self.state / 'current.json'), old)
            self.assertEqual(ops.read(self.state / 'previous.json'), new)
            self.assertEqual(activate.call_count, 3)
            self.assertFalse((self.state / 'transaction.json').exists())

    def test_initial_failure_cleans_only_app_and_can_retry(self):
        candidate = release()
        with patch.object(ops, 'shared_snapshot', return_value={}), \
                patch.object(ops, 'schema_version', return_value=1), \
                patch.object(ops, 'activate', side_effect=ops.OpsError('unhealthy')), \
                patch.object(ops, 'verify_running_images') as verify, \
                patch.object(ops, 'application_containers', return_value=[]), patch.object(ops, 'compose') as compose:
            with self.assertRaises(ops.OpsError):
                ops.transact(candidate, None, 'deploy')
            verify.assert_called_once_with(candidate, partial=True)
            compose.assert_called_once_with(candidate, 'rm', '--stop', '--force', *ops.SERVICES)
        self.assertFalse((self.state / 'current.json').exists())
        self.assertFalse((self.state / 'previous.json').exists())
        self.assertFalse((self.state / 'transaction.json').exists())
        with patch.object(ops, 'shared_snapshot', return_value={}), \
                patch.object(ops, 'schema_version', return_value=1), patch.object(ops, 'activate'):
            ops.transact(candidate, None, 'deploy')
        self.assertEqual(ops.read(self.state / 'current.json'), candidate)

    def test_failed_initial_cleanup_retains_transaction_for_explicit_recovery(self):
        candidate = release()
        with patch.object(ops, 'shared_snapshot', return_value={}), \
                patch.object(ops, 'schema_version', return_value=1), \
                patch.object(ops, 'activate', side_effect=ops.OpsError('unhealthy')), \
                patch.object(ops, 'clean_initial', side_effect=ops.OpsError('cannot clean')) as cleanup:
            with self.assertRaisesRegex(ops.OpsError, 'Rollback failed'):
                ops.transact(candidate, None, 'deploy')
            self.assertEqual(cleanup.call_count, 1)
        self.assertIsNone(ops.read(self.state / 'transaction.json')['previous'])
        with patch.object(ops, 'shared_snapshot', return_value={}), patch.object(ops, 'clean_initial') as cleanup:
            ops.main(['rollback'])
            cleanup.assert_called_once_with(candidate, {})
        self.assertFalse((self.state / 'transaction.json').exists())
        self.assertFalse((self.state / 'current.json').exists())

    def test_database_incompatibility_never_activates_or_creates_transaction(self):
        with patch.object(ops, 'shared_snapshot', return_value={}), \
                patch.object(ops, 'schema_version', return_value=0), patch.object(ops, 'activate') as activate:
            with self.assertRaises(ops.OpsError):
                ops.transact(release(), None, 'deploy')
            activate.assert_not_called()
        self.assertFalse((self.state / 'transaction.json').exists())

    def test_initial_recovery_clears_state_saved_just_before_process_interruption(self):
        candidate = release()
        ops.save(self.state / 'current.json', candidate)
        with patch.object(ops, 'verify_running_images'), patch.object(ops, 'compose'), \
                patch.object(ops, 'application_containers', return_value=[]), \
                patch.object(ops, 'shared_snapshot', return_value={}):
            ops.clean_initial(candidate, {})
        self.assertFalse((self.state / 'current.json').exists())

    def test_shared_change_causes_failure_even_when_candidate_is_healthy(self):
        with patch.object(ops, 'shared_snapshot', side_effect=[{'pg': 1}, {'pg': 2}, {'pg': 2}]), \
                patch.object(ops, 'schema_version', return_value=1), patch.object(ops, 'activate'), \
                self.assertRaisesRegex(ops.OpsError, 'Rollback failed'):
            ops.transact(release('b' * 40, 11), release(), 'deploy')
        self.assertTrue((self.state / 'transaction.json').exists())

    def test_deploy_main_first_install_then_noop_keeps_image_verification(self):
        candidate = release()
        with patch.object(ops, 'preflight'), patch.object(ops, 'bootstrap', return_value=None), \
                patch.object(ops, 'select_release', return_value=candidate), \
                patch.object(ops, 'schema_version', return_value=1), patch.object(ops, 'command') as command, \
                patch.object(ops, 'sync_checkout', return_value=False) as sync, \
                patch.object(ops, 'verify_images') as verify, patch.object(ops, 'transact') as transact:
            ops.main(['deploy'])
            verify.assert_called_once_with(candidate)
            transact.assert_called_once_with(candidate, None, 'deploy')
            self.assertEqual(sum(c.args[0][:2] == ['docker', 'pull'] for c in command.call_args_list), 2)
            # Checkout is synced (fetch + ancestry check) before preflight and again before activation.
            self.assertEqual([c.args[0] for c in sync.call_args_list], [candidate, candidate])
        with patch.object(ops, 'preflight'), patch.object(ops, 'bootstrap', return_value=candidate), \
                patch.object(ops, 'verify_running_images'), patch.object(ops, 'select_release', return_value=candidate), \
                patch.object(ops, 'schema_version', return_value=1), patch.object(ops, 'command'), \
                patch.object(ops, 'sync_checkout', return_value=False), \
                patch.object(ops, 'verify_images'), patch.object(ops, 'activate') as activate, \
                patch.object(ops, 'transact') as transact:
            ops.main(['deploy'])
            # Same images: Compose is re-applied so config-only changes still roll out, without a transaction.
            activate.assert_called_once_with(candidate)
            transact.assert_not_called()

    def test_failed_image_revision_does_not_activate(self):
        with patch.object(ops, 'preflight'), patch.object(ops, 'bootstrap', return_value=None), \
                patch.object(ops, 'select_release', return_value=release()), patch.object(ops, 'schema_version', return_value=1), \
                patch.object(ops, 'command'), patch.object(ops, 'sync_checkout', return_value=False), \
                patch.object(ops, 'verify_images', side_effect=ops.OpsError('revision')), \
                patch.object(ops, 'transact') as transact, self.assertRaisesRegex(ops.OpsError, 'revision'):
            ops.main(['deploy'])
        transact.assert_not_called()

    def test_schema_queries_are_read_only_and_v1_is_not_migrated(self):
        with patch.object(ops, 'command', side_effect=['lab.flyway_schema_history', '0', '1']) as command:
            self.assertEqual(ops.schema_version(), 1)
            for call in command.call_args_list:
                self.assertTrue(call.kwargs['input'].startswith('BEGIN READ ONLY;'))
                self.assertNotIn('migrate', call.args[0])

    def test_runtime_activation_only_targets_app_services(self):
        with patch.object(ops, 'schema_version', return_value=1), patch.object(ops, 'verify_images') as verify, \
                patch.object(ops, 'compose') as compose, patch.object(ops, 'health') as health:
            candidate = release()
            ops.activate(candidate)
            verify.assert_called_once_with(candidate)
            self.assertEqual(compose.call_args.args[-2:], ops.SERVICES)
            health.assert_called_once_with(candidate)

    def test_cleanup_rejects_images_or_state_replaced_by_another_operator(self):
        data = [container(ops.PROJECT + '-backend-1')]
        with patch.object(ops, 'application_containers', return_value=data), \
                patch.object(ops, 'command', return_value=json.dumps([{'Id': 'sha256:unexpected'}])), \
                patch.object(ops, 'compose') as compose, self.assertRaisesRegex(ops.OpsError, 'images differ'):
            ops.clean_initial(release(), {})
        compose.assert_not_called()
        ops.save(self.state / 'current.json', release('b' * 40, 11))
        with patch.object(ops, 'compose') as compose, self.assertRaisesRegex(ops.OpsError, 'state changed'):
            ops.clean_initial(release(), {})
        compose.assert_not_called()

    def test_uninitialized_or_failed_migration_history_never_gets_repaired(self):
        with patch.object(ops, 'command', return_value='') as command:
            self.assertEqual(ops.schema_version(), 0)
            self.assertEqual(command.call_count, 1)
        with patch.object(ops, 'command', side_effect=['lab.flyway_schema_history', '1']), \
                self.assertRaisesRegex(ops.OpsError, 'Failed migration'):
            ops.schema_version()


@unittest.skipIf(os.name == 'nt', 'POSIX credential permission checks run on Linux CI')
class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        base = Path(self.directory.name)
        self.secret = base / 'secrets'
        self.secret.mkdir(mode=0o700)
        self.state = base / 'ops'
        self.state.mkdir()
        self.enterContext(patch.object(ops, 'STATE', self.state))
        self.enterContext(patch.dict(os.environ, STLAB_SECRETS_DIR=str(self.secret)))
        for name, mode in [('prod-app-password', 0o444), ('prod-migrator-password', 0o600),
                           ('kakao-client-secret', 0o444), ('auth-session-secret', 0o444)]:
            p = self.secret / name
            p.write_text('disposable-test-only-' + 'x' * 32)
            p.chmod(mode)
        self.config = {'services': {'backend': {'environment': {
            'DB_URL': 'jdbc:postgresql://postgres-postgres-1:5432/stlab_prod?currentSchema=lab',
            'DB_USERNAME': 'stlab_prod_app', 'SPRING_SQL_INIT_MODE': 'never',
            'SPRING_FLYWAY_ENABLED': 'false', 'SPRING_CONFIG_IMPORT': 'configtree:/run/secrets/',
            'LAB_MULTIPLAYER_ALLOWED_ORIGINS': 'https://seulgae-home-server.tailac4b36.ts.net,http://127.0.0.1:5188,http://localhost:5188'}}, 'frontend': {}},
            'secrets': {'prod_db_password': {'file': str(self.secret / 'prod-app-password')},
                        'kakao_client_secret': {'file': str(self.secret / 'kakao-client-secret')},
                        'auth_session_secret': {'file': str(self.secret / 'auth-session-secret')}}}
        self.enterContext(patch.object(ops, 'shared_snapshot', return_value={}))
        self.database = container(ops.DATABASE)
        self.enterContext(patch.object(ops, 'containers', return_value=[self.database]))
        self.schema = self.enterContext(patch.object(ops, 'schema_version', return_value=1))
        self.command = self.enterContext(patch.object(ops, 'command', side_effect=self.response))

    def response(self, args, **kwargs):
        if args[:3] == ['docker', 'network', 'inspect']:
            return json.dumps([{'Name': ops.DATABASE_NETWORK}])
        if 'config' in args:
            return json.dumps(self.config)
        return ''

    def test_valid_prerequisites_do_not_start_pull_restart_or_migrate(self):
        ops.preflight()
        for c in self.command.call_args_list:
            self.assertFalse(set(c.args[0]) & {'pull', 'up', 'restart', 'down', 'migrate'})

    def test_missing_short_or_private_login_secrets_are_rejected(self):
        session = self.secret / 'auth-session-secret'
        session.chmod(0o600)
        with self.assertRaisesRegex(ops.OpsError, '10001'):
            ops.preflight()
        session.chmod(0o644)
        session.write_text('too-short')
        session.chmod(0o444)
        with self.assertRaisesRegex(ops.OpsError, 'too short'):
            ops.preflight()
        (self.secret / 'kakao-client-secret').unlink()
        with self.assertRaisesRegex(ops.OpsError, 'kakao-client-secret'):
            ops.preflight()

    def test_existing_v2_to_v6_schemas_are_accepted_but_unknown_versions_are_not(self):
        for version in (2, 3, 4, 5, 6):
            self.schema.return_value = version
            ops.preflight()
        for version in (0, 7):
            self.schema.return_value = version
            with self.assertRaisesRegex(ops.OpsError, 'V1-V6'):
                ops.preflight()

    def test_missing_empty_or_private_app_password_is_rejected(self):
        password = self.secret / 'prod-app-password'
        password.chmod(0o600)
        with self.assertRaisesRegex(ops.OpsError, '10001'):
            ops.preflight()
        password.write_text('')
        with self.assertRaisesRegex(ops.OpsError, 'empty'):
            ops.preflight()
        password.unlink()
        with self.assertRaisesRegex(ops.OpsError, 'Missing'):
            ops.preflight()

    def test_missing_migrator_and_exposed_directory_or_migrator_are_rejected(self):
        self.secret.chmod(0o755)
        with self.assertRaisesRegex(ops.OpsError, '0700'):
            ops.preflight()
        self.secret.chmod(0o700)
        migrator = self.secret / 'prod-migrator-password'
        migrator.chmod(0o644)
        with self.assertRaisesRegex(ops.OpsError, 'private'):
            ops.preflight()
        migrator.unlink()
        with self.assertRaisesRegex(ops.OpsError, 'Missing'):
            ops.preflight()

    def test_missing_postgres_network_membership_rejected(self):
        self.database['NetworkSettings']['Networks'] = {}
        with self.assertRaisesRegex(ops.OpsError, 'attached'):
            ops.preflight()

    def test_relative_secret_directory_is_rejected(self):
        with patch.dict(os.environ, STLAB_SECRETS_DIR='relative'), self.assertRaisesRegex(ops.OpsError, 'absolute'):
            ops.preflight()

    def test_wrong_database_or_migration_settings_stop_before_schema_access(self):
        env = self.config['services']['backend']['environment']
        for key, value in [('DB_USERNAME', 'stlab_prod_migrator'), ('SPRING_SQL_INIT_MODE', 'always'),
                           ('SPRING_FLYWAY_ENABLED', 'true'), ('DB_URL', 'jdbc:wrong')]:
            old = env[key]
            env[key] = value
            with self.assertRaisesRegex(ops.OpsError, 'configuration'):
                ops.preflight()
            env[key] = old
        self.schema.assert_not_called()

    def test_existing_schema_zero_or_unknown_is_rejected_without_migration(self):
        # V2~V6는 지원 범위(SUPPORTED_SCHEMAS)에 들어가므로, 빈 DB와 아직 모르는 V7만 거부한다.
        for version in (0, 7):
            self.schema.return_value = version
            with self.assertRaisesRegex(ops.OpsError, 'No migration'):
                ops.preflight()


if __name__ == '__main__':
    unittest.main()
