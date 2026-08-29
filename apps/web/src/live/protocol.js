export const shouldApplyLiveEvent = (cursor, event) => {
  if (!event || !Number.isFinite(Number(event.event_id))) return false;
  if (Number(event.event_id) <= Number(cursor.eventId || 0)) return false;
  return Number(event.state_version) >= Number(cursor.stateVersion || 0);
};

export const advanceLiveCursor = (cursor, event) => ({
  eventId: Math.max(Number(cursor.eventId || 0), Number(event.event_id || 0)),
  stateVersion: Math.max(Number(cursor.stateVersion || 0), Number(event.state_version || 0)),
});

export const liveCursorFromSnapshot = (snapshot) => ({
  eventId: Number(snapshot?.last_event_id || 0),
  stateVersion: Number(snapshot?.session?.state_version || 0),
});

const isLeaderboardSlide = (slide) =>
  slide?.slide_type === 3 ||
  (slide?.slide_type === 2 && !slide?.title && !slide?.content_text && !slide?.content_image_url);

const openActionForSlide = (slide) => {
  if (!slide) return null;
  if (isLeaderboardSlide(slide)) return "show_leaderboard";
  return slide.slide_type === 1 || slide.kind === "question" ? "open_question" : "open_content";
};

export const planLiveNavigation = (state, command, slide = null) => {
  const actions = [];
  let projectedState = state;
  if (command === "start") {
    if (projectedState === "draft") {
      actions.push("start");
      projectedState = "lobby";
    }
    const open = openActionForSlide(slide);
    if (open) actions.push(open);
    return actions;
  }
  if (command !== "next") return actions;
  if (projectedState === "question_open") {
    actions.push("close_question");
    projectedState = "question_closed";
  }
  const open = openActionForSlide(slide);
  if (!slide && projectedState === "question_closed") actions.push("show_leaderboard");
  else if (open) actions.push(open);
  return actions;
};

export const planLiveEnd = (state) =>
  state === "question_open" ? ["close_question", "end"] : state === "ended" ? [] : ["end"];

export const normalizeLiveSlide = (activeSlide, session = {}) => {
  if (!activeSlide || typeof activeSlide !== "object") return null;
  const content = activeSlide.content && typeof activeSlide.content === "object" ? activeSlide.content : {};
  const id = String(activeSlide.id || session.active_slide_id || "");
  if (activeSlide.kind === "question") {
    const options = Array.isArray(content.options) ? content.options : [];
    const endsAt = session.ends_at ? Date.parse(session.ends_at) : NaN;
    return {
      slide_type: 1, slide_id: id, question_id: id, run_id: session.state_version,
      question_text: content.text || "", question_title: content.title || "",
      question_time: Number(content.question_time || 0),
      remaining_seconds: Number.isFinite(endsAt) ? Math.max(0, (endsAt - Date.now()) / 1000) : undefined,
      max_point: Number(content.max_point || 0), min_point: Number(content.min_point || 0),
      question_type: content.question_type || "single", has_multiple: content.question_type === "multiple",
      image_url: content.image_url || "",
      options: options.map((option, index) => ({ option_id: index, option_index: index, option_text: option?.text || "", image_url: option?.image_url || "", order: index })),
    };
  }
  return { slide_type: 2, slide_id: id, order: activeSlide.position ?? null, title: content.title || "", content_text: content.text || content.content_text || "", content_image_url: content.image_url || "" };
};

export const rosterEntryToLegacy = (entry, index = 0) => ({ user_id: entry.participant_id, name: entry.display_name, character: entry.avatar || "", rank: index + 1, total_points: Number(entry.score || 0), new_points: null });
export const participantToLegacy = (p) => ({ user_id: p.id, name: p.display_name, character: p.avatar || "", rank: Number.isFinite(Number(p.rank)) ? Number(p.rank) : null, total_points: Number(p.score || 0), new_points: null });
export const presentationSlideToLegacy = (slide) => {
  if (slide.kind === "question_draft") {
    return {
      slide_type: 1,
      slide_id: slide.id,
      question_id: slide.id,
      question_text: "",
      question_type: "single",
      question_time: 10,
      options: [],
      show_leaderboard_after: slide.content?.show_leaderboard_after === true,
    };
  }
  const normalized = normalizeLiveSlide({ id: slide.id, position: slide.position, kind: slide.kind, content: slide.content }, { active_slide_id: slide.id, state_version: 0, ends_at: null });
  if (normalized?.slide_type !== 1) return normalized;
  const sourceOptions = Array.isArray(slide.content?.options) ? slide.content.options : [];
  return {
    ...normalized,
    show_leaderboard_after: slide.content?.show_leaderboard_after === true,
    options: normalized.options.map((option, index) => ({
      ...option,
      answer: sourceOptions[index]?.is_correct === true,
    })),
  };
};

export const projectLiveSnapshot = (snapshot, roster = []) => {
  if (!snapshot?.session) return null;
  const active = normalizeLiveSlide(snapshot.active_slide, snapshot.session);
  const managerRows = snapshot.role === "manager" && Array.isArray(roster)
    ? roster.map(rosterEntryToLegacy)
    : [];
  const participantRows = snapshot.role === "participant" && snapshot.participant
    ? [participantToLegacy(snapshot.participant)]
    : [];
  const leaderboard = ["leaderboard", "ended"].includes(snapshot.session.state)
    ? snapshot.role === "manager" ? managerRows : participantRows
    : null;
  const stats = snapshot.question_stats;
  const questionResults = stats ? {
    question_id: stats.question_slide_id,
    optionsResult: Object.entries(stats.option_counts || {}).map(([optionId, count]) => ({
      option_id: Number(optionId),
      number_of_submits: Number(count),
    })),
  } : null;
  return {
    users: managerRows,
    currentQuestion: active?.slide_type === 1 && snapshot.session.state === "question_open" ? active : null,
    currentContent: active?.slide_type === 2 && snapshot.session.state === "content" ? active : null,
    leaderboardResults: leaderboard,
    participantCount: Number(snapshot.participant_count || 0),
    questionResults,
  };
};
