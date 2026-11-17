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
    def test_current_v4_needs_no_migration(self):
        self.assertIsNone(migrate.migration_plan(4, release(3, 4), release(3, 4)))

    def test_v3_migrates_to_v4_while_the_expand_release_is_running(self):
        self.assertEqual(migrate.migration_plan(3, release(3, 4), release(3, 4)), 4)
        self.assertEqual(migrate.migration_plan(3, release(4, 4), release(3, 4)), 4)

    def test_empty_v1_and_v2_databases_migrate_to_v4(self):
        for version in (0, 1, 2):
            self.assertEqual(migrate.migration_plan(version, release(4, 4)), 4)

    def test_running_release_that_needs_v3_only_is_protected(self):
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Running release does not support schema V4'):
            migrate.migration_plan(3, release(3, 4), release(3, 3))

    def test_old_release_or_unknown_schema_is_refused_without_changes(self):
        with self.assertRaisesRegex(migrate.ops.OpsError, 'declare schema V4'):
            migrate.migration_plan(3, release(3, 3))
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Unsupported'):
            migrate.migration_plan(5, release(3, 4))
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Unsupported'):
            migrate.migration_plan(-1, release(3, 4))


if __name__ == '__main__':
    unittest.main()
