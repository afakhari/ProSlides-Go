import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import test from "node:test";

const source = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("Tailwind and semantic theme have one CSS source", () => {
  const indexCss = source("src/index.css");

  assert.equal((indexCss.match(/@import\s+["']tailwindcss["']/g) || []).length, 1);
  assert.match(indexCss, /@theme\s*{/);
  assert.match(indexCss, /--color-brand:/);
  assert.match(indexCss, /--color-danger:/);
});

test("ordinary REST transport is owned by shared api without legacy utility shims", () => {
  const http = source("src/shared/api/http.ts");
  const utils = readdirSync(new URL("../src/utils/", import.meta.url));

  assert.match(http, /export const buildApiUrl/);
  assert.match(http, /proslides_csrf/);
  assert.match(http, /credentials: "include"/);
  assert.match(http, /export async function requestJson/);
  assert.doesNotMatch(http, /utils\/apiFetch|utils\/api/);
  assert.deepEqual(
    utils.filter((name) => /^api(?:Fetch)?\.[jt]s$/.test(name)),
    [],
  );
});

test("shared notice exposes assertive errors and polite pending or success states", () => {
  const notice = source("src/shared/ui/Notice.tsx");

  assert.match(notice, /isError \? "alert" : "status"/);
  assert.match(notice, /isError \? "assertive" : "polite"/);
  assert.match(notice, /aria-busy={pending \|\| undefined}/);
  assert.match(notice, /aria-atomic="true"/);
});

test("F2 dashboard editor and share slice has no native alerts and owns direction boundaries", () => {
  const paths = [
    "src/modules/presentations/editor/toolbar/EditorHeader.tsx",
    "src/modules/presentations/sharing/ShareDialog.tsx",
    "src/modules/presentations/dashboard/PresentationDashboard.jsx",
    "src/modules/presentations/editor/routes/EditorRoute.tsx",
    "src/modules/presentations/editor/inspector/QuestionInspector.tsx",
    "src/modules/presentations/editor/slide-list/SlideList.tsx",
  ];
  const combined = paths.map(source).join("\n");
  const header = source("src/modules/presentations/editor/toolbar/EditorHeader.tsx");
  const toolbar = source("src/modules/presentations/editor/toolbar/EditorToolbar.tsx");
  const share = source("src/modules/presentations/sharing/ShareDialog.tsx");

  assert.doesNotMatch(combined, /(?:window\.)?alert\s*\(/);
  assert.match(header, /dir="auto"/);
  assert.match(share, /dir="ltr"/);
  assert.doesNotMatch(header, /error\.response/);
  assert.doesNotMatch(share, /error\?*\.response|error\.response/);
  assert.match(header, /error instanceof ApiError/);
  assert.match(share, /error instanceof ApiError/);
  assert.match(toolbar, /border-e/);
  assert.doesNotMatch(toolbar, /violet-|border-r/);
  assert.match(source("src/modules/presentations/dashboard/PresentationDashboard.jsx"), /dir="auto"/);
});

test("protected manager routes use the data router and one cached session boundary", () => {
  const router = source("src/app/router/router.tsx");
  const loader = source("src/app/router/managerSessionLoader.ts");
  const shell = source("src/app/layouts/ProtectedManagerShell.tsx");
  const sessionQuery = source("src/modules/identity/api/sessionQuery.ts");

  assert.match(router, /createBrowserRouter/);
  assert.match(router, /loader: requireManagerSession/);
  assert.match(router, /Component: ProtectedManagerShell/);
  assert.match(router, /ErrorBoundary: ManagerRouteErrorBoundary/);
  assert.match(shell, /<Outlet \/>/);
  assert.doesNotMatch(shell, /RequireSession|apiFetch|Suspense/);
  assert.match(loader, /queryClient\.fetchQuery\(currentSessionQuery\(\)\)/);
  assert.match(loader, /error\.status === 401 \|\| error\.status === 403/);
  assert.match(sessionQuery, /queryFn: \(\{ signal \}\)/);
  assert.match(sessionQuery, /getCurrentUser\(\{ signal \}\)/);
  const dashboard = source("src/modules/presentations/dashboard/PresentationDashboard.jsx");
  assert.match(dashboard, /identityApi\.logout\(\)/);
  assert.match(dashboard, /removeQueries\(\{ queryKey: identityKeys\.session\(\) \}\)/);
});

test("editor presentation reads recover after interrupted route navigation", () => {
  const route = source("src/modules/presentations/editor/routes/EditorRoute.tsx");
  const repository = source("src/modules/presentations/api/presentationRepository.ts");

  assert.match(route, /new AbortController\(\)/);
  assert.match(route, /getEditorQuiz\(quizId, \{ signal \}\)/);
  assert.match(route, /useNavigation/);
  assert.match(route, /routeLoadAbortRef/);
  assert.match(route, /interruptedRouteLoadRef/);
  assert.match(route, /interruptedPageHideLoadRef/);
  assert.match(route, /activeLoadShowsSkeletonRef/);
  assert.match(route, /const runQuizLoad = useCallback/);
  assert.match(route, /const refreshQuiz = useCallback/);
  assert.match(route, /refreshQuiz=\{refreshQuiz\}/);
  assert.doesNotMatch(route, /refreshQuiz=\{fetchQuiz\}/);
  assert.match(route, /addEventListener\("pagehide"/);
  assert.match(route, /addEventListener\("pageshow"/);
  assert.match(route, /event\.persisted/);
  assert.match(route, /resumeWithLoading === null/);
  assert.match(route, /interruptedPageHideLoadRef\.current = activeLoadShowsSkeletonRef\.current/);
  assert.match(route, /void runQuizLoad\(resumeWithLoading\)/);
  assert.match(route, /interruptedPageHideLoadRef\.current = null/);
  assert.match(route, /const startRouteLoad = useCallback/);
  assert.match(route, /navigation\.state !== "idle"/);
  assert.match(route, /interruptedRouteLoadRef\.current = true/);
  assert.match(route, /navigation\.state === "idle"/);
  assert.match(route, /startRouteLoad\(\)/);
  assert.match(route, /routeLoadAbortRef\.current\?\.abort\(\)/);
  assert.match(route, /controller\.abort\(\)/);
  assert.match(route, /signal\?\.aborted/);
  assert.match(repository, /getEditorQuiz: async \(quizID: string, options\?: RequestOptions\)/);
});

test("typed Persian catalog is consumed by manager dashboard editor and share", () => {
  const catalog = source("src/shared/i18n/fa.ts");

  assert.match(catalog, /export const fa =/);
  assert.match(catalog, /as const/);
  assert.match(source("src/modules/presentations/dashboard/PresentationDashboard.jsx"), /fa\.dashboard\.title/);
  assert.match(source("src/modules/presentations/editor/routes/EditorRoute.tsx"), /fa\.managerShell\.backToDashboard/);
  assert.match(source("src/modules/presentations/sharing/ShareDialog.tsx"), /fa\.share\.title/);
});

test("presentation transport types come from the checked-in OpenAPI output", () => {
  const service = source("src/modules/presentations/api/presentationRepository.ts");
  const liveTypes = source("src/modules/live/api/types.ts");
  const generated = source("src/shared/api/generated/openapi.ts");

  assert.match(generated, /This file was auto-generated by openapi-typescript/);
  assert.match(service, /components\["schemas"\]\["Presentation"\]/);
  assert.match(service, /components\["schemas"\]\["Slide"\]/);
  assert.match(liveTypes, /components\["schemas"\]\["Presentation"\]/);
  assert.doesNotMatch(service, /interface PresentationDTO/);
  assert.doesNotMatch(service, /interface SlideDTO/);
});

test("F3 owns presentation UI and keeps slide mutation selection and reorder behind typed editor boundaries", () => {
  const route = source("src/modules/presentations/editor/routes/EditorRoute.tsx");
  const mutations = source("src/modules/presentations/editor/model/useEditorSlideMutations.ts");
  const selection = source("src/modules/presentations/editor/model/useEditorSlideSelection.ts");
  const order = source("src/modules/presentations/editor/model/useEditorSlideOrder.ts");
  const slideList = source("src/modules/presentations/editor/slide-list/SlideList.tsx");

  assert.match(source("src/modules/presentations/dashboard/PresentationDashboard.jsx"), /\.\.\/api\/presentationRepository/);
  assert.match(source("src/modules/presentations/sharing/ShareDialog.tsx"), /\.\.\/api\/presentationRepository/);
  assert.match(route, /useEditorStatus/);
  assert.match(route, /useEditorSlideMutations/);
  assert.match(route, /useEditorSlideSelection/);
  assert.match(route, /useEditorSlideOrder/);
  assert.doesNotMatch(route, /quizService\.(?:createSlide|updateSlide|deleteSlide|reorderSlides)/);
  assert.doesNotMatch(route, /error\.response/);
  assert.match(mutations, /quizService\.createSlide/);
  assert.match(mutations, /quizService\.updateSlide/);
  assert.match(mutations, /quizService\.deleteSlide/);
  assert.match(mutations, /error instanceof ApiError/);
  assert.match(selection, /slideId !== selection\.slideId \|\| slideType !== selection\.slideType/);
  assert.match(order, /quizService\.reorderSlides/);
  assert.match(order, /disabled: hasUnsavedChanges|disabled = false/);
  assert.doesNotMatch(slideList, /quizService|ApiError/);
});

test("F4 keeps the app router compositional and mock fixtures out of production", () => {
  const router = source("src/app/router/router.tsx");
  const productionFiles = readdirSync(new URL("../src", import.meta.url), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && /\.[jt]sx?$/.test(entry.name))
    .filter((entry) => !entry.parentPath.endsWith("data"));
  const productionSource = productionFiles
    .map((entry) => readFileSync(`${entry.parentPath}/${entry.name}`, "utf8"))
    .join("\n");

  assert.ok(router.split("\n").length < 170);
  assert.equal((router.match(/path: "\*"/g) || []).length, 1);
  assert.match(router, /lazy: lazyPresentationEntry/);
  assert.doesNotMatch(router, /AppPresentation|AccessCodeResolver|LiveMessageAdapter/);
  assert.doesNotMatch(productionSource, /from\s+["'][^"']*data\/mockData["']/);
  assert.match(source("src/modules/live/routes/useLivePresentationModel.ts"), /remoteQuiz \?\? EMPTY_PRESENTATION/);
});

test("F5 enforces typed lint, RTL defaults, bundle budgets, and named live commands", () => {
  const packageJson = source("package.json");
  const liveContext = source("src/modules/live/react/LiveSessionProvider.tsx");
  const projectionContext = source("src/modules/live/react/ServerDataProvider.tsx");

  assert.match(source("index.html"), /<html lang="fa-IR" dir="rtl">/);
  assert.match(source("eslint.config.js"), /typescript-eslint/);
  assert.match(packageJson, /bundle:check/);
  assert.match(source("bundle-budgets.json"), /initialJavaScriptGzipKiB/);
  assert.match(liveContext, /joinParticipant/);
  assert.match(liveContext, /submitAnswer/);
  assert.doesNotMatch(liveContext, /sendMessage|setLastMessage/);
  assert.doesNotMatch(projectionContext, /processMessage|lastMessageType/);
});

test("participant live UI is Persian, theme-driven, and disclosure-safe", () => {
  const entry = source("src/modules/live/routes/PresentationEntry.tsx");
  const shell = source("src/modules/live/participant/ParticipantShell.tsx");
  const theme = source("src/modules/live/participant/theme.ts");
  const sharedTheme = source("src/shared/styles/presentationTheme.ts");
  const question = source("src/modules/live/participant/ui/ParticipantQuestion.tsx");
  const leaderboard = source("src/modules/live/participant/ui/ParticipantLeaderboard.tsx");
  const answerController = source(
    "src/modules/live/participant/useParticipantAnswerController.ts",
  );

  assert.match(entry, /data\.presentation\.background_color/);
  assert.match(entry, /data\.presentation\.text_color/);
  assert.match(shell, /dir="rtl"/);
  assert.match(theme, /presentationTheme as participantTheme/);
  assert.match(sharedTheme, /--live-bg/);
  assert.match(question, /ثبت پاسخ/);
  assert.doesNotMatch(question, />\s*(?:Submitted|Submit|Loading quiz|You voted)\s*</);
  assert.doesNotMatch(leaderboard, /players\.map|roster/);
  assert.doesNotMatch(question, /answer\s*===\s*true|is_correct|correctness/);
  assert.doesNotMatch(answerController, /localStorage|sessionStorage|answer_queue/);
  assert.match(answerController, /selectedIndexes/);
});


test("shared design primitives use the ProSlides token vocabulary and accessible alert dialogs", () => {
  const button = source("src/shared/ui/primitives/Button.tsx");
  const variants = source("src/shared/ui/primitives/button.variants.ts");
  const confirm = source("src/shared/ui/primitives/ConfirmDialog.tsx");

  assert.match(button, /shared\/lib|\.\.\/\.\.\/lib\/cn/);
  assert.match(variants, /bg-brand/);
  assert.match(variants, /bg-danger/);
  assert.match(variants, /ring-focus/);
  assert.doesNotMatch(variants, /bg-primary|text-primary-foreground|ring-ring|border-input/);

  assert.match(confirm, /@radix-ui\/react-alert-dialog/);
  assert.match(confirm, /AlertDialogPrimitive\.Title/);
  assert.match(confirm, /AlertDialogPrimitive\.Description/);
  assert.match(confirm, /AlertDialogPrimitive\.Cancel/);
  assert.match(confirm, /aria-busy/);
});


test("manager and player routes are explicit and reports use the typed query boundary", () => {
  const router = source("src/app/router/router.tsx");
  const report = source("src/modules/reports/routes/ReportRoute.tsx");
  const reportApi = source("src/modules/reports/api/reportApi.ts");
  const reportQueries = source("src/modules/reports/api/reportQueries.ts");
  const provider = source("src/app/providers/AppQueryProvider.tsx");
  const queryClient = source("src/app/providers/queryClient.ts");

  assert.match(router, /path: "manager\/panel"/);
  assert.match(router, /path: "manager\/panel\/:presentationId\/report"/);
  assert.match(router, /path: "manager\/presentation\/:roomId"/);
  assert.match(router, /path: "player\/presentation\/:roomId"/);
  assert.doesNotMatch(router, /:\s*role|\/:role/);

  assert.match(report, /useInfiniteQuery/);
  assert.match(report, /useQuery/);
  assert.match(report, /بازگشت به پنل مدیریت/);
  assert.doesNotMatch(report, /"(?:Language|Notifications|Help|Logout|Search participants|Participants)"/);
  assert.match(reportApi, /requestJson/);
  assert.doesNotMatch(reportApi, /liveApi|services\/quizService/);
  assert.match(reportQueries, /refetchInterval:\s*15 \* 60_000/);
  assert.match(provider, /QueryClientProvider/);
  assert.match(queryClient, /mutations:\s*\{[\s\S]*retry:\s*false/);
});


test("identity UI uses the typed module API instead of parsing transport responses", () => {
  const auth = source("src/modules/identity/routes/AuthRoute.tsx");
  const google = source("src/modules/identity/hooks/useGoogleIdentity.ts");
  const api = source("src/modules/identity/api/identityApi.ts");
  const errors = source("src/modules/identity/api/identityErrors.ts");

  assert.match(auth, /identityApi\.login/);
  assert.match(auth, /identityApi\.register/);
  assert.match(auth, /identityApi\.verifyEmail/);
  assert.match(google, /onCredential/);
  assert.match(auth, /identityApi\.authenticateWithGoogle/);
  assert.doesNotMatch(auth, /apiFetch\(|parseJson\(|formatError\(|extractFieldErrors\(/);
  assert.match(api, /announceAuthExpiry:\s*false/);
  assert.match(errors, /email_not_verified/);
  assert.match(errors, /verification_expired/);
});


test("identity route validation is owned by module Zod schemas", () => {
  const auth = source("src/modules/identity/routes/AuthRoute.tsx");
  const card = source("src/modules/identity/ui/AuthCard.tsx");
  const schemas = source("src/modules/identity/model/authSchemas.ts");

  assert.match(auth, /registerSchema\.safeParse/);
  assert.match(auth, /loginSchema\.safeParse/);
  assert.match(auth, /verificationSchema\.safeParse/);
  assert.match(card, /normalizeDigits/);
  assert.match(schemas, /min\(12/);
  assert.match(schemas, /max\(128/);
  assert.match(schemas, /max\(100/);
  assert.match(schemas, /verificationCodeSchema/);
  assert.doesNotMatch(auth, /pages\/auth\/AuthPage/);
});


test("dashboard presentation server state is owned by TanStack Query", () => {
  const dashboard = source("src/modules/presentations/dashboard/PresentationDashboard.jsx");
  const queries = source("src/modules/presentations/api/presentationQueries.ts");

  assert.match(dashboard, /useQuery\(presentationListQuery\(\)\)/);
  assert.match(dashboard, /useQueryClient\(\)/);
  assert.match(dashboard, /refreshPresentations/);
  assert.match(dashboard, /invalidateQueries\(\{\s*queryKey:\s*presentationKeys\.list\(\)/);
  assert.doesNotMatch(dashboard, /setQuizzes\(|fetchQuizzes\(|new AbortController\(/);
  assert.match(queries, /queryFn:\s*\(\{ signal \}\)/);
  assert.match(queries, /listPresentations\(\{ signal \}\)/);
  assert.match(queries, /staleTime:\s*30_000/);
});


test("live runtime ownership is module-scoped and React is only an adapter", () => {
  const entry = source("src/modules/live/routes/PresentationEntry.tsx");
  const liveContext = source("src/modules/live/react/LiveSessionProvider.tsx");
  const serverContext = source("src/modules/live/react/ServerDataProvider.tsx");
  const runtime = source("src/modules/live/runtime/LiveRuntime.ts");
  const liveApi = source("src/modules/live/api/liveApi.ts");

  assert.match(entry, /\.\.\/react\/LiveSessionProvider\.tsx/);
  assert.match(entry, /\.\.\/api\/liveApi\.ts/);
  assert.match(liveContext, /createLiveRuntime/);
  assert.match(liveContext, /useSyncExternalStore/);
  assert.doesNotMatch(liveContext, /streamLiveEvents|applyLiveAction|getLiveSnapshot|planLiveNavigation/);
  assert.match(runtime, /\.\.\/api\/liveApi/);
  assert.match(runtime, /\.\/protocol/);
  assert.match(runtime, /class LiveRuntime/);
  assert.match(runtime, /resetInternals/);
  assert.match(serverContext, /\.\.\/runtime\/protocol/);
  assert.match(liveApi, /\.\/types/);
  const reactAdapterFiles = readdirSync(
    new URL("../src/modules/live/react/", import.meta.url),
  );
  assert.equal(
    reactAdapterFiles.filter((name) => /\.(?:js|jsx)$/.test(name)).length,
    0,
  );
  assert.match(source("src/modules/live/react/liveSessionContext.ts"), /LiveSessionContextValue/);
  assert.match(source("src/modules/live/model/serverData.ts"), /ServerDataValue/);
});


test("main identity fields are owned by React Hook Form with focused auth composition", () => {
  const auth = source("src/modules/identity/routes/AuthRoute.tsx");
  const card = source("src/modules/identity/ui/AuthCard.tsx");
  const google = source("src/modules/identity/hooks/useGoogleIdentity.ts");
  const timers = source("src/modules/identity/hooks/useVerificationTimers.ts");

  assert.match(auth, /useForm<AuthFormValues>/);
  assert.match(auth, /createZodResolver/);
  assert.match(card, /register\("email"\)/);
  assert.match(card, /register\("password"\)/);
  assert.match(card, /register\("verificationCode"/);
  assert.match(card, /register\("fullName"\)/);
  assert.match(card, /readOnly=\{isVerify\}/);
  assert.match(auth, /setError\(field, \{ type: "server", message \}\)/);
  assert.match(auth, /useGoogleIdentity/);
  assert.match(auth, /useVerificationTimers/);
  assert.match(google, /accounts\?\.id/);
  assert.match(timers, /expiresAt/);
  assert.doesNotMatch(auth, /document\.createElement\("script"\)/);
  assert.doesNotMatch(auth, /setTimeout\(/);
  assert.doesNotMatch(auth, /const \[email, setEmail\]/);
  assert.doesNotMatch(auth, /setFieldErrors\(/);
});

test("live presentation route owns a typed role composition without a legacy bridge", () => {
  const entry = source("src/modules/live/routes/PresentationEntry.tsx");
  const flow = source("src/modules/live/routes/PresentationFlow.tsx");
  const managerView = source("src/modules/live/routes/ManagerPresentationView.tsx");
  const playerView = source("src/modules/live/routes/PlayerPresentationView.tsx");
  const contract = source("src/modules/live/model/presentation.ts");

  assert.match(entry, /from "\.\/PresentationFlow\.tsx"/);
  assert.doesNotMatch(entry, /AppPresentation as AppPresentationComponent/);
  assert.match(entry, /useState<LivePresentationModel \| null>/);
  assert.match(flow, /AppPresentationProps/);
  assert.match(flow, /<ManagerPresentationView/);
  assert.match(flow, /<PlayerPresentationView/);
  assert.match(managerView, /useNavigate/);
  assert.match(managerView, /\.\.\/manager\/ui\/ManagerJoinPage\.tsx/);
  assert.match(managerView, /\.\.\/manager\/ui\/ManagerPickAnswerQuestion\.tsx/);
  assert.match(managerView, /\.\.\/manager\/ui\/ManagerLeaderBoard\.tsx/);
  assert.doesNotMatch(managerView, /lazyLegacyManagerPage|pages\/presentation\/manager|window\.location\.href/);
  const managerUiFiles = readdirSync(
    new URL("../src/modules/live/manager/ui/", import.meta.url),
  );
  assert.equal(
    managerUiFiles.filter((name) => /\.(?:js|jsx)$/.test(name)).length,
    0,
  );
  assert.match(playerView, /\.\.\/participant\/ui\/ParticipantJoinPage\.tsx/);
  assert.match(playerView, /\.\.\/participant\/ui\/ParticipantQuestion\.tsx/);
  assert.match(playerView, /\.\.\/participant\/ui\/ParticipantLeaderboard\.tsx/);
  assert.match(playerView, /\.\.\/participant\/ui\/ParticipantContentSlide\.tsx/);
  assert.match(playerView, /\.\.\/participant\/ui\/ParticipantWaiting\.tsx/);
  assert.doesNotMatch(
    playerView,
    /lazyLegacyPlayerPage|pages\/presentation\/player|pages\/loading/,
  );
  const participantUiFiles = readdirSync(
    new URL("../src/modules/live/participant/ui/", import.meta.url),
  );
  assert.equal(
    participantUiFiles.filter((name) => /\.(?:js|jsx)$/.test(name)).length,
    0,
  );
  assert.match(contract, /interface LivePresentationModel/);
  assert.match(contract, /interface AppPresentationProps/);
  assert.doesNotMatch(contract, /AppPresentationComponent/);
  assert.doesNotMatch(entry, /\bany\b/);
});

test("live presentation loading uses the shared REST boundary and a typed route model loader", () => {
  const flow = source("src/modules/live/routes/PresentationFlow.tsx");
  const loader = source("src/modules/live/routes/useLivePresentationModel.ts");
  const presentationApi = source("src/modules/live/api/presentationApi.ts");
  const liveApi = source("src/modules/live/api/liveApi.ts");

  assert.match(flow, /useLivePresentationModel/);
  assert.doesNotMatch(flow, /getPresentation|presentationSlideToLegacy|setRemoteQuiz/);
  assert.match(loader, /new AbortController\(\)/);
  assert.match(loader, /getPresentationForLive\(roomId, controller\.signal\)/);
  assert.match(loader, /presentationSlideToLegacy/);
  assert.match(loader, /return \(\) => controller\.abort\(\)/);
  assert.match(presentationApi, /requestJson<Presentation>/);
  assert.match(presentationApi, /\{ signal \}/);
  assert.doesNotMatch(liveApi, /presentations\//);
});

test("live manager synchronization is owned by a typed manager controller", () => {
  const flow = source("src/modules/live/routes/PresentationFlow.tsx");
  const controller = source(
    "src/modules/live/manager/useManagerPresentationController.ts",
  );

  assert.match(flow, /useManagerPresentationController/);
  assert.doesNotMatch(flow, /setLastManagerQuestionSlideIndex/);
  assert.doesNotMatch(flow, /setCurrentSlide/);
  assert.doesNotMatch(flow, /ManagerFinalLeaderboard" \|\| snapshot/);
  assert.match(controller, /findQuestionSlideIndex/);
  assert.match(controller, /findContentSlideIndex/);
  assert.match(controller, /findLeaderboardSlideIndex/);
  assert.match(controller, /sessionState === "ended"/);
  assert.match(controller, /Product requirement: presentation flow is forward-only/);
});

test("participant interaction controllers own join retries and answer attempts", () => {
  const join = source(
    "src/modules/live/participant/useParticipantJoinController.ts",
  );
  const answer = source(
    "src/modules/live/participant/useParticipantAnswerController.ts",
  );
  const attempt = source("src/modules/live/participant/answerAttempt.ts");

  assert.match(join, /joinParticipant/);
  assert.match(join, /scheduleRetry/);
  assert.match(join, /Math\.min\(1000 \* 2 \*\* attempt, 10_000\)/);
  assert.match(answer, /createRequestId/);
  assert.match(answer, /pendingRef/);
  assert.match(answer, /retryable/);
  assert.doesNotMatch(answer, /localStorage|sessionStorage/);
  assert.match(attempt, /option_index/);
  assert.doesNotMatch(attempt, /user_id|submit_time/);
});

test("live player recovery is owned by a typed participant controller", () => {
  const flow = source("src/modules/live/routes/PresentationFlow.tsx");
  const recovery = source(
    "src/modules/live/participant/usePlayerSessionRecovery.ts",
  );
  const model = source("src/modules/live/model/presentationFlow.ts");

  assert.match(flow, /usePlayerSessionRecovery/);
  assert.doesNotMatch(flow, /sessionStorage|localStorage/);
  assert.doesNotMatch(flow, /readStoredProfile|getPersistedUserIdForRoom/);
  assert.match(recovery, /readStoredProfile/);
  assert.match(recovery, /persistPlayerSeenActive/);
  assert.match(recovery, /persistPlayerLastActive/);
  assert.match(recovery, /joinParticipant/);
  assert.match(model, /isLeaderboardSlide/);
});

test("live projection is derived directly from authoritative snapshot and roster", () => {
  const liveContext = source("src/modules/live/react/LiveSessionProvider.tsx");
  const projectionContext = source("src/modules/live/react/ServerDataProvider.tsx");
  const entry = source("src/modules/live/routes/PresentationEntry.tsx");
  const recovery = source(
    "src/modules/live/participant/usePlayerSessionRecovery.ts",
  );

  assert.match(projectionContext, /useLiveSession/);
  assert.match(projectionContext, /projectLiveSnapshot\(snapshot, roster\)/);
  assert.doesNotMatch(projectionContext, /applyLiveSnapshot|applyLiveEvent/);
  assert.doesNotMatch(liveContext, /lastEvent|setLastEvent/);
  assert.doesNotMatch(entry, /LiveMessageHandler|applyLiveSnapshot|applyLiveEvent/);
  assert.match(entry, /<LiveSessionProvider[^>]*>[\s\S]*<ServerDataProvider>/);
  assert.match(entry, /key=\{`player:\$\{resolvedData\.session_id\}`\}/);
  assert.match(entry, /key=\{`\$\{role\}:\$\{roomId \|\| "unknown"\}`\}/);
  assert.match(recovery, /if \(ok !== true\) joinSentRef\.current = false/);
});


test("question editor keeps one typed draft across inspector and canvas", () => {
  const route = source("src/modules/presentations/editor/routes/EditorRoute.tsx");
  const inspector = source("src/modules/presentations/editor/inspector/QuestionInspector.tsx");
  const canvas = source("src/modules/presentations/editor/canvas/QuestionCanvas.tsx");
  const options = source("src/modules/presentations/editor/inspector/QuestionOptionsEditor.tsx");
  const provider = source("src/modules/presentations/editor/model/QuestionDraftProvider.tsx");
  const draft = source("src/modules/presentations/editor/model/questionDraft.ts");
  const preview = source("src/modules/presentations/editor/model/questionPreview.ts");
  const hook = source("src/modules/presentations/editor/model/useQuestionDraft.ts");
  const editorModel = source("src/modules/presentations/model/editor.ts");

  assert.match(route, /<QuestionDraftProvider/);
  assert.match(route, /showSidebar && activeSlideType === 1/);
  assert.match(inspector, /useRequiredQuestionDraft/);
  assert.doesNotMatch(inspector, /useQuestionDraft\(/);
  assert.match(canvas, /useOptionalQuestionDraft/);
  assert.match(canvas, /createQuestionPreviewModel/);
  assert.match(canvas, /presentationTheme/);
  assert.match(canvas, /پیش‌نمایش شرکت‌کننده/);
  assert.match(provider, /useQuestionDraft\(slide\)/);
  assert.match(inspector, /error instanceof ApiError/);
  assert.match(inspector, /slide_has_results/);
  assert.match(inspector, /conflictPending/);
  assert.match(inspector, /تغییرات محلی شما/);
  assert.doesNotMatch(inspector, /error\.response\?\./);
  assert.doesNotMatch(inspector, /useState\([^\n]*localSlide/);
  assert.match(options, /انتقال گزینه/);
  assert.match(options, /aria-pressed/);
  assert.match(options, /QUESTION_LIMITS\.minOptions/);
  assert.match(draft, /questionDraftReducer/);
  assert.match(draft, /questionDraftToEditorSlide/);
  assert.match(preview, /validationIssueCount/);
  assert.match(hook, /questionDraftEquals/);
  assert.match(editorModel, /QUESTION_LIMITS/);
  assert.match(editorModel, /validateEditorQuestion/);
});


test("content editor shares one typed draft across inspector and canvas", () => {
  const route = source("src/modules/presentations/editor/routes/EditorRoute.tsx");
  const inspector = source("src/modules/presentations/editor/inspector/ContentInspector.tsx");
  const canvas = source("src/modules/presentations/editor/canvas/ContentCanvas.tsx");
  const provider = source("src/modules/presentations/editor/model/ContentDraftProvider.tsx");
  const draft = source("src/modules/presentations/editor/model/contentDraft.ts");
  const editorModel = source("src/modules/presentations/model/editor.ts");

  assert.match(route, /<ContentDraftProvider/);
  assert.match(route, /showSidebar && activeSlideType === 2/);
  assert.match(route, /<ContentCanvas/);
  assert.match(inspector, /useRequiredContentDraft/);
  assert.match(inspector, /error instanceof ApiError/);
  assert.match(inspector, /conflictPending/);
  assert.doesNotMatch(inspector, /error\.response\?\./);
  assert.doesNotMatch(inspector, /JSON\.stringify/);
  assert.match(canvas, /useOptionalContentDraft/);
  assert.match(canvas, /createContentPreviewModel/);
  assert.match(canvas, /presentationTheme/);
  assert.match(provider, /useContentDraft\(slide\)/);
  assert.match(draft, /contentDraftReducer/);
  assert.match(draft, /contentDraftToEditorSlide/);
  assert.match(editorModel, /CONTENT_LIMITS/);
  assert.match(editorModel, /validateEditorContent/);
});



test("audio editor uses one typed presentation draft and accessible native preview", () => {
  const route = source("src/modules/presentations/editor/routes/EditorRoute.tsx");
  const inspector = source("src/modules/presentations/editor/inspector/AudioInspector.tsx");
  const draft = source("src/modules/presentations/editor/model/audioDraft.ts");
  const hook = source("src/modules/presentations/editor/model/useAudioDraft.ts");
  const provider = source("src/modules/live/react/AudioProvider.tsx");

  assert.match(route, /AudioInspector\.tsx/);
  assert.match(route, /<AudioPanel/);
  assert.doesNotMatch(route, /setAudioSaveNotice/);
  assert.doesNotMatch(route, /activeSlide\s*&&\s*\([\s\S]{0,120}<AudioPanel/);
  assert.match(inspector, /useAudioDraft\(quiz\)/);
  assert.match(inspector, /error instanceof ApiError/);
  assert.match(inspector, /conflictPending/);
  assert.match(inspector, /<audio/);
  assert.match(inspector, /controls/);
  assert.match(inspector, /aria-invalid/);
  assert.doesNotMatch(inspector, /ErrorModal/);
  assert.doesNotMatch(inspector, /error\.response\?\./);
  assert.doesNotMatch(inspector, /localAudio|originalAudio|setHasChanges/);
  assert.match(draft, /audioDraftReducer/);
  assert.match(draft, /audioDraftToUpdate/);
  assert.match(hook, /audioDraftEquals/);
  assert.match(provider, /createContext<AudioContextValue \| null>/);
  assert.doesNotMatch(provider, /createOscillator|webkitAudioContext/);
  assert.match(source("src/modules/live/routes/PresentationFlow.tsx"), /setQuizMusic\(remoteQuiz\?\.music_url \?\? ""\)/);
});

test("design editor shares one typed presentation draft across all preview surfaces", () => {
  const route = source("src/modules/presentations/editor/routes/EditorRoute.tsx");
  const inspector = source("src/modules/presentations/editor/inspector/DesignInspector.tsx");
  const question = source("src/modules/presentations/editor/canvas/QuestionCanvas.tsx");
  const content = source("src/modules/presentations/editor/canvas/ContentCanvas.tsx");
  const leaderboard = source("src/modules/presentations/editor/canvas/LeaderboardCanvas.tsx");
  const slides = source("src/modules/presentations/editor/slide-list/SlideList.tsx");
  const provider = source("src/modules/presentations/editor/model/DesignDraftProvider.tsx");
  const draft = source("src/modules/presentations/editor/model/designDraft.ts");

  assert.match(route, /<DesignDraftProvider/);
  assert.match(route, /presentation=\{showDesignPanel \? quiz : null\}/);
  assert.doesNotMatch(route, /backgroundSaveNotice/);
  assert.match(inspector, /useRequiredDesignDraft/);
  assert.match(inspector, /error instanceof ApiError/);
  assert.match(inspector, /conflictPending/);
  assert.match(inspector, /type="color"/);
  assert.doesNotMatch(inspector, /ErrorModal/);
  assert.doesNotMatch(inspector, /document\.createElement/);
  assert.doesNotMatch(inspector, /error\.response\?\./);
  assert.match(question, /useOptionalDesignDraft/);
  assert.match(content, /useOptionalDesignDraft/);
  assert.match(leaderboard, /useOptionalDesignDraft/);
  assert.match(leaderboard, /presentationTheme/);
  assert.match(slides, /useOptionalDesignDraft/);
  assert.match(provider, /useDesignDraft\(presentation\)/);
  assert.match(draft, /designDraftReducer/);
  assert.match(draft, /designDraftToUpdate/);
});

test("manager live UI is module-owned, typed, Persian and contract-driven", () => {
  const leaderboard = source("src/modules/live/manager/ui/ManagerLeaderBoard.tsx");
  const question = source("src/modules/live/manager/ui/ManagerPickAnswerQuestion.tsx");
  const join = source("src/modules/live/manager/ui/ManagerJoinPage.tsx");
  const dialog = source("src/modules/live/manager/ui/ManagerLeaderboardDialog.tsx");
  const qr = source("src/modules/live/manager/ui/ManagerQrPanel.tsx");
  const controls = source("src/modules/live/manager/ui/ManagerControls.tsx");
  const combined = [leaderboard, question, join, dialog, qr, controls].join("\n");

  assert.match(leaderboard, /جدول امتیازات/);
  assert.match(leaderboard, /شرکت‌کننده/);
  assert.match(question, /alt="تصویر سؤال"/);
  assert.match(question, /activeTimerIdentityRef/);
  assert.match(question, /timerIdentity/);
  assert.doesNotMatch(
    question,
    /\[currentQuestion,\s*liveCurrentQuestion,\s*liveMatchesDefinition\]/,
  );
  assert.match(join, /در انتظار ورود شرکت‌کنندگان/);
  assert.match(dialog, /aria-label="بستن جدول امتیازات"/);
  assert.match(qr, /QRCode\.toDataURL/);
  assert.match(qr, /<dialog/);
  assert.match(qr, /showModal\(\)/);
  assert.match(qr, /onCancel=/);
  assert.doesNotMatch(qr, /qrserver\.com/);
  assert.match(controls, /ConfirmDialog/);
  assert.doesNotMatch(controls, /FOOTER_CHAT_MESSAGES|FOOTER_MENU_ITEMS|FOOTER_REACTIONS/);
  assert.doesNotMatch(combined, /ðŸ|Ø|Ù|â€|ï¸/);
  assert.doesNotMatch(combined, /\.\.\/\.\.\/\.\.\/pages|\.\.\/\.\.\/\.\.\/components/);
});
