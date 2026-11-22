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
    def test_current_v11_needs_no_migration(self):
        self.assertIsNone(migrate.migration_plan(11, release(10, 11), release(10, 11)))

    def test_v10_migrates_to_v11_while_the_expand_release_is_running(self):
        self.assertEqual(migrate.migration_plan(10, release(10, 11), release(10, 11)), 11)
        self.assertEqual(migrate.migration_plan(10, release(11, 11), release(10, 11)), 11)

    def test_older_databases_migrate_to_v11(self):
        for version in (0, 1, 2, 3, 4, 5, 6, 7, 8, 9):
            self.assertEqual(migrate.migration_plan(version, release(11, 11)), 11)

    def test_running_release_that_needs_v10_only_is_protected(self):
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Running release does not support schema V11'):
            migrate.migration_plan(10, release(10, 11), release(10, 10))

    def test_old_release_or_unknown_schema_is_refused_without_changes(self):
        with self.assertRaisesRegex(migrate.ops.OpsError, 'declare schema V11'):
            migrate.migration_plan(10, release(10, 10))
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Unsupported'):
            migrate.migration_plan(12, release(10, 11))
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Unsupported'):
            migrate.migration_plan(-1, release(10, 11))

if __name__ == '__main__':
    unittest.main()
