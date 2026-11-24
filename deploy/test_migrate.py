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
    def test_current_v25_needs_no_migration(self):
        self.assertIsNone(migrate.migration_plan(25, release(24, 25), release(24, 25)))

    def test_v24_migrates_to_v25_while_the_contract_release_is_running(self):
        self.assertEqual(migrate.migration_plan(24, release(24, 25), release(24, 25)), 25)
        self.assertEqual(migrate.migration_plan(24, release(25, 25), release(24, 25)), 25)

    def test_older_databases_migrate_to_v25(self):
        for version in (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23):
            self.assertEqual(migrate.migration_plan(version, release(25, 25)), 25)

    def test_running_release_that_needs_v24_only_is_protected(self):
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Running release does not support schema V25'):
            migrate.migration_plan(24, release(24, 25), release(24, 24))

    def test_old_release_or_unknown_schema_is_refused_without_changes(self):
        with self.assertRaisesRegex(migrate.ops.OpsError, 'declare schema V25'):
            migrate.migration_plan(24, release(24, 24))
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Unsupported'):
            migrate.migration_plan(26, release(24, 25))
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Unsupported'):
            migrate.migration_plan(-1, release(24, 25))

if __name__ == '__main__':
    unittest.main()
