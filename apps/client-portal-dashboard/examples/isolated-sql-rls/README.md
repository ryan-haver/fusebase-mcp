# Isolated SQL RLS Example

Minimal app-owned PostgreSQL schema for testing Gate RLS validation and Studio RLS visibility.

Use with this `fusebase.json` fragment:

```json
{
  "apps": [
    {
      "id": "client-portal",
      "path": "apps/client-portal",
      "isolatedStores": {
        "sql": [
          {
            "alias": "client-portal",
            "storeId": "00000000-0000-0000-0000-000000000000",
            "migrationsDir": "postgres/migrations",
            "schemaName": "public",
            "rlsManifestFile": "postgres/migrations/rls-manifest.json"
          }
        ]
      }
    }
  ]
}
```

Commands:

```bash
fusebase isolated-store sql bundle --app client-portal --json
fusebase isolated-store sql bundle --app client-portal --stage dev --status
fusebase isolated-store sql bundle --app client-portal --stage dev --rls-status
fusebase isolated-store sql bundle --app client-portal --stage dev --dry-run
```

The example intentionally leaves `audit_events` without `FORCE ROW LEVEL SECURITY` so Gate/Studio can show an RLS warning.

For real RLS testing, `--rls-status` must report `bypassRls=false`. If it reports `bypassRls=true`, PostgreSQL policies are introspectable but not enforced for runtime queries; use explicit `WHERE current_setting(...)` filters only as a temporary demo workaround.
