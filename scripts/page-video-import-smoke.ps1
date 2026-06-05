# Page Video Import API smoke test (requires Pro running with library open)
param(
  [string]$BaseUrl = 'http://127.0.0.1:41596/api/v1',
  [string]$Token = '',
  [int]$PollMaxSec = 180,
  [switch]$SkipDownload
)

$ErrorActionPreference = 'Stop'

function Invoke-Api {
  param([string]$Method, [string]$Path, [object]$Body = $null)
  $headers = @{ Accept = 'application/json' }
  if ($Token) { $headers['Authorization'] = "Bearer $Token" }
  $uri = "$BaseUrl$Path"
  if ($Body) {
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Depth 8)
  }
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
}

function Assert-Ok($resp, [string]$label) {
  if ($resp.status -ne 'success') {
    throw "$label failed: $($resp | ConvertTo-Json -Compress)"
  }
}

$passed = 0
$failed = 0

function Pass([string]$msg) { Write-Host "[PASS] $msg" -ForegroundColor Green; $script:passed++ }
function Fail([string]$msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; $script:failed++ }

Write-Host "=== Page Video Import smoke ===" -ForegroundColor Cyan
Write-Host "Base: $BaseUrl"

# 1. app/info
try {
  $app = Invoke-Api GET '/app/info'
  Assert-Ok $app 'app/info'
  $feats = @($app.data.features)
  if ($feats -contains 'pageVideoImport') {
    Pass "app/info features contains pageVideoImport (ytdlp=$($app.data.ytdlp.version))"
  } else {
    Fail "app/info missing pageVideoImport feature (yt-dlp not detected by Pro?)"
  }
} catch {
  Fail "app/info — $($_.Exception.Message)"
}

# 2. capability probe
try {
  Invoke-Api GET '/asset/pageVideoImport/jobs/pvi___capability_probe___' | Out-Null
  Fail 'probe should return error JOB_NOT_FOUND'
} catch {
  if ($_.ErrorDetails.Message -match 'JOB_NOT_FOUND') {
    Pass 'capability probe returns JOB_NOT_FOUND'
  } elseif ($_.Exception.Message -match 'JOB_NOT_FOUND') {
    Pass 'capability probe returns JOB_NOT_FOUND'
  } else {
    Fail "probe unexpected error: $($_.Exception.Message) $($_.ErrorDetails.Message)"
  }
}

# 3. reject direct mp4
try {
  Invoke-Api POST '/asset/pageVideoImport' @{
    url = 'https://cdn.example.com/sample.mp4'
  } | Out-Null
  Fail 'direct mp4 should be rejected'
} catch {
  if ($_.ErrorDetails.Message -match 'PAGE_VIDEO_NOT_SUPPORTED') {
    Pass 'direct mp4 rejected (PAGE_VIDEO_NOT_SUPPORTED)'
  } else {
    Fail "direct mp4 error: $($_.ErrorDetails.Message)"
  }
}

if ($SkipDownload) {
  Write-Host "`nSkipped download test (-SkipDownload)." -ForegroundColor Yellow
} else {
  # 4. create + poll short public video (Rick Roll — stable id)
  $testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  try {
    $create = Invoke-Api POST '/asset/pageVideoImport' @{
      url = $testUrl
      platform = 'youtube'
      duplicatePolicy = 'import_copy'
      cookiesFromBrowser = 'none'
      sourceMeta = @{ pageUrl = $testUrl; pageTitle = 'Smoke test' }
    }
    Assert-Ok $create 'create'
    $jobId = $create.data.jobId
    Pass "create job $jobId"

    $deadline = (Get-Date).AddSeconds($PollMaxSec)
    $terminal = $false
    while ((Get-Date) -lt $deadline) {
      Start-Sleep -Seconds 2
      $job = Invoke-Api GET "/asset/pageVideoImport/jobs/$jobId"
      Assert-Ok $job 'get job'
      $st = $job.data.status
      $pct = $job.data.progressPercent
      $stage = $job.data.stage
      Write-Host "  poll: status=$st stage=$stage progress=$pct"
      if ($st -in @('completed', 'failed', 'cancelled')) {
        $terminal = $true
        if ($st -eq 'completed' -and $job.data.assetId) {
          Pass "job completed assetId=$($job.data.assetId)"
        } elseif ($st -eq 'completed' -and $job.data.skipped) {
          Pass "job completed skipped existing=$($job.data.existingAssetId)"
        } elseif ($st -eq 'failed') {
          Fail "job failed: $($job.data.error.code) — $($job.data.error.message)"
        } else {
          Fail "job cancelled"
        }
        break
      }
    }
    if (-not $terminal) {
      Fail "job did not finish within ${PollMaxSec}s"
      try {
        Invoke-Api DELETE "/asset/pageVideoImport/jobs/$jobId" | Out-Null
        Pass 'cancel sent after timeout'
      } catch { }
    }
  } catch {
    if ($_.ErrorDetails.Message -match 'LIBRARY_NOT') {
      Fail "create — library not open. Open a library in Pro and retry."
    } elseif ($_.ErrorDetails.Message -match 'YTDLP_NOT_INSTALLED') {
      Fail 'create — YTDLP_NOT_INSTALLED (install yt-dlp / restart Pro)'
    } else {
      Fail "create/poll — $($_.Exception.Message) $($_.ErrorDetails.Message)"
    }
  }
}

Write-Host "`n=== Summary: $passed passed, $failed failed ===" -ForegroundColor Cyan
if ($failed -gt 0) { exit 1 }
exit 0
