param(
  [string]$ArtifactDirectory = ".",
  [string]$Tag = "workpass64-2026-10-19"
)
$ErrorActionPreference = "Stop"
$required = @("NeuroCore_WORKPASS64_2026-10-19.zip","NeuroCore_Runtime_WORKPASS64.zip","NeuroCore_WORKPASS64_REPORT_RU.md","NeuroCore_WORKPASS64_AUDIT_SUMMARY.json","NeuroCore_WORKPASS64_SHA256SUMS.txt")
foreach ($name in $required) {
  $path = Join-Path $ArtifactDirectory $name
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing artifact: $path" }
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "Install GitHub CLI from https://cli.github.com/ and run gh auth login." }
gh auth status
if ($LASTEXITCODE -ne 0) { throw "GitHub CLI is not authenticated." }
$manifest = Join-Path $ArtifactDirectory "NeuroCore_WORKPASS64_SHA256SUMS.txt"
$expected = @{}
Get-Content -LiteralPath $manifest | ForEach-Object {
  if ($_ -match '^([0-9a-f]{64})\s+(.+)$') { $expected[$Matches[2].Trim()] = $Matches[1] }
}
foreach ($name in @($required[0], $required[1])) {
  if (-not $expected.ContainsKey($name)) { throw "Checksum missing from manifest: $name" }
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $ArtifactDirectory $name)).Hash.ToLowerInvariant()
  if ($actual -ne $expected[$name]) { throw "SHA-256 mismatch: $name" }
}
gh release view $Tag --repo ailtron1ss-rgb/NK1 *> $null
if ($LASTEXITCODE -ne 0) {
  gh release create $Tag --repo ailtron1ss-rgb/NK1 --title "NeuroCore WorkPass64 (2026-10-19)" --notes "WorkPass64 implementation snapshot. Not production-approved. See attached report for open gates and limitations."
  if ($LASTEXITCODE -ne 0) { throw "Could not create GitHub Release." }
}
foreach ($name in @($required[0],$required[1],$required[2],$required[3],$required[4])) {
  gh release upload $Tag (Join-Path $ArtifactDirectory $name) --repo ailtron1ss-rgb/NK1 --clobber
  if ($LASTEXITCODE -ne 0) { throw "Upload failed: $name" }
}
Write-Host "Published WorkPass64 assets to https://github.com/ailtron1ss-rgb/NK1/releases/tag/$Tag"
