#!/bin/sh
# Backup periódico do PostgreSQL. Arquivos em deploy/backups/ (fora do Git).
# Restaurar: veja docs/deploy.md, seção "Backup e restauração".
set -eu
KEEP="${BACKUP_KEEP_DAYS:-14}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"

while true; do
  FILE="/backups/lume-$(date -u +%Y%m%dT%H%M%SZ).dump"
  if pg_dump --format=custom --no-owner --file="$FILE.partial"; then
    mv "$FILE.partial" "$FILE"
    echo "backup ok: $FILE ($(du -h "$FILE" | cut -f1))"
  else
    rm -f "$FILE.partial"
    echo "backup FALHOU em $(date -u)" >&2
  fi
  find /backups -name 'lume-*.dump' -mtime +"$KEEP" -delete
  sleep "$INTERVAL"
done
