-- ProSlides v2 V2.5: freeze report-facing Presentation metadata on each
-- new Session so later authoring edits do not rewrite report history.
--
-- Existing Sessions intentionally keep a NULL title snapshot. Their original
-- historical title was never persisted, and copying the current mutable title
-- here would fabricate history.

ALTER TABLE live_sessions
    ADD COLUMN presentation_title_snapshot TEXT;

CREATE INDEX live_sessions_presentation_created_report_idx
    ON live_sessions(presentation_id, created_at DESC, id DESC);

CREATE INDEX answers_session_activity_submitted_report_idx
    ON answers(session_id, question_slide_id, submitted_at DESC, id DESC);
