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
        self.assertEqual(backend['environment']['LAB_MULTIPLAYER_ALLOWED_ORIGINS'].split(','), [
            'https://seulgae-home-server.tailac4b36.ts.net', 'http://127.0.0.1:5188', 'http://localhost:5188'])
        self.assertEqual(backend['environment']['LAB_MULTIPLAYER_SINGLE_CONNECTION_PER_ADDRESS'], 'true')
        self.assertNotIn('DB_PASSWORD', backend['environment'])
        self.assertEqual(backend['image'], env['BACKEND_IMAGE'])
        self.assertEqual(backend['secrets'], [{'source': 'prod_db_password', 'target': 'DB_PASSWORD'},
                                              {'source': 'kakao_client_secret', 'target': 'lab.auth.kakao.client-secret'},
                                              {'source': 'auth_session_secret', 'target': 'lab.auth.session-secret'}])
        self.assertEqual(set(config['secrets']), {'prod_db_password', 'kakao_client_secret', 'auth_session_secret'})
        self.assertEqual(backend['environment']['LAB_AUTH_KAKAO_REDIRECT_URI'],
                         'https://seulgae-home-server.tailac4b36.ts.net/api/auth/kakao/callback')
        self.assertRegex(backend['environment']['LAB_AUTH_KAKAO_CLIENT_ID'], r'^[0-9a-f]{32}$')
        self.assertNotIn('LAB_AUTH_SESSION_SECRET', backend['environment'])
        # 관리자는 회원 등급(lab.tb_lab_member.level = 3)으로만 정한다. 설정 id 예외는 없다.
        self.assertNotIn('LAB_ADMIN_MEMBER_IDS', backend['environment'])
        self.assertNotIn('LAB_AUTH_KAKAO_CLIENT_SECRET', backend['environment'])
        self.assertNotIn('homeserver-net', str(config))
        # 서버실 용량 조사: 호스트 SSH는 키 폴더를 읽기 전용으로만 받고, 비밀번호 환경 변수는 두지 않는다.
        self.assertEqual(backend['environment']['LAB_CAPACITY_SSH_HOST'], 'host.docker.internal')
        hosts = backend['extra_hosts']
        # Compose 버전에 따라 목록('이름:주소'/'이름=주소') 또는 사전({이름: [주소]})으로 나온다.
        pairs = [f'{k}={v[0] if isinstance(v, list) else v}' for k, v in hosts.items()] if isinstance(hosts, dict) else [h.replace(':', '=', 1) for h in hosts]
        self.assertIn('host.docker.internal=host-gateway', pairs)
        capacity = [v for v in backend['volumes'] if v['target'] == '/run/capacity']
        self.assertEqual(len(capacity), 1)
        self.assertTrue(capacity[0]['read_only'])
        self.assertTrue(capacity[0]['source'].endswith('/capacity'))
        self.assertFalse(any('PASSWORD' in key for key in backend['environment'] if key.startswith('LAB_CAPACITY')))
