"""Validate real Compose interpolation in CI without starting containers or contacting Docker Engine."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


@unittest.skipUnless(shutil.which('docker'), 'Docker Compose CLI is checked on Ubuntu CI')
class ComposeTests(unittest.TestCase):
    def test_release_configuration_has_only_app_and_external_postgres(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as directory:
            env = dict(os.environ, STLAB_SECRETS_DIR=directory,
                       BACKEND_IMAGE='ghcr.io/seulgae/seulgae-tech-lab-backend@sha256:' + 'a' * 64,
                       FRONTEND_IMAGE='ghcr.io/seulgae/seulgae-tech-lab-frontend@sha256:' + 'b' * 64)
            result = subprocess.run(['docker', 'compose', '--project-directory', str(root),
                                     '-f', str(root / 'compose.yml'), '-f', str(root / 'deploy/compose.release.yml'),
                                     'config', '--format', 'json'], env=env, capture_output=True, text=True, check=True)
            config = json.loads(result.stdout)
        self.assertEqual(set(config['services']), {'backend', 'frontend'})
        self.assertEqual(config['networks']['database']['name'], 'postgres_backend')
        self.assertTrue(config['networks']['database']['external'])
        backend = config['services']['backend']
        self.assertEqual(backend['environment']['SPRING_FLYWAY_ENABLED'], 'false')
        self.assertEqual(backend['environment']['SPRING_SQL_INIT_MODE'], 'never')
        self.assertEqual(backend['environment']['DB_USERNAME'], 'stlab_prod_app')
        self.assertNotIn('DB_PASSWORD', backend['environment'])
        self.assertEqual(backend['image'], env['BACKEND_IMAGE'])
        self.assertEqual(backend['secrets'], [{'source': 'prod_db_password', 'target': 'DB_PASSWORD'}])
        self.assertEqual(set(config['secrets']), {'prod_db_password'})
        self.assertNotIn('homeserver-net', str(config))
