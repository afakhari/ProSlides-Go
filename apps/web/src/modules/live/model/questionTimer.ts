type TimerRole = "manager" | "player" | string;
type RoomId = string | number | null | undefined;

interface TimerQuestion {
  question_id?: string | number | null;
  run_id?: string | number | null;
  question_time?: unknown;
  remaining_time?: unknown;
  remaining_seconds?: unknown;
  time_left?: unknown;
  time_left_seconds?: unknown;
  question_remaining_time?: unknown;
  started_at?: unknown;
  start_time?: unknown;
  question_started_at?: unknown;
  question_start_time?: unknown;
}

interface TimerState {
  identity: string;
  startMs: number;
  totalSeconds: number;
  updatedAt: number;
}

interface TimerBucket {
  version?: number;
  entries?: Record<string, TimerState>;
  identity?: string;
  startMs?: number;
  totalSeconds?: number;
  updatedAt?: number;
}

interface ResolveQuestionTimerInput {
  question?: TimerQuestion | null;
  roomId?: RoomId;
  role?: TimerRole;
  nowMs?: number;
}

interface ResolvedQuestionTimer {
  identity: string;
  totalSeconds: number;
  anchorStartMs: number;
  remainingSeconds: number;
}

const toNumber = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const pickFirstNumber = (question: TimerQuestion | null | undefined, keys: Array<keyof TimerQuestion>): number | null => {
  for (const key of keys) {
    const n = toNumber(question?.[key]);
    if (n != null) return n;
  }
  return null;
};

const parseTimestampMs = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const numeric = toNumber(value);
    if (numeric != null) return numeric < 1e12 ? numeric * 1000 : numeric;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const buildIdentity = (question?: TimerQuestion | null) =>
  `${String(question?.question_id ?? "na")}:${String(question?.run_id ?? "na")}`;

const buildQuestionOnlyIdentity = (question?: TimerQuestion | null) =>
  `${String(question?.question_id ?? "na")}:na`;

const hasRunId = (question?: TimerQuestion | null) =>
  question?.run_id != null && String(question.run_id).trim() !== "";

const getTimerStateKey = (roomId: RoomId, role: TimerRole | undefined) =>
  `presentation_question_timer_v1:${String(role || "unknown")}:${String(roomId || "unknown")}`;

const isTimerState = (value: unknown): value is TimerState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TimerState>;
  return typeof candidate.identity === "string" && Number.isFinite(Number(candidate.startMs));
};

const readTimerBucket = (roomId: RoomId, role: TimerRole | undefined): TimerBucket | null => {
  try {
    const raw = localStorage.getItem(getTimerStateKey(roomId, role));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as TimerBucket : null;
  } catch {
    return null;
  }
};

const readTimerState = (roomId: RoomId, role: TimerRole | undefined, identity: string): TimerState | null => {
  const bucket = readTimerBucket(roomId, role);
  if (!bucket) return null;
  const entry = bucket.entries?.[identity];
  if (isTimerState(entry)) return entry;
  if (bucket.identity === identity && Number.isFinite(Number(bucket.startMs))) {
    return {
      identity,
      startMs: Number(bucket.startMs),
      totalSeconds: Number(bucket.totalSeconds ?? 0),
      updatedAt: Number(bucket.updatedAt ?? 0),
    };
  }
  return null;
};

const readLatestTimerStateForQuestion = (roomId: RoomId, role: TimerRole | undefined, questionId: string | number | null | undefined): TimerState | null => {
  if (questionId == null) return null;
  const bucket = readTimerBucket(roomId, role);
  if (!bucket) return null;
  const prefix = `${String(questionId)}:`;

  let latest: TimerState | null = null;
  for (const [entryIdentity, entry] of Object.entries(bucket.entries ?? {})) {
    if (!entryIdentity.startsWith(prefix) || !isTimerState(entry)) continue;
    if (!latest || Number(entry.updatedAt ?? 0) > Number(latest.updatedAt ?? 0)) latest = entry;
  }
  if (latest) return latest;

  if (typeof bucket.identity === "string" && bucket.identity.startsWith(prefix) && Number.isFinite(Number(bucket.startMs))) {
    return {
      identity: bucket.identity,
      startMs: Number(bucket.startMs),
      totalSeconds: Number(bucket.totalSeconds ?? 0),
      updatedAt: Number(bucket.updatedAt ?? 0),
    };
  }
  return null;
};

const writeTimerState = (roomId: RoomId, role: TimerRole | undefined, state: TimerState): void => {
  try {
    const bucket = readTimerBucket(roomId, role);
    const entries = { ...(bucket?.entries ?? {}), [state.identity]: state };
    const sorted = Object.values(entries).sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0));
    const nextEntries = Object.fromEntries(sorted.slice(0, 20).map((item) => [item.identity, item]));
    localStorage.setItem(getTimerStateKey(roomId, role), JSON.stringify({ version: 2, entries: nextEntries }));
  } catch {
    // Storage is a recovery aid; live state remains authoritative.
  }
};

export const resolveQuestionTimer = ({
  question,
  roomId,
  role,
  nowMs = Date.now(),
}: ResolveQuestionTimerInput): ResolvedQuestionTimer => {
  const totalSeconds = Math.max(0, toNumber(question?.question_time) ?? 0);
  const identity = buildIdentity(question);
  const questionOnlyIdentity = buildQuestionOnlyIdentity(question);
  const runIdPresent = hasRunId(question);

  const explicitRemainingSeconds = pickFirstNumber(question, [
    "remaining_time",
    "remaining_seconds",
    "time_left",
    "time_left_seconds",
    "question_remaining_time",
  ]);

  const explicitStartMs = parseTimestampMs(
    question?.started_at ?? question?.start_time ?? question?.question_started_at ?? question?.question_start_time,
  );

  let remainingSeconds = totalSeconds;
  let anchorStartMs = nowMs;

  if (explicitRemainingSeconds != null) {
    remainingSeconds = Math.max(0, Math.min(totalSeconds, explicitRemainingSeconds));
    anchorStartMs = nowMs - (totalSeconds - remainingSeconds) * 1000;
  } else if (explicitStartMs != null) {
    const elapsed = (nowMs - explicitStartMs) / 1000;
    remainingSeconds = Math.max(0, totalSeconds - elapsed);
    anchorStartMs = explicitStartMs;
  } else {
    const persisted =
      readTimerState(roomId, role, identity) ||
      (!runIdPresent ? readLatestTimerStateForQuestion(roomId, role, question?.question_id) : null);
    if (persisted) {
      anchorStartMs = persisted.startMs;
      const elapsed = (nowMs - anchorStartMs) / 1000;
      const looksStale = elapsed < -5 || elapsed > totalSeconds + 300;
      if (!looksStale) remainingSeconds = Math.max(0, totalSeconds - elapsed);
      else {
        anchorStartMs = nowMs;
        remainingSeconds = totalSeconds;
      }
    }
  }

  writeTimerState(roomId, role, { identity, startMs: anchorStartMs, totalSeconds, updatedAt: nowMs });
  if (runIdPresent && questionOnlyIdentity !== identity) {
    writeTimerState(roomId, role, {
      identity: questionOnlyIdentity,
      startMs: anchorStartMs,
      totalSeconds,
      updatedAt: nowMs,
    });
  }

  return { identity, totalSeconds, anchorStartMs, remainingSeconds };
};
