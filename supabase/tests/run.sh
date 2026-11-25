#!/usr/bin/env bash
# Corre las migraciones y las pruebas de regresión contra un Postgres vacío.
# Uso: PGURL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."
: "${PGURL:?Define PGURL con la conexión a un Postgres de pruebas (nunca el de producción)}"
psql "$PGURL" -q -v ON_ERROR_STOP=1 -f tests/stubs.sql
for f in migrations/*.sql; do psql "$PGURL" -q -v ON_ERROR_STOP=1 -f "$f"; done
psql "$PGURL" -q -v ON_ERROR_STOP=1 -f tests/regression.sql
