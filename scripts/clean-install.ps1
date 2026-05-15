# Clean node_modules when npm/pnpm left electron locked (Windows EBUSY / EPERM).
#
# IMPORTANT: Run from Windows Terminal / PowerShell OUTSIDE Cursor after:
#   - Quit Cursor completely (otherwise the indexer often locks electron\default_app.asar)
#   - Quit pnpm dev and AssetVault Pro
#
#   cd G:\work\soft_script\AssetVault_Pro
#   powershell -ExecutionPolicy Bypass -File scripts\clean-install.ps1
#
# Or from repo root (pnpm):
#   pnpm run clean:install

$ErrorActionPreference = 'Stop'
$root = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { Get-Location }
Set-Location $root

Write-Host "`n=== AssetVault Pro: clean install (pnpm only) ===" -ForegroundColor Cyan
Write-Host "Repo: $root`n"

# Windows: kill processes that lock node_modules\electron (default_app.asar, etc.)
foreach ($name in @('electron', 'AssetVault Pro', 'assetvault-pro')) {
  Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Stopping $($_.ProcessName) PID $($_.Id)..."
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
  }
}

# Catch any electron.exe tree (pnpm dev ships its own binary name)
$null = cmd /c 'taskkill /F /IM electron.exe /T 2>nul'

Start-Sleep -Seconds 3

@('package-lock.json', 'npm-shrinkwrap.json') | ForEach-Object {
  if (Test-Path $_) {
    Write-Host "Removing $_"
    Remove-Item $_ -Force
  }
}

function Remove-Tree($path) {
  if (-not (Test-Path -LiteralPath $path)) { return $true }
  Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction Stop
  return -not (Test-Path -LiteralPath $path)
}

if (Test-Path 'node_modules') {
  Write-Host "Removing node_modules..."
  $ok = $false
  foreach ($attempt in 1..3) {
    try {
      if (Remove-Tree 'node_modules') { $ok = $true; break }
    } catch {
      Write-Warning "Delete attempt $attempt : $($_.Exception.Message)"
    }
    if (-not $ok) {
      $trash = "_node_modules_trash_$attempt"
      if (Test-Path $trash) { Remove-Tree $trash | Out-Null }
      Write-Host "Trying rename node_modules -> $trash ..."
      try {
        Rename-Item -LiteralPath 'node_modules' -NewName $trash -Force -ErrorAction Stop
        $ok = -not (Test-Path 'node_modules')
        if ($ok) { Write-Host "Renamed away; fresh install can proceed. Delete $trash later if needed." }
      } catch {
        Write-Warning "Rename attempt $attempt : $($_.Exception.Message)"
      }
    }
    Start-Sleep -Seconds 2
  }

  if (Test-Path 'node_modules') {
    Write-Host ""
    Write-Host "FAILED: node_modules is still locked." -ForegroundColor Red
    Write-Host @"

Do this:
  1. Quit AssetVault Pro and every terminal running pnpm dev
  2. Quit Cursor completely (Task Manager: end Cursor.exe if needed)
  3. Open PowerShell from Start menu — not inside Cursor
  4. cd '$root'
  5. Run this script again

If it still fails: reboot, then step 3–5 before opening Cursor.

Do NOT run npm install in this repo — only pnpm install.

"@
    exit 1
  }
}

Write-Host "Running pnpm install..."
& pnpm install
exit $LASTEXITCODE
