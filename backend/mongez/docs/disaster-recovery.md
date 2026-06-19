# Disaster Recovery Runbook — Mongez Backend

This runbook outlines the processes and steps to recover the Mongez platform backend infrastructure in the event of a critical failure or data loss.

## Targets
- **Recovery Time Objective (RTO)**: < 4 hours (maximum acceptable downtime).
- **Recovery Point Objective (RPO)**: < 1 hour (maximum acceptable data loss).

---

## 1. PostgreSQL Recovery
PostgreSQL runs as the primary transactional database. We use a combination of automated daily snapshots and continuous Write-Ahead Log (WAL) archiving (Point-In-Time Recovery - PITR).

### Backup Verification
- Automated backups are scheduled daily at 02:00 UTC using `pg_dump`.
- Backups are stored in an encrypted, geographically isolated S3 bucket (`mongez-backups-prod`).

### Restore Runbook (PITR / Snapshot)

1. **Spin up a new PostgreSQL instance** matching the target version (PG 16).
2. **Retrieve the latest daily snapshot** from the backups bucket:
   ```bash
   aws s3 cp s3://mongez-backups-prod/postgres/daily/pg-backup-latest.sql.gz /tmp/pg-backup.sql.gz
   gunzip /tmp/pg-backup.sql.gz
   ```
3. **Restore the snapshot database**:
   ```bash
   pg_restore -h <db-host> -U mongez -d mongez_db /tmp/pg-backup.sql
   ```
4. **Point-In-Time Recovery (PITR)**:
   - If restoring to a specific hour, copy archived WAL logs from `s3://mongez-backups-prod/postgres/wal/`.
   - Configure `recovery.signal` and update `postgresql.conf` with:
     ```ini
     restore_command = 'aws s3 cp s3://mongez-backups-prod/postgres/wal/%f %p'
     recovery_target_time = '2026-06-15 14:00:00 EST'
     ```
   - Start the database server to replay transactions up to the target timestamp.

---

## 2. Redis Cache & Queue Recovery
Redis stores short-term session state, AI rate-limiting tokens, and BullMQ queue states.

### Persistence Strategy
Redis is configured in production with both **RDB snapshots** (daily) and **Append Only File (AOF)** persistence set to `everysec`:
```ini
appendonly yes
appendfsync everysec
```

### Restore Runbook

1. **Provision a clean Redis node**.
2. **Recover from AOF file** (replays the write log up to the last second):
   - Stop the Redis service:
     ```bash
     systemctl stop redis-server
     ```
   - Copy the AOF file (`appendonly.aof`) from the production backup storage to the Redis data directory (usually `/var/lib/redis/`).
   - Fix permissions:
     ```bash
     chown redis:redis /var/lib/redis/appendonly.aof
     ```
   - Start the Redis service:
     ```bash
     systemctl start redis-server
     ```

---

## 3. Object Storage (S3 / File Attachments)
User attachments and file versions are stored in AWS S3 with **Bucket Versioning** and **Cross-Region Replication (CRR)** enabled.

### Recovery Strategy
- Versioning protects against accidental deletes or overwrites.
- In case of a file delete, S3 creates a "Delete Marker". To recover, delete the Delete Marker version to make the previous version active again.

### Restoring Deleted Files via AWS CLI

```bash
# List versions of the deleted object
aws s3api list-object-versions --bucket mongez-attachments-prod --prefix <file-key>

# Delete the marker version to restore the object
aws s3api delete-object --bucket mongez-attachments-prod --key <file-key> --version-id <delete-marker-version-id>
```

---

## 4. Incident Verification Check list
Once resources are restored:
1. Verify `/health` API endpoint reports all systems green.
2. Confirm Redis has restored active BullMQ queue states.
3. Test task list loading and user login functions.
