# Affaires schema migration runbook

This runbook covers the two Affaire schema migrations currently in the repository:

| Migration | Change | Data impact |
|---|---|---|
| `20261011121000_add_affaire_roe` | Adds nullable `Affaire.roe DECIMAL(15,6)` | Adds a nullable column; existing rows are unchanged |
| `20261011124500_add_affaire_charge_dossier` | Adds nullable `Affaire.chargeDossier TEXT` | Adds a nullable column; existing rows are unchanged |

Both migration scripts use `ADD COLUMN IF NOT EXISTS`. They are safe to run when the corresponding column already exists with the expected type. The Prisma migration ledger still needs to record each migration as applied.

## Current status and important distinction

- Both migration folders are present under `server/prisma/migrations`.
- The `roe` SQL was previously run manually by the user against a database, but the target environment and Prisma migration-ledger status have not been verified here.
- The `chargeDossier` migration has **not** been applied by the assistant.
- No production database was inspected or changed while preparing this runbook.
- Prisma Client generation was previously completed. This runbook does not run a build or tests.

Do not assume the manual `roe` SQL was run against both development and production. Check each database independently.

## Rules for applying the changes

1. Apply migrations to each database environment that needs the new fields (for example, development and production). A migration applied to one database does not apply it to another.
2. Use `prisma migrate deploy` to apply and record the repository migrations. Do not run `prisma migrate dev` against production.
3. Do not manually run the `ALTER TABLE` statements as well as `prisma migrate deploy`. If a column was manually added already, the idempotent migration can run and record the migration, provided the existing column has the expected type.
4. Never paste or print the production `DATABASE_URL`. Ensure the command is connected to the intended database before applying anything.
5. If a column exists with an unexpected type, stop and have the database owner review it before running migrations.

## A. Development database — Windows PowerShell

Run from the repository checkout. Ensure the server's `.env` points to the development database, not production.

```powershell
Set-Location D:\house_md\reinsurance_ars\server

# Check which repository migrations Prisma considers pending.
npx prisma migrate status

# Apply all pending migrations in order, including the ROE and chargeDossier migrations.
npx prisma migrate deploy

# Confirm that the migration history is now up to date.
npx prisma migrate status
```

If the local Prisma Client needs regeneration after updating the schema, run:

```powershell
npm run prisma:generate
```

Prisma Client generation is not a database migration. It was already completed for the current schema; run it again only if the schema or generated client has since changed.

## B. Production database

Perform this during the approved deployment window, using the production host's existing deployment procedure.

### 1. Prepare and back up

- Confirm that the release contains both migration folders listed above.
- Confirm through the production secret/environment configuration that `DATABASE_URL` points to the intended production database. Do not display the URL in terminal output, logs, screenshots, or chat.
- Take and verify a database backup using the organization's normal backup procedure before applying schema changes.

If PostgreSQL client tools are installed and your DBA has supplied the correct connection details, a custom-format backup can be made with:

```bash
pg_dump --format=custom --file="ars-before-affaire-migrations.dump" \
  --host="<DB_HOST>" --username="<DB_USER>" --dbname="<DB_NAME>" --password
```

Replace the placeholders with the approved production connection details. `--password` prompts for the password rather than putting it in shell history. Store the backup securely and verify that the file was created. If production is managed by a cloud provider, use its approved backup/snapshot process instead.

### 2. Check the target and current migration state

From the deployed repository's `server` directory, in the production environment where `DATABASE_URL` is configured:

```bash
cd /path/to/reinsurance_ars/server

# Review pending migrations before applying them.
npx prisma migrate status
```

Before continuing, confirm that this is the intended production database and that the two Affaire migrations are the expected pending changes. If the status reports unrelated migration drift or unexpected pending migrations, stop and investigate rather than proceeding.

### 3. Apply and verify

```bash
# Applies pending migrations and records them in _prisma_migrations.
npx prisma migrate deploy

# Confirm that there are no pending migrations.
npx prisma migrate status
```

To verify the columns and their types with PostgreSQL, connect using approved production credentials and run:

```sql
SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Affaire'
  AND column_name IN ('roe', 'chargeDossier')
ORDER BY column_name;
```

Expected results: `chargeDossier` is nullable text; `roe` is nullable numeric with precision 15 and scale 6. Also confirm both migration names appear in the Prisma `_prisma_migrations` table with a non-null `finished_at`.

### 4. Deploy the application code

After the schema migration succeeds, deploy the application release containing the Affaire changes using the existing production deployment pipeline. The application release must include a Prisma Client generated from the current `server/prisma/schema.prisma`. This runbook does not prescribe a build or test command.

## If `roe` was manually added already

The repository migration for ROE is also idempotent. If `roe` already exists as nullable `DECIMAL(15,6)` but its migration is pending in Prisma's ledger, `npx prisma migrate deploy` can run the migration file and record it without changing existing values. Do not manually execute its SQL again. If the existing column definition differs from the expected type or nullability, stop and ask the database owner to review it first.

## What must be applied where?

For **each** target database, run the status check and then `npx prisma migrate deploy` once. Prisma applies whichever repository migrations are pending in that database. In a fresh or not-yet-migrated database this includes both `roe` and `chargeDossier`; if one is already recorded in that database's Prisma ledger, Prisma skips it and applies only the remaining pending migration(s).

Do not run the migrations against production just because they were applied locally, or assume production has them because the `roe` SQL was run manually in an unspecified database.

PS D:\house_md\reinsurance_ars\server> npx prisma migrate resolve --applied 20261011121000_add_affaire_roe
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "ars_reinsurance", schema "public" at "localhost:5432"

Migration 20261011121000_add_affaire_roe marked as applied.

PS D:\house_md\reinsurance_ars\server> npx prisma migrate resolve --applied 20261011124500_add_affaire_charge_dossier
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "ars_reinsurance", schema "public" at "localhost:5432"

Migration 20261011124500_add_affaire_charge_dossier marked as applied.

PS D:\house_md\reinsurance_ars\server> npx prisma migrate status
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "ars_reinsurance", schema "public" at "localhost:5432"

20 migrations found in prisma/migrations

Database schema is up to date!
PS D:\house_md\reinsurance_ars\server> 