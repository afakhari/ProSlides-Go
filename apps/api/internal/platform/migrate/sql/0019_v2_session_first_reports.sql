-- ProSlides v2 V2.5: freeze report-facing Presentation metadata on each
-- Session so historical reports never depend on later mutable authoring edits.

ALTER TABLE live_sessions
    ADD COLUMN presentation_title_snapshot TEXT;

UPDATE live_sessions AS session
SET presentation_title_snapshot = presentation.title
FROM presentations AS presentation
WHERE presentation.id = session.presentation_id
  AND session.presentation_title_snapshot IS NULL;

ALTER TABLE live_sessions
    ALTER COLUMN presentation_title_snapshot SET NOT NULL;

CREATE INDEX live_sessions_presentation_created_report_idx
    ON live_sessions(presentation_id, created_at DESC, id DESC);

CREATE INDEX answers_session_activity_submitted_report_idx
    ON answers(session_id, question_slide_id, submitted_at DESC, id DESC);
