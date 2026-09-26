-- V2.8 production-readiness: support bounded pruning of replay events for
-- Sessions that have been ended beyond the approved retention window.
--
-- Active Sessions are never eligible for pruning. Reports do not read
-- live_events; ended-session snapshots remain authoritative even after their
-- replay ledger ages out.

CREATE INDEX IF NOT EXISTS live_sessions_ended_retention_idx
    ON live_sessions(ended_at, id)
    WHERE state = 'ended' AND ended_at IS NOT NULL;
