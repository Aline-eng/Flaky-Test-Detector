#!/bin/sh
set -e

npx prisma migrate deploy --schema server/prisma/schema.prisma

exec "$@"
