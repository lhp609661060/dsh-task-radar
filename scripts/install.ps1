# =============================================================================
# dsh-task-radar one-line installer for Windows PowerShell
#
# Installs from GitHub into the DSH web profile via the official plugin CLI:
#   dsh plugin --profile web add github:<owner>/<repo>
#
# The repo ships prebuilt bundles under lib/, so the git install runs no
# prepare script and never trips over pnpm's allowBuilds gate.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/install.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/install.ps1 owner/repo
#   $env:PROFILE="foo"; powershell -ExecutionPolicy Bypass -File scripts/install.ps1
#
# Uninstall: dsh plugin --profile web remove dsh-task-radar
# =============================================================================
param(
  [string]$RepoArg = ""
)

$ErrorActionPreference = "Stop"

# TODO: change to the real GitHub owner/repo after publishing
$DefaultRepo = "lhp609661060/dsh-task-radar"
$ProfileName = if ($env:PROFILE) { $env:PROFILE } else { "web" }

$Repo = $RepoArg
if (-not $Repo) {
  $origin = $null
  try { $origin = (git config --get remote.origin.url 2>$null) } catch { }
  if ($origin -match 'git@github\.com:(?<p>[^ ]+?)(\.git)?$') {
    $Repo = $Matches.p
  } elseif ($origin -match 'https://github\.com/(?<p>[^ ]+?)(\.git)?$') {
    $Repo = $Matches.p
  } else {
    $Repo = $DefaultRepo
  }
}

$Dsh = Get-Command dsh -ErrorAction SilentlyContinue
if ($env:DSH_CMD) {
  $DshCmd = $env:DSH_CMD -split ' '
} elseif ($Dsh) {
  $DshCmd = @("dsh")
} else {
  $DshCmd = @("npx", "-y", "@deepseek-ai/dsh")
}

Write-Host ">> Installing dsh-task-radar (github:$Repo) into profile: $ProfileName"
& $DshCmd[0] ($DshCmd[1..($DshCmd.Length - 1)]) plugin --profile $ProfileName add "github:$Repo"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "✅ Installed. Restart DSH (or refresh the web page); the radar button appears bottom-right."
Write-Host "   Uninstall: dsh plugin --profile $ProfileName remove dsh-task-radar"
