import importlib.util
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parent))
spec = importlib.util.spec_from_file_location('migrate_prod', Path(__file__).with_name('migrate-prod.py'))
migrate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migrate)


def release(minimum, maximum):
    return {'sha': 'a' * 40, 'db_schema': {'min': minimum, 'max': maximum}}


class MigrationPlanTests(unittest.TestCase):
    def test_current_v22_needs_no_migration(self):
        self.assertIsNone(migrate.migration_plan(22, release(21, 22), release(21, 22)))

    def test_v21_migrates_to_v22_while_the_contract_release_is_running(self):
        self.assertEqual(migrate.migration_plan(21, release(21, 22), release(21, 22)), 22)
        self.assertEqual(migrate.migration_plan(21, release(22, 22), release(21, 22)), 22)

    def test_older_databases_migrate_to_v22(self):
        for version in (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20):
            self.assertEqual(migrate.migration_plan(version, release(22, 22)), 22)

    def test_running_release_that_needs_v21_only_is_protected(self):
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Running release does not support schema V22'):
            migrate.migration_plan(21, release(21, 22), release(21, 21))

    def test_old_release_or_unknown_schema_is_refused_without_changes(self):
        with self.assertRaisesRegex(migrate.ops.OpsError, 'declare schema V22'):
            migrate.migration_plan(21, release(21, 21))
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Unsupported'):
            migrate.migration_plan(23, release(21, 22))
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Unsupported'):
            migrate.migration_plan(-1, release(21, 22))

if __name__ == '__main__':
    unittest.main()
