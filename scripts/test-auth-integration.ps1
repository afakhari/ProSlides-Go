[CmdletBinding()]
param(
  [switch]$StopAfter,
  [switch]$SkipBuild,
  [switch]$SkipComposeStartup,
  [string]$ApiBaseUrl = "http://localhost:8080"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$repoRoot = Split-Path -Parent $PSScriptRoot
$composeArgs = @("compose", "--env-file", "apps/api/.env.example")
$apiBaseUrl = $ApiBaseUrl.TrimEnd('/')
$email = "auth-integration-$([guid]::NewGuid().ToString('N').Substring(0, 16))@example.test"
$password = "integration-password-2026"
$registerPayload = @{ email = $email; display_name = "Integration User"; password = $password } | ConvertTo-Json -Compress

function Invoke-API {
  param(
    [Parameter(Mandatory)] [string]$Method,
    [Parameter(Mandatory)] [string]$Path,
    [Parameter(Mandatory)] [System.Net.Http.HttpClient]$Client,
    [hashtable]$Headers = @{},
    [string]$Body,
    [int]$ExpectedStatus = 200
  )

  $request = [System.Net.Http.HttpRequestMessage]::new(
    [System.Net.Http.HttpMethod]::new($Method), "$apiBaseUrl$Path"
  )
  foreach ($header in $Headers.GetEnumerator()) {
    [void]$request.Headers.TryAddWithoutValidation($header.Key, [string]$header.Value)
  }
  if ($PSBoundParameters.ContainsKey("Body")) {
    $request.Content = [System.Net.Http.StringContent]::new(
      $Body, [System.Text.Encoding]::UTF8, "application/json"
    )
  }

  try {
    $response = $Client.SendAsync($request).GetAwaiter().GetResult()
    $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if ([int]$response.StatusCode -ne $ExpectedStatus) {
      throw "$Method $Path returned $([int]$response.StatusCode), expected $ExpectedStatus. Body: $content"
    }
    return [PSCustomObject]@{ StatusCode = [int]$response.StatusCode; Content = $content }
  } finally {
    $request.Dispose()
    if ($response) { $response.Dispose() }
  }
}

function Wait-ForReady {
  param([System.Net.Http.HttpClient]$Client)
  $deadline = (Get-Date).AddSeconds(90)
  $lastError = $null
  do {
    try {
      $response = $Client.GetAsync("$apiBaseUrl/readyz").GetAwaiter().GetResult()
      try {
        if ([int]$response.StatusCode -eq 200) { return }
        $lastError = "GET /readyz returned $([int]$response.StatusCode)"
      } finally {
        $response.Dispose()
      }
    } catch {
      $lastError = $_.Exception.Message
    }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)

  throw "API did not become ready within 90 seconds: $lastError"
}

Push-Location $repoRoot
try {
  if (-not $SkipComposeStartup) {
    $upArgs = $composeArgs + @("up", "-d")
    if (-not $SkipBuild) { $upArgs += "--build" }
    & docker @upArgs
    if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }
  }
  $cookieJar = [System.Net.CookieContainer]::new()
  $handler = [System.Net.Http.HttpClientHandler]::new()
  $handler.UseProxy = $false
  $handler.CookieContainer = $cookieJar
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromSeconds(10)
  Wait-ForReady -Client $client

  $register = Invoke-API -Method POST -Path "/api/v1/auth/register" -Client $client -Body $registerPayload -ExpectedStatus 201
  $registeredUser = $register.Content | ConvertFrom-Json
  if ($registeredUser.email -ne $email) { throw "Register response returned the wrong account" }

  Invoke-API -Method GET -Path "/api/v1/auth/me" -Client $client -ExpectedStatus 200 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/auth/register" -Client $client -Body $registerPayload -ExpectedStatus 409 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/auth/login" -Client $client -Body (@{ email = $email; password = "wrong-password" } | ConvertTo-Json -Compress) -ExpectedStatus 401 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/auth/logout" -Client $client -ExpectedStatus 403 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/auth/logout" -Client $client -Headers @{ "X-CSRF-Token" = "invalid" } -ExpectedStatus 403 | Out-Null

  $csrfCookie = $cookieJar.GetCookies($apiBaseUrl)["proslides_csrf"]
  if ($null -eq $csrfCookie -or [string]::IsNullOrWhiteSpace($csrfCookie.Value)) {
    throw "Registration response did not establish a CSRF cookie"
  }
  Invoke-API -Method POST -Path "/api/v1/auth/logout" -Client $client -Headers @{ "X-CSRF-Token" = $csrfCookie.Value } -ExpectedStatus 204 | Out-Null
  Invoke-API -Method GET -Path "/api/v1/auth/me" -Client $client -ExpectedStatus 401 | Out-Null

  $loginCookieJar = [System.Net.CookieContainer]::new()
  $loginHandler = [System.Net.Http.HttpClientHandler]::new()
  $loginHandler.UseProxy = $false
  $loginHandler.CookieContainer = $loginCookieJar
  $loginClient = [System.Net.Http.HttpClient]::new($loginHandler)
  $loginClient.Timeout = [TimeSpan]::FromSeconds(10)
  Invoke-API -Method POST -Path "/api/v1/auth/login" -Client $loginClient -Body (@{ email = $email.ToUpperInvariant(); password = $password } | ConvertTo-Json -Compress) -ExpectedStatus 200 | Out-Null
  Invoke-API -Method GET -Path "/api/v1/auth/me" -Client $loginClient -ExpectedStatus 200 | Out-Null
  $loginCSRF = $loginCookieJar.GetCookies($apiBaseUrl)["proslides_csrf"].Value
  $created = Invoke-API -Method POST -Path "/api/v1/presentations" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ title = "Created through API" } | ConvertTo-Json -Compress) -ExpectedStatus 201
  $createdInitial = $created.Content | ConvertFrom-Json
  $createdID = $createdInitial.id
  $contentResponse = Invoke-API -Method POST -Path "/api/v1/presentations/$createdID/slides" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF; "If-Match" = [string]$createdInitial.revision } -Body (@{ position = 0; kind = "content"; content = @{ text = "Created through API" } } | ConvertTo-Json -Compress) -ExpectedStatus 201
  $contentID = ($contentResponse.Content | ConvertFrom-Json).id
  $questionResponse = Invoke-API -Method POST -Path "/api/v1/presentations/$createdID/questions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ position = 1; text = "Choose"; question_type = "multiple"; question_time = 30; max_point = 100; min_point = 0; partial_scoring = $true; faster_answers_more_points = $false; options = @(@{ text = "A"; is_correct = $true }, @{ text = "B"; is_correct = $true }, @{ text = "C"; is_correct = $false }) } | ConvertTo-Json -Compress -Depth 4) -ExpectedStatus 201
  $questionID = ($questionResponse.Content | ConvertFrom-Json).id
  $beforeInsert = (Invoke-API -Method GET -Path "/api/v1/presentations/$createdID" -Client $loginClient -ExpectedStatus 200).Content | ConvertFrom-Json
  $insertedResponse = Invoke-API -Method POST -Path "/api/v1/presentations/$createdID/slides" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF; "If-Match" = [string]$beforeInsert.revision } -Body (@{ position = 1; kind = "content"; content = @{ text = "Inserted between existing slides" } } | ConvertTo-Json -Compress) -ExpectedStatus 201
  $insertedPayload = $insertedResponse.Content | ConvertFrom-Json
  $insertedID = $insertedPayload.id
  $afterInsert = (Invoke-API -Method GET -Path "/api/v1/presentations/$createdID" -Client $loginClient -ExpectedStatus 200).Content | ConvertFrom-Json
  if ($afterInsert.slides.Count -ne 3 -or $afterInsert.slides[1].id -ne $insertedID -or $afterInsert.slides[2].id -ne $questionID) { throw "Slide insertion did not shift occupied positions atomically" }
  Invoke-API -Method DELETE -Path "/api/v1/presentations/$createdID/slides/$insertedID" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF; "If-Match" = [string]$insertedPayload.revision } -ExpectedStatus 204 | Out-Null

  $beforeMetadataUpdate = (Invoke-API -Method GET -Path "/api/v1/presentations/$createdID" -Client $loginClient -ExpectedStatus 200).Content | ConvertFrom-Json
  $updated = Invoke-API -Method PATCH -Path "/api/v1/presentations/$createdID" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF; "If-Match" = [string]$beforeMetadataUpdate.revision } -Body (@{ title = "Updated through API"; settings = @{ background_color = "#112233"; show_music = $true } } | ConvertTo-Json -Compress) -ExpectedStatus 200
  $updatedPayload = $updated.Content | ConvertFrom-Json
  if ($updatedPayload.title -ne "Updated through API" -or $updatedPayload.settings.background_color -ne "#112233") { throw "Presentation metadata update was not persisted" }
  Invoke-API -Method PATCH -Path "/api/v1/presentations/$createdID" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF; "If-Match" = [string]$beforeMetadataUpdate.revision } -Body (@{ title = "Stale overwrite" } | ConvertTo-Json -Compress) -ExpectedStatus 409 | Out-Null
  $afterStaleUpdate = (Invoke-API -Method GET -Path "/api/v1/presentations/$createdID" -Client $loginClient -ExpectedStatus 200).Content | ConvertFrom-Json
  if ($afterStaleUpdate.title -ne "Updated through API") { throw "Stale presentation edit overwrote the committed title" }
  $beforeSlideUpdate = (Invoke-API -Method GET -Path "/api/v1/presentations/$createdID" -Client $loginClient -ExpectedStatus 200).Content | ConvertFrom-Json
  $contentBeforeUpdate = @($beforeSlideUpdate.slides | Where-Object { $_.id -eq $contentID })[0]
  Invoke-API -Method PUT -Path "/api/v1/presentations/$createdID/slides/$contentID" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF; "If-Match" = [string]$contentBeforeUpdate.revision } -Body (@{ position = 0; kind = "content"; content = @{ text = "Updated content"; image_url = "" } } | ConvertTo-Json -Compress) -ExpectedStatus 200 | Out-Null
  $beforeFirstReorder = (Invoke-API -Method GET -Path "/api/v1/presentations/$createdID" -Client $loginClient -ExpectedStatus 200).Content | ConvertFrom-Json
  Invoke-API -Method POST -Path "/api/v1/presentations/$createdID/slides/reorder" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF; "If-Match" = [string]$beforeFirstReorder.revision } -Body (@{ slide_ids = @($questionID, $contentID) } | ConvertTo-Json -Compress) -ExpectedStatus 204 | Out-Null
  $beforeSecondReorder = (Invoke-API -Method GET -Path "/api/v1/presentations/$createdID" -Client $loginClient -ExpectedStatus 200).Content | ConvertFrom-Json
  Invoke-API -Method POST -Path "/api/v1/presentations/$createdID/slides/reorder" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF; "If-Match" = [string]$beforeSecondReorder.revision } -Body (@{ slide_ids = @($contentID, $questionID) } | ConvertTo-Json -Compress) -ExpectedStatus 204 | Out-Null
  $duplicate = Invoke-API -Method POST -Path "/api/v1/presentations/$createdID/duplicate" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ title = "Integration duplicate" } | ConvertTo-Json -Compress) -ExpectedStatus 201
  $duplicateID = ($duplicate.Content | ConvertFrom-Json).id
  $ownedList = Invoke-API -Method GET -Path "/api/v1/presentations" -Client $loginClient -ExpectedStatus 200
  $ownedIDs = @(($ownedList.Content | ConvertFrom-Json) | ForEach-Object { $_.id })
  if ($ownedIDs -notcontains $createdID -or $ownedIDs -notcontains $duplicateID) { throw "Owned presentation list omitted created content" }
  $createdRead = Invoke-API -Method GET -Path "/api/v1/presentations/$createdID" -Client $loginClient -ExpectedStatus 200
  $customAccessCode = ("Q" + [guid]::NewGuid().ToString("N").Substring(0, 11)).ToUpperInvariant()
  $accessCodeResponse = Invoke-API -Method PUT -Path "/api/v1/presentations/$createdID/access-code" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ access_code = $customAccessCode.ToLowerInvariant() } | ConvertTo-Json -Compress) -ExpectedStatus 200
  $accessCodePayload = $accessCodeResponse.Content | ConvertFrom-Json
  if ($accessCodePayload.access_code -ne $customAccessCode) { throw "Access code was not normalized and persisted" }
  $presentationWithCode = (Invoke-API -Method GET -Path "/api/v1/presentations/$createdID" -Client $loginClient -ExpectedStatus 200).Content | ConvertFrom-Json
  if ($presentationWithCode.access_code -ne $customAccessCode) { throw "Presentation response omitted its access code" }
  $createdPayload = $createdRead.Content | ConvertFrom-Json
  if ($createdPayload.slides.Count -ne 2 -or $createdPayload.slides[0].id -ne $contentID -or $createdPayload.slides[0].content.text -ne "Updated content") { throw "Presentation editor round trip was incomplete or out of order" }

  $createSessionRequest = [guid]::NewGuid().ToString()
  $liveCreated = Invoke-API -Method POST -Path "/api/v1/live/sessions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = $createSessionRequest; presentation_id = $createdID } | ConvertTo-Json -Compress) -ExpectedStatus 201
  $liveSession = $liveCreated.Content | ConvertFrom-Json
  if ($liveSession.join_code -ne $customAccessCode) { throw "Live session did not use the presentation access code" }
  Invoke-API -Method POST -Path "/api/v1/live/sessions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = $createSessionRequest; presentation_id = $createdID } | ConvertTo-Json -Compress) -ExpectedStatus 200 | Out-Null

  $startRequest = [guid]::NewGuid().ToString()
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/actions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = $startRequest; expected_state_version = 1; action = "start" } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/actions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = $startRequest; expected_state_version = 1; action = "start" } | ConvertTo-Json -Compress) -ExpectedStatus 200 | Out-Null
  Invoke-API -Method DELETE -Path "/api/v1/presentations/$createdID/results" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -ExpectedStatus 409 | Out-Null
  Invoke-API -Method DELETE -Path "/api/v1/presentations/$createdID" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -ExpectedStatus 409 | Out-Null

  $afterSessionCreated = (Invoke-API -Method GET -Path "/api/v1/presentations/$createdID" -Client $loginClient -ExpectedStatus 200).Content | ConvertFrom-Json
  $editableContent = @($afterSessionCreated.slides | Where-Object { $_.id -eq $contentID })[0]
  Invoke-API -Method PUT -Path "/api/v1/presentations/$createdID/slides/$contentID" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF; "If-Match" = [string]$editableContent.revision } -Body (@{ position = 0; kind = "content"; content = @{ text = "Changed after live snapshot"; image_url = "" } } | ConvertTo-Json -Compress) -ExpectedStatus 200 | Out-Null

  $participantHandler = [System.Net.Http.HttpClientHandler]::new()
  $participantHandler.UseProxy = $false
  $participantCookies = [System.Net.CookieContainer]::new()
  $participantHandler.CookieContainer = $participantCookies
  $participantClient = [System.Net.Http.HttpClient]::new($participantHandler)
  $participantClient.Timeout = [TimeSpan]::FromSeconds(10)
  $joinRequest = [guid]::NewGuid().ToString()
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/join" -Client $participantClient -Body (@{ request_id = $joinRequest; display_name = "Live Player"; avatar = "P" } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/join" -Client $participantClient -Body (@{ request_id = $joinRequest; display_name = "Live Player"; avatar = "P" } | ConvertTo-Json -Compress) -ExpectedStatus 200 | Out-Null

  $burstJoinClients = @()
  $burstJoinTasks = @()
  for ($burstIndex = 0; $burstIndex -lt 16; $burstIndex++) {
    $burstHandler = [System.Net.Http.HttpClientHandler]::new()
    $burstHandler.UseProxy = $false
    $burstClient = [System.Net.Http.HttpClient]::new($burstHandler)
    $burstPayload = @{ request_id = [guid]::NewGuid().ToString(); display_name = "Burst Player $burstIndex"; avatar = "B" } | ConvertTo-Json -Compress
    $burstContent = [System.Net.Http.StringContent]::new($burstPayload, [System.Text.Encoding]::UTF8, "application/json")
    $burstJoinClients += @{ Client = $burstClient; Handler = $burstHandler; Content = $burstContent }
    $burstJoinTasks += $burstClient.PostAsync("$apiBaseUrl/api/v1/live/sessions/$($liveSession.id)/join", $burstContent)
  }
  [System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]$burstJoinTasks)
  foreach ($burstTask in $burstJoinTasks) {
    $burstResponse = $burstTask.GetAwaiter().GetResult()
    if ([int]$burstResponse.StatusCode -ne 201) { throw "Concurrent join burst returned $([int]$burstResponse.StatusCode)" }
    $burstResponse.Dispose()
  }
  foreach ($burstResource in $burstJoinClients) {
    $burstResource.Content.Dispose()
    $burstResource.Client.Dispose()
    $burstResource.Handler.Dispose()
  }

  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/actions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = [guid]::NewGuid().ToString(); expected_state_version = 2; action = "open_question"; slide_id = $questionID } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null
  $answerRequest = [guid]::NewGuid().ToString()
  $answer = Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/answers" -Client $participantClient -Body (@{ request_id = $answerRequest; question_slide_id = $questionID; selected_option_indexes = @(0, 1) } | ConvertTo-Json -Compress) -ExpectedStatus 201
  if (($answer.Content | ConvertFrom-Json).score_delta -ne 100) { throw "Correct multiple answer was not scored at 100" }
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/answers" -Client $participantClient -Body (@{ request_id = $answerRequest; question_slide_id = $questionID; selected_option_indexes = @(0, 1) } | ConvertTo-Json -Compress) -ExpectedStatus 200 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/answers" -Client $participantClient -Body (@{ request_id = [guid]::NewGuid().ToString(); question_slide_id = $questionID; selected_option_indexes = @(0) } | ConvertTo-Json -Compress) -ExpectedStatus 409 | Out-Null
  Invoke-API -Method GET -Path "/api/v1/presentations/$createdID/sessions/$($liveSession.id)/questions/$questionID/results" -Client $participantClient -ExpectedStatus 401 | Out-Null
  $questionResults = Invoke-API -Method GET -Path "/api/v1/presentations/$createdID/sessions/$($liveSession.id)/questions/$questionID/results?limit=1" -Client $loginClient -ExpectedStatus 200
  $questionResultsPayload = $questionResults.Content | ConvertFrom-Json
  if ($questionResultsPayload.response_count -ne 1 -or $questionResultsPayload.leaderboard.Count -ne 1 -or $questionResultsPayload.leaderboard[0].score -ne 100 -or $questionResultsPayload.leaderboard[0].rank -ne 1) { throw "Question leaderboard was not derived from the durable Go answer" }
  if ($questionResultsPayload.options[0].number_of_submits -ne 1 -or $questionResultsPayload.options[1].number_of_submits -ne 1 -or $questionResultsPayload.options[2].number_of_submits -ne 0) { throw "Question option counts were incorrect" }
  if ($questionResults.Content -match 'token|password_hash|request_id') { throw "Question results disclosed authentication or idempotency data" }
  $snapshot = Invoke-API -Method GET -Path "/api/v1/live/sessions/$($liveSession.id)/snapshot" -Client $participantClient -ExpectedStatus 200
  $snapshotPayload = $snapshot.Content | ConvertFrom-Json
  if ($snapshotPayload.role -ne "participant" -or $snapshotPayload.participant.score -ne 100) { throw "Participant snapshot did not contain only the caller score" }
  if ($snapshotPayload.PSObject.Properties.Name -contains "participants" -or $snapshotPayload.PSObject.Properties.Name -contains "scores") { throw "Participant snapshot disclosed the complete roster or score map" }
  if ($snapshotPayload.session.PSObject.Properties.Name -contains "host_id" -or $snapshotPayload.session.PSObject.Properties.Name -contains "join_code") { throw "Participant snapshot disclosed manager-only session fields" }
  if ($snapshot.Content -match 'is_correct|correct_option_indexes|correct_answer') { throw "Participant snapshot disclosed question correctness metadata" }
  if ($snapshotPayload.participant_count -ne 17 -or $snapshotPayload.last_event_id -lt 1) { throw "Snapshot did not include its participant count and SSE recovery cursor" }

  $managerSnapshot = Invoke-API -Method GET -Path "/api/v1/live/sessions/$($liveSession.id)/snapshot" -Client $loginClient -ExpectedStatus 200
  $managerSnapshotPayload = $managerSnapshot.Content | ConvertFrom-Json
  if ($managerSnapshotPayload.role -ne "manager" -or $managerSnapshotPayload.participant_count -ne 17 -or $managerSnapshotPayload.last_event_id -lt $snapshotPayload.last_event_id) { throw "Manager snapshot did not contain aggregate state and a valid recovery cursor" }
  if ($managerSnapshotPayload.PSObject.Properties.Name -contains "participants" -or $managerSnapshotPayload.PSObject.Properties.Name -contains "scores") { throw "Manager snapshot returned an unbounded roster" }
  $resolvedSession = Invoke-API -Method GET -Path "/api/v1/live/sessions/resolve?join_code=$($liveSession.join_code)" -Client $participantClient -ExpectedStatus 200
  $resolvedSessionPayload = $resolvedSession.Content | ConvertFrom-Json
  if ($resolvedSessionPayload.session_id -ne $liveSession.id -or $resolvedSessionPayload.presentation_id -ne $createdID) { throw "Join-code resolution did not return the active live session" }
  if ($resolvedSessionPayload.presentation.title -ne "Updated through API" -or $resolvedSessionPayload.presentation.background_color -ne "#112233" -or $resolvedSessionPayload.presentation.text_color -ne "#ffffff") { throw "Join-code resolution did not return the display-safe presentation theme" }
  foreach ($forbiddenThemeField in @("slides", "owner_id", "settings")) {
    if ($resolvedSessionPayload.presentation.PSObject.Properties.Name -contains $forbiddenThemeField) { throw "Public presentation theme disclosed $forbiddenThemeField" }
  }
  $previousAccessCode = $liveSession.join_code
  $replacementAccessCode = ("R" + [guid]::NewGuid().ToString("N").Substring(0, 11)).ToUpperInvariant()
  Invoke-API -Method PUT -Path "/api/v1/presentations/$createdID/access-code" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ access_code = $replacementAccessCode } | ConvertTo-Json -Compress) -ExpectedStatus 200 | Out-Null
  Invoke-API -Method GET -Path "/api/v1/live/sessions/resolve?join_code=$previousAccessCode" -Client $participantClient -ExpectedStatus 404 | Out-Null
  $replacementResolution = (Invoke-API -Method GET -Path "/api/v1/live/sessions/resolve?join_code=$replacementAccessCode" -Client $participantClient -ExpectedStatus 200).Content | ConvertFrom-Json
  if ($replacementResolution.session_id -ne $liveSession.id) { throw "Replacement access code did not resolve the active session" }
  $liveSession.join_code = $replacementAccessCode
  Invoke-API -Method GET -Path "/api/v1/live/sessions/$($liveSession.id)/roster" -Client $participantClient -ExpectedStatus 401 | Out-Null

  $rosterIDs = @()
  $rosterCursor = $null
  do {
    $rosterPath = "/api/v1/live/sessions/$($liveSession.id)/roster?order=joined&limit=5"
    if ($rosterCursor) { $rosterPath += "&cursor=$([Uri]::EscapeDataString($rosterCursor))" }
    $rosterResponse = Invoke-API -Method GET -Path $rosterPath -Client $loginClient -ExpectedStatus 200
    $rosterPage = $rosterResponse.Content | ConvertFrom-Json
    if ($rosterPage.items.Count -gt 5 -or $rosterPage.limit -ne 5 -or $rosterPage.order -ne "joined") { throw "Roster page was not bounded or ordered as requested" }
    $rosterIDs += @($rosterPage.items | ForEach-Object { $_.participant_id })
    $rosterCursor = $rosterPage.next_cursor
  } while ($rosterPage.has_more)
  if ($rosterIDs.Count -ne 17 -or ($rosterIDs | Sort-Object -Unique).Count -ne 17) { throw "Roster pagination skipped or duplicated participants" }

  $leaderboardPage = Invoke-API -Method GET -Path "/api/v1/live/sessions/$($liveSession.id)/roster?order=score&limit=5" -Client $loginClient -ExpectedStatus 200
  $leaderboardPayload = $leaderboardPage.Content | ConvertFrom-Json
  if ($leaderboardPayload.items[0].participant_id -ne $snapshotPayload.participant.id -or $leaderboardPayload.items[0].score -ne 100) { throw "Leaderboard ordering was not score-descending and stable" }
  $expireSQL = "UPDATE live_sessions SET ends_at=clock_timestamp()-interval '1 second' WHERE id='$($liveSession.id)';"
  & docker @composeArgs exec -T postgres psql -U proslides -d proslides -v ON_ERROR_STOP=1 -c $expireSQL | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not expire the live question integration fixture" }
  $expiredSnapshot = (Invoke-API -Method GET -Path "/api/v1/live/sessions/$($liveSession.id)/snapshot" -Client $participantClient -ExpectedStatus 200).Content | ConvertFrom-Json
  if ($expiredSnapshot.session.state -ne "question_closed" -or $expiredSnapshot.session.ends_at -ne $null -or $expiredSnapshot.question_stats.response_count -ne 1) { throw "Server deadline did not durably close the question with recoverable stats" }
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/actions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = [guid]::NewGuid().ToString(); expected_state_version = 4; action = "show_leaderboard" } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null

  $eventRequest = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, "$apiBaseUrl/api/v1/live/sessions/$($liveSession.id)/events")
  $eventResponse = $participantClient.SendAsync($eventRequest, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
  if ([int]$eventResponse.StatusCode -ne 200 -or $eventResponse.Content.Headers.ContentType.MediaType -ne "text/event-stream") {
    throw "SSE endpoint did not return a successful event stream"
  }
  $eventReader = [System.IO.StreamReader]::new($eventResponse.Content.ReadAsStreamAsync().GetAwaiter().GetResult())
  $firstEventIDLine = $eventReader.ReadLineAsync().GetAwaiter().GetResult()
  $firstEventNameLine = $eventReader.ReadLineAsync().GetAwaiter().GetResult()
  if ($firstEventIDLine -notmatch '^id: ([0-9]+)$') {
    throw "SSE initial replay did not contain a durable event ID"
  }
  $firstEventID = [long]$Matches[1]
  if ($firstEventNameLine -notmatch '^event: session\.created$') {
    throw "SSE initial replay did not start with the durable session.created event"
  }
  $eventReader.Dispose()
  $eventResponse.Dispose()
  $eventRequest.Dispose()

  $resumeRequest = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, "$apiBaseUrl/api/v1/live/sessions/$($liveSession.id)/events")
  $resumeRequest.Headers.Add("Last-Event-ID", $firstEventID.ToString())
  $resumeResponse = $participantClient.SendAsync($resumeRequest, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
  $resumeReader = [System.IO.StreamReader]::new($resumeResponse.Content.ReadAsStreamAsync().GetAwaiter().GetResult())
  $resumedEventIDLine = $resumeReader.ReadLineAsync().GetAwaiter().GetResult()
  if ($resumedEventIDLine -notmatch '^id: ([0-9]+)$' -or [long]$Matches[1] -le $firstEventID) {
    throw "SSE Last-Event-ID replay did not resume after the acknowledged event"
  }
  $resumedEventNames = @()
  $currentEventName = $null
  $leaderboardEventValidated = $false
  for ($lineNumber = 0; $lineNumber -lt 100; $lineNumber++) {
    $eventLine = $resumeReader.ReadLineAsync().GetAwaiter().GetResult()
    if ($eventLine -match '^event: (.+)$') {
      $currentEventName = $Matches[1]
      $resumedEventNames += $currentEventName
    } elseif ($currentEventName -eq 'leaderboard.updated' -and $eventLine -match '^data: (.+)$') {
      $leaderboardEvent = $Matches[1] | ConvertFrom-Json
      if ($leaderboardEvent.schema_version -ne 2 -or $leaderboardEvent.payload.participant_count -ne 17 -or $leaderboardEvent.payload -is [System.Array] -or $leaderboardEvent.payload.PSObject.Properties.Name -contains 'participant_id') {
        throw "leaderboard.updated disclosed roster rows instead of an aggregate notification"
      }
      $leaderboardEventValidated = $true
      break
    }
  }
  if ($resumedEventNames -notcontains 'answer.stats' -or $resumedEventNames -notcontains 'leaderboard.updated' -or -not $leaderboardEventValidated) {
    throw "SSE replay did not contain the aggregated answer.stats and leaderboard.updated events"
  }
  $resumeReader.Dispose()
  $resumeResponse.Dispose()
  $resumeRequest.Dispose()

  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/actions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = [guid]::NewGuid().ToString(); expected_state_version = 5; action = "open_content"; slide_id = $contentID } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null
  $frozenContentSnapshot = (Invoke-API -Method GET -Path "/api/v1/live/sessions/$($liveSession.id)/snapshot" -Client $loginClient -ExpectedStatus 200).Content | ConvertFrom-Json
  if ($frozenContentSnapshot.active_slide.content.text -ne "Updated content") { throw "Live run observed an editor mutation made after its immutable snapshot" }
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/actions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = [guid]::NewGuid().ToString(); expected_state_version = 6; action = "open_question"; slide_id = $questionID } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/actions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = [guid]::NewGuid().ToString(); expected_state_version = 7; action = "end" } | ConvertTo-Json -Compress) -ExpectedStatus 409 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/actions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = [guid]::NewGuid().ToString(); expected_state_version = 7; action = "close_question" } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/actions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = [guid]::NewGuid().ToString(); expected_state_version = 8; action = "show_leaderboard" } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/actions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = [guid]::NewGuid().ToString(); expected_state_version = 9; action = "end" } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null
  $endedSnapshot = Invoke-API -Method GET -Path "/api/v1/live/sessions/$($liveSession.id)/snapshot" -Client $participantClient -ExpectedStatus 200
  $endedSnapshotPayload = $endedSnapshot.Content | ConvertFrom-Json
  if ($endedSnapshotPayload.session.state -ne "ended" -or $endedSnapshotPayload.session.active_slide_id -ne $null -or $endedSnapshotPayload.participant.score -ne 100) { throw "Participant ended snapshot did not preserve final self state" }
  Invoke-API -Method GET -Path "/api/v1/live/sessions/resolve?join_code=$($liveSession.join_code)" -Client $participantClient -ExpectedStatus 404 | Out-Null

  $presentationSQL = "INSERT INTO presentations (owner_id, title) VALUES ('$($registeredUser.id)', 'Integration presentation') RETURNING id::text;"
  $presentationID = (& docker @composeArgs exec -T postgres psql -U proslides -d proslides -q -t -A -v ON_ERROR_STOP=1 -c $presentationSQL).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($presentationID)) {
    throw "Could not create the presentation integration fixture"
  }
  $slidesSQL = "INSERT INTO slides (presentation_id, position, kind, content) VALUES ('$presentationID', 0, 'content', jsonb_build_object('text', 'first')), ('$presentationID', 1, 'content', jsonb_build_object('text', 'second'));"
  & docker @composeArgs exec -T postgres psql -U proslides -d proslides -v ON_ERROR_STOP=1 -c $slidesSQL | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create the slide integration fixtures" }
  $presentation = Invoke-API -Method GET -Path "/api/v1/presentations/$presentationID" -Client $loginClient -ExpectedStatus 200
  $presentationPayload = $presentation.Content | ConvertFrom-Json
  if ($presentationPayload.slides.Count -ne 2 -or $presentationPayload.slides[0].position -ne 0) {
    throw "Presentation response did not return ordered slides"
  }

  $otherCookieJar = [System.Net.CookieContainer]::new()
  $otherHandler = [System.Net.Http.HttpClientHandler]::new()
  $otherHandler.UseProxy = $false
  $otherHandler.CookieContainer = $otherCookieJar
  $otherClient = [System.Net.Http.HttpClient]::new($otherHandler)
  $otherClient.Timeout = [TimeSpan]::FromSeconds(10)
  $otherEmail = "presentation-reader-$([guid]::NewGuid().ToString('N').Substring(0, 16))@example.test"
  Invoke-API -Method POST -Path "/api/v1/auth/register" -Client $otherClient -Body (@{ email = $otherEmail; display_name = "Other User"; password = $password } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null
  $otherCSRF = $otherCookieJar.GetCookies($apiBaseUrl)["proslides_csrf"].Value
  Invoke-API -Method GET -Path "/api/v1/presentations/$presentationID" -Client $otherClient -ExpectedStatus 404 | Out-Null
  Invoke-API -Method PATCH -Path "/api/v1/presentations/$createdID" -Client $otherClient -Headers @{ "X-CSRF-Token" = $otherCSRF } -Body (@{ title = "Unauthorized update" } | ConvertTo-Json -Compress) -ExpectedStatus 404 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/presentations/$createdID/slides/reorder" -Client $otherClient -Headers @{ "X-CSRF-Token" = $otherCSRF } -Body (@{ slide_ids = @() } | ConvertTo-Json -Compress) -ExpectedStatus 404 | Out-Null
  Invoke-API -Method DELETE -Path "/api/v1/presentations/$createdID/results" -Client $otherClient -Headers @{ "X-CSRF-Token" = $otherCSRF } -ExpectedStatus 404 | Out-Null
  Invoke-API -Method GET -Path "/api/v1/presentations/$createdID/sessions/$($liveSession.id)/questions/$questionID/results" -Client $otherClient -ExpectedStatus 404 | Out-Null
  Invoke-API -Method PUT -Path "/api/v1/presentations/$duplicateID/access-code" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ access_code = $liveSession.join_code } | ConvertTo-Json -Compress) -ExpectedStatus 409 | Out-Null

  Invoke-API -Method DELETE -Path "/api/v1/presentations/$duplicateID" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -ExpectedStatus 204 | Out-Null
  Invoke-API -Method GET -Path "/api/v1/presentations/$duplicateID" -Client $loginClient -ExpectedStatus 404 | Out-Null

  Write-Host "Authentication Compose integration matrix passed."
} finally {
  if ($StopAfter) {
    & docker @composeArgs down
    if ($LASTEXITCODE -ne 0) { throw "docker compose down failed" }
  }
  if ($client) { $client.Dispose() }
  if ($handler) { $handler.Dispose() }
  if ($loginClient) { $loginClient.Dispose() }
  if ($loginHandler) { $loginHandler.Dispose() }
  if ($otherClient) { $otherClient.Dispose() }
  if ($otherHandler) { $otherHandler.Dispose() }
  if ($participantClient) { $participantClient.Dispose() }
  if ($participantHandler) { $participantHandler.Dispose() }
  Pop-Location
}
