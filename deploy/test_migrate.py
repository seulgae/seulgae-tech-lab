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
    def test_current_v17_needs_no_migration(self):
        self.assertIsNone(migrate.migration_plan(17, release(16, 17), release(16, 17)))

    def test_v16_migrates_to_v17_while_the_contract_release_is_running(self):
        self.assertEqual(migrate.migration_plan(16, release(16, 17), release(16, 17)), 17)
        self.assertEqual(migrate.migration_plan(16, release(17, 17), release(16, 17)), 17)

    def test_older_databases_migrate_to_v17(self):
        for version in (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15):
            self.assertEqual(migrate.migration_plan(version, release(17, 17)), 17)

    def test_running_release_that_needs_v16_only_is_protected(self):
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Running release does not support schema V17'):
            migrate.migration_plan(16, release(16, 17), release(16, 16))

    def test_old_release_or_unknown_schema_is_refused_without_changes(self):
        with self.assertRaisesRegex(migrate.ops.OpsError, 'declare schema V17'):
            migrate.migration_plan(16, release(16, 16))
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Unsupported'):
            migrate.migration_plan(18, release(16, 17))
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Unsupported'):
            migrate.migration_plan(-1, release(16, 17))

if __name__ == '__main__':
    unittest.main()
