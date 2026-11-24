[CmdletBinding()]
param(
  [string]$Repository = "ailtron1ss-rgb/NK1",
  [string]$ExpectedBranch = "workpass70-source",
  [string]$OutputDirectory = "artifacts",
  [switch]$AllowRunnerUnavailable
)

$ErrorActionPreference = "Stop"

function Invoke-Gh {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)
  $output = & gh @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "GitHub CLI failed (exit $exitCode): $($output -join [Environment]::NewLine)"
  }
  return (($output | Out-String).Trim())
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git is required." }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "Install GitHub CLI from https://cli.github.com/ and run gh auth login."
}
Invoke-Gh -Arguments @("auth", "status") | Out-Null

$repoRoot = Invoke-Gh -Arguments @("rev-parse", "--show-toplevel")
Set-Location -LiteralPath $repoRoot

$currentBranch = Invoke-Gh -Arguments @("branch", "--show-current")
if ($currentBranch -ne $ExpectedBranch) {
  throw "Expected branch '$ExpectedBranch', found '$currentBranch'. Do not package main or another tree."
}

$head = Invoke-Gh -Arguments @("rev-parse", "HEAD")
if ($head -notmatch '^[0-9a-f]{40}$') { throw "Could not resolve a valid HEAD SHA." }

$workingTree = & git status --porcelain
if ($LASTEXITCODE -ne 0) { throw "Could not inspect git working tree." }
if (-not [string]::IsNullOrWhiteSpace(($workingTree | Out-String))) {
  throw "Working tree is not clean. Commit or remove local changes before creating a release archive."
}

$remoteHead = Invoke-Gh -Arguments @("api", "repos/$Repository/branches/$ExpectedBranch", "--jq", ".commit.sha")
if ($remoteHead -ne $head) {
  throw "Local HEAD $head does not match remote $ExpectedBranch HEAD $remoteHead. Fetch the latest source first."
}

$trackedCount = [int](((& git ls-files | Measure-Object -Line).Lines))
if ($LASTEXITCODE -ne 0) { throw "Could not count tracked source files." }
if ($trackedCount -lt 9000) {
  throw "Expected the complete NeuroCore source tree (at least 9,000 tracked files); found $trackedCount. Refusing to package a partial checkout."
}

# Publish only an exact HEAD. Override requires proof that GitHub never allocated a runner.
$runData = (Invoke-Gh -Arguments @(
  "api",
  "repos/$Repository/actions/workflows/workpass71-validation.yml/runs?branch=$ExpectedBranch&per_page=50"
)) | ConvertFrom-Json
$matchingRuns = @($runData.workflow_runs | Where-Object { $_.head_sha -eq $head } | Sort-Object created_at -Descending)
if ($matchingRuns.Count -eq 0) {
  throw "No core-validation run exists for exact HEAD $head. Push the sync commit and wait for its check."
}
$validationRun = $matchingRuns[0]
$validationPassed = $validationRun.conclusion -eq "success"
$runnerUnavailable = $false

if (-not $validationPassed) {
  if (-not $AllowRunnerUnavailable) {
    throw "Exact-HEAD validation is '$($validationRun.conclusion)', not success. To publish only an unvalidated prerelease after a proven runner-allocation failure, rerun with -AllowRunnerUnavailable."
  }
  if ($validationRun.conclusion -ne "failure" -or $validationRun.status -ne "completed") {
    throw "The exact-HEAD validation is not a completed runner-provisioning failure; refusing the override."
  }
  $jobsData = (Invoke-Gh -Arguments @(
    "api",
    "repos/$Repository/actions/runs/$($validationRun.id)/jobs?per_page=100"
  )) | ConvertFrom-Json
  $unallocated = @($jobsData.jobs | Where-Object { $_.runner_id -eq 0 -and @($_.steps).Count -eq 0 })
  if ($unallocated.Count -eq 0) {
    throw "The failed validation did not prove runner_id=0 with zero steps. Override refused."
  }
  $runnerUnavailable = $true
}

$shortSha = $head.Substring(0, 12)
$tag = "workpass70-main-sync-2026-10-22-$shortSha"
$stamp = "WORKPASS70_MAIN_SYNC_2026-10-22-$shortSha"
$prefix = "Neuro_Kurisu_$stamp/"
$zipName = "$stamp.zip"
$reportName = "$($stamp)_REPORT_RU.md"
$manifestName = "SHA256SUMS.txt"

$artifactRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutputDirectory))
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
$zipPath = Join-Path $artifactRoot $zipName
$reportPath = Join-Path $artifactRoot $reportName
$manifestPath = Join-Path $artifactRoot $manifestName

# Fail closed if the tag exists; treat only a genuine 404 as absent.
$tagProbe = & gh api "repos/$Repository/releases/tags/$tag" 2>&1
$tagProbeExit = $LASTEXITCODE
if ($tagProbeExit -eq 0) {
  throw "Release '$tag' already exists. Refusing to overwrite an existing release or its assets."
}
$tagProbeText = $tagProbe -join [Environment]::NewLine
if ($tagProbeText -notmatch '(?i)404|Not Found') {
  throw "Could not prove that tag '$tag' is absent. GitHub response: $tagProbeText"
}

if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
& git archive --format=zip --prefix=$prefix --output=$zipPath HEAD
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $zipPath -PathType Leaf)) {
  throw "git archive failed."
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entries = @($zip.Entries)
  if ($entries.Count -lt 9000) {
    throw "The ZIP has only $($entries.Count) entries; refusing to publish a partial archive."
  }
  foreach ($entry in $entries) {
    $name = $entry.FullName.Replace('\', '/')
    if ($name.StartsWith('/') -or $name -match '(^|/)\.\.(/|$)') {
      throw "Unsafe archive path detected: $name"
    }
  }
  $requiredSuffixes = @(
    "README.md",
    "CHANGELOG.md",
    ".github/workflows/workpass71-validation.yml",
    "scripts/publish-workpass70-main-sync.ps1",
    "runtime/neuro-kurisu/package.json"
  )
  foreach ($suffix in $requiredSuffixes) {
    if (-not ($entries | Where-Object { $_.FullName -eq "$prefix$suffix" })) {
      throw "Required source file is missing from the archive: $suffix"
    }
  }
}
finally {
  $zip.Dispose()
}

if ($validationPassed) {
  $verificationText = "Core validation: PASS for exact HEAD $head (run $($validationRun.id))."
  $releaseNotes = "Synchronized full source snapshot. ZIP integrity and source inventory checks passed. Core validation passed on the exact source SHA. This prerelease is still not production approval; real browser/Live2D E2E, endurance soak, independent retrieval uplift and full license review remain open."
}
else {
  $verificationText = "Core validation: BLOCKED BEFORE STEPS for exact HEAD $head (run $($validationRun.id)); runner_id=0 and no steps executed. Tests were not run."
  $releaseNotes = "Synchronized full source snapshot; ZIP integrity and source inventory checks passed. WARNING: core tests were NOT run because GitHub could not allocate a hosted runner (runner_id=0, zero steps). Published only as an explicitly unvalidated prerelease, not production approval. Real browser/Live2D E2E, endurance soak, independent retrieval uplift and full license review remain open."
}

$report = @"
# NeuroCore - WorkPass70 Main Sync

- Date: 2026-10-22
- Source branch: $ExpectedBranch
- Exact source SHA: $head
- Release tag: $tag
- Tracked source files: $trackedCount
- ZIP entries: $($entries.Count)
- ZIP integrity: PASS (archive opened; all entries enumerated; unsafe paths rejected)
- $verificationText

This artifact preserves the complete release-source tree and the current main-only files. It is an implementation prerelease, not a production-approved release. Remaining gates include real browser/Live2D/audio E2E, long-duration soak, independent retrieval/learning uplift and license review.
"@
Set-Content -LiteralPath $reportPath -Value $report -Encoding utf8

$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$reportHash = (Get-FileHash -LiteralPath $reportPath -Algorithm SHA256).Hash.ToLowerInvariant()
@("$zipHash  $zipName", "$reportHash  $reportName") |
  Set-Content -LiteralPath $manifestPath -Encoding ascii

Invoke-Gh -Arguments @(
  "release", "create", $tag,
  $zipPath, $reportPath, $manifestPath,
  "--repo", $Repository,
  "--target", $head,
  "--title", "NeuroCore WorkPass70 Main Sync ($shortSha)",
  "--notes", $releaseNotes,
  "--prerelease"
) | Out-Null

Write-Host "Release created: https://github.com/$Repository/releases/tag/$tag"
Write-Host "Archive: $zipPath"
Write-Host "Entries: $($entries.Count); SHA-256: $zipHash"
if ($runnerUnavailable) {
  Write-Warning "This prerelease was explicitly published with -AllowRunnerUnavailable. Core tests did not run."
}
