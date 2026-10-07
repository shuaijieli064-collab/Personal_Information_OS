# SIGNAL E2E smoke — walks the full product loop against a RUNNING backend.
#   Usage: ./scripts/e2e-smoke.ps1 [-Base http://localhost:8080]
# Exit 0 = all mandatory checks passed; 1 = at least one FAILED.
# Needs: a backend started on a REBUILT database (see docs/RUNTIME_VERIFICATION.md).
param([string]$Base = "http://localhost:8080")

$ErrorActionPreference = "Stop"
$script:pass = 0; $script:fail = 0; $script:warn = 0
function Check([string]$name, [bool]$cond, [string]$detail = "") {
  if ($cond) { $script:pass++; "  [PASS] $name" }
  else { $script:fail++; "  [FAIL] $name $detail" }
}
function Warn([string]$name, [string]$detail = "") { $script:warn++; "  [WARN] $name $detail" }
function J($body) { $body | ConvertTo-Json -Depth 8 -Compress }

$stamp = Get-Date -Format "yyyyMMddHHmmss"
$email1 = "e2e1_$stamp@test.local"
$email2 = "e2e2_$stamp@test.local"
$pw = "E2e-Smoke-2026!"
$h1 = @{}; $h2 = @{}

"=== 1. public ping ==="
$ping = Invoke-RestMethod "$Base/api/v1/ping" -TimeoutSec 10
Check "ping" ($ping.success -eq $true)

"=== 2. auth: register / login / me / refresh / logout ==="
$r1 = Invoke-RestMethod -Method Post "$Base/api/v1/auth/register" -ContentType "application/json" `
  -Body (J @{ email = $email1; password = $pw; displayName = "E2E One" }) -TimeoutSec 10
Check "register user1" ($r1.success -and $r1.data.accessToken -and $r1.data.refreshToken)
$acc1 = $r1.data.accessToken; $ref1 = $r1.data.refreshToken
$h1 = @{ Authorization = "Bearer $acc1" }

$me = Invoke-RestMethod -Headers $h1 "$Base/api/v1/auth/me" -TimeoutSec 10
Check "me" ($me.success -and $me.data.email -eq $email1)

$lg = Invoke-RestMethod -Method Post "$Base/api/v1/auth/login" -ContentType "application/json" `
  -Body (J @{ email = $email1; password = $pw }) -TimeoutSec 10
Check "login" ($lg.success -and $lg.data.accessToken)
$acc1 = $lg.data.accessToken; $ref1 = $lg.data.refreshToken
$h1 = @{ Authorization = "Bearer $acc1" }

$rf = Invoke-RestMethod -Method Post "$Base/api/v1/auth/refresh" -ContentType "application/json" `
  -Body (J @{ refreshToken = $ref1 }) -TimeoutSec 10
Check "refresh rotates" ($rf.success -and $rf.data.accessToken -and ($rf.data.refreshToken -ne $ref1))
$acc1 = $rf.data.accessToken; $ref1 = $rf.data.refreshToken
$h1 = @{ Authorization = "Bearer $acc1" }

"=== 3. personalization: profile / goals / interests / skills ==="
$pf = Invoke-RestMethod -Method Patch -Headers $h1 "$Base/api/v1/profile" -ContentType "application/json" `
  -Body (J @{ bio = "E2E runner"; language = "en" }) -TimeoutSec 10
Check "profile patch" ($pf.success)
$goal = Invoke-RestMethod -Method Post -Headers $h1 "$Base/api/v1/goals" -ContentType "application/json" `
  -Body (J @{ title = "Spring Boot backend engineering"; priority = 1 }) -TimeoutSec 10
Check "goal create" ($goal.success -and $goal.data.id)
$int = Invoke-RestMethod -Method Post -Headers $h1 "$Base/api/v1/interests" -ContentType "application/json" `
  -Body (J @{ name = "Spring Boot" }) -TimeoutSec 10
Check "interest create" ($int.success)
$skl = Invoke-RestMethod -Method Post -Headers $h1 "$Base/api/v1/skills" -ContentType "application/json" `
  -Body (J @{ name = "Java"; level = "ADVANCED" }) -TimeoutSec 10
Check "skill create" ($skl.success)

"=== 4. ingestion: file import -> information ==="
$tmp = Join-Path $env:TEMP "e2e-signal-$stamp.md"
@"
# Spring Boot 4.1.1 ships modular mail and GraphQL support
Spring Boot 4.1.1 continues the modularization effort. The release upgrades Spring Framework,
improves GraalVM native image support, and tightens actuator health probes.
Our team invests in Spring Boot backend engineering this quarter, focusing on Java 21
virtual threads and AOT-optimized startup. Teams running Spring Boot on Java 21 report
faster startup after the AOT improvements, and the modular architecture makes it easier
to package production services with only the starters actually used at runtime.
"@ | Set-Content -Path $tmp -Encoding UTF8
$form = @{ file = Get-Item $tmp }
$imp = Invoke-RestMethod -Method Post -Headers $h1 "$Base/api/v1/import/file" -Form $form -TimeoutSec 30
Check "import file" ($imp.success)
$infoId = if ($imp.data.informationId) { $imp.data.informationId } elseif ($imp.data.id) { $imp.data.id }
if (-not $infoId) {
  $list0 = Invoke-RestMethod -Headers $h1 "$Base/api/v1/information?page=0&size=10" -TimeoutSec 10
  $infoId = $list0.data.items[0].id
}
Check "information id resolved" ([bool]$infoId) "(import response: $(J $imp.data))"
Remove-Item $tmp -Force -ErrorAction SilentlyContinue

$ilist = Invoke-RestMethod -Headers $h1 "$Base/api/v1/information?page=0&size=20" -TimeoutSec 10
Check "information list" ($ilist.success -and ($ilist.data.total -ge 1))
$idet = Invoke-RestMethod -Headers $h1 "$Base/api/v1/information/$infoId" -TimeoutSec 10
Check "information detail" ($idet.success -and ($idet.data.content -match "Spring Boot"))
  "(import title comes from filename: $($idet.data.title))"

"=== 5. understanding pipeline (Mock AI) ==="
$und = Invoke-RestMethod -Method Post -Headers $h1 "$Base/api/v1/information/$infoId/understanding" -TimeoutSec 30
Check "understanding process" ($und.success)
$ugt = Invoke-RestMethod -Headers $h1 "$Base/api/v1/information/$infoId/understanding" -TimeoutSec 10
Check "understanding row" ($ugt.success -and $ugt.data.status -eq "COMPLETED" -and $ugt.data.summary)
  "(status=$($ugt.data.status) model=$($ugt.data.model) relevance=$($ugt.data.relevanceScore) score=$($ugt.data.signalScore))"
$cls = Invoke-RestMethod -Method Post -Headers $h1 "$Base/api/v1/information/$infoId/classify" -TimeoutSec 30
Check "classify endpoint" ($cls.success)

"=== 6. signals / today / feedback ==="
$sig = Invoke-RestMethod -Headers $h1 "$Base/api/v1/signals?page=0&size=20" -TimeoutSec 10
Check "signals list" ($sig.success)
$sigId = $null
if ($sig.data.total -ge 1) { $sigId = $sig.data.items[0].id }
if ($sigId) {
  $sd = Invoke-RestMethod -Headers $h1 "$Base/api/v1/signals/$sigId" -TimeoutSec 10
  Check "signal detail" ($sd.success -and $sd.data.signalScore -ne $null)
  $sv = Invoke-RestMethod -Method Post -Headers $h1 "$Base/api/v1/signals/$sigId/save" -TimeoutSec 10
  Check "signal save" ($sv.success -and $sv.data.status -eq "SAVED")
  $fb = Invoke-RestMethod -Method Post -Headers $h1 "$Base/api/v1/signals/$sigId/feedback" -ContentType "application/json" `
    -Body (J @{ type = "USEFUL"; reason = "e2e" }) -TimeoutSec 10
  Check "feedback post" ($fb.success)
  $fbg = Invoke-RestMethod -Headers $h1 "$Base/api/v1/signals/$sigId/feedback" -TimeoutSec 10
  Check "feedback list" ($fbg.success)
} else {
  Warn "no signal generated" "(score < min-score=70 with Mock AI — see RUNTIME_VERIFICATION)"
}
$tdy = Invoke-RestMethod -Headers $h1 "$Base/api/v1/today" -TimeoutSec 10
Check "today brief" ($tdy.success -and $tdy.data.PSObject.Properties.Name -contains "informationCount")
  "(info=$($tdy.data.informationCount) signals=$($tdy.data.signalCount))"

"=== 7. sources CRUD + sync (network dependent) ==="
$src = Invoke-RestMethod -Method Post -Headers $h1 "$Base/api/v1/sources" -ContentType "application/json" `
  -Body (J @{ type = "RSS"; name = "HN Front"; url = "https://hnrss.org/frontpage" }) -TimeoutSec 10
Check "source create" ($src.success -and $src.data.id)
$srcId = $src.data.id
try {
  $syn = Invoke-RestMethod -Method Post -Headers $h1 "$Base/api/v1/sources/$srcId/sync" -TimeoutSec 60
  Check "source sync" ($syn.success) "(fetched=$($syn.data.fetched) created=$($syn.data.created) duplicates=$($syn.data.duplicates) failed=$($syn.data.failed))"
} catch { Warn "source sync" "network/collector issue: $($_.Exception.Message)" }
$sdel = Invoke-RestMethod -Method Delete -Headers $h1 "$Base/api/v1/sources/$srcId" -TimeoutSec 10
Check "source delete" ($sdel.success)

"=== 8. security: IDOR + auth rejection ==="
$r2 = Invoke-RestMethod -Method Post "$Base/api/v1/auth/register" -ContentType "application/json" `
  -Body (J @{ email = $email2; password = $pw; displayName = "E2E Two" }) -TimeoutSec 10
$h2 = @{ Authorization = "Bearer $($r2.data.accessToken)" }
$idor = $false
try { Invoke-RestMethod -Headers $h2 "$Base/api/v1/information/$infoId" -TimeoutSec 10 | Out-Null }
catch { $idor = ($_.Exception.Response.StatusCode.value__ -eq 404) }
Check "IDOR: user2 cannot read user1 information (404)" $idor
$anon = $false
try { Invoke-RestMethod "$Base/api/v1/today" -TimeoutSec 10 | Out-Null }
catch { $anon = ($_.Exception.Response.StatusCode.value__ -eq 401) }
Check "anonymous /today rejected (401)" $anon

"=== 9. logout ==="
$lo = Invoke-RestMethod -Method Post -Headers $h1 "$Base/api/v1/auth/logout" -ContentType "application/json" `
  -Body (J @{ refreshToken = $ref1 }) -TimeoutSec 10
Check "logout revokes" ($lo.success)
$dead = $false
try { Invoke-RestMethod -Method Post "$Base/api/v1/auth/refresh" -ContentType "application/json" `
    -Body (J @{ refreshToken = $ref1 }) -TimeoutSec 10 | Out-Null }
catch { $dead = ($_.Exception.Response.StatusCode.value__ -in 401,403) }
Check "revoked refresh rejected" $dead

""
"================ E2E SUMMARY ================"
"PASS=$script:pass  FAIL=$script:fail  WARN=$script:warn"
if ($script:fail -gt 0) { exit 1 } else { exit 0 }
