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
    def test_current_v3_needs_no_migration(self):
        self.assertIsNone(migrate.migration_plan(3, release(3, 3)))

    def test_empty_v1_and_v2_databases_migrate_to_v3_with_a_v3_release(self):
        for version in (0, 1, 2):
            self.assertEqual(migrate.migration_plan(version, release(3, 3)), 3)

    def test_old_release_or_unknown_schema_is_refused_without_changes(self):
        with self.assertRaisesRegex(migrate.ops.OpsError, 'declare schema V3'):
            migrate.migration_plan(2, release(2, 2))
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Unsupported'):
            migrate.migration_plan(4, release(3, 3))
        with self.assertRaisesRegex(migrate.ops.OpsError, 'Unsupported'):
            migrate.migration_plan(-1, release(3, 3))


if __name__ == '__main__':
    unittest.main()
