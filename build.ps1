# Focus Timer -- Windows build script
# Usage: Right-click build.ps1 -> "Run with PowerShell", or: .\build.ps1
# Output: release/Focus Timer Setup 1.0.0.exe  (installer)
#         release/FocusTimer-portable.exe       (run anywhere, no install)

Set-StrictMode -Off
$ErrorActionPreference = 'Continue'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   Focus Timer -- Build Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Python sidecar
Write-Host "[1/3] Building Python sidecar (FocusTimerSidecar.exe)..." -ForegroundColor Yellow

$hasPython = $null -ne (Get-Command python -ErrorAction SilentlyContinue)
$sidecarExe = Join-Path $root "app\resources\FocusTimerSidecar.exe"
$sidecarPy  = Join-Path $root "FocusTimerSidecar.py"

if (-not $hasPython) {
    Write-Host "  WARNING: Python not found. Skipping sidecar -- focus shield will be disabled." -ForegroundColor Red
} elseif (-not (Test-Path $sidecarPy)) {
    Write-Host "  WARNING: FocusTimerSidecar.py not found. Skipping." -ForegroundColor Red
} else {
    $hasPyInstaller = python -m PyInstaller --version 2>$null
    if (-not $hasPyInstaller) {
        Write-Host "  Installing PyInstaller..." -ForegroundColor Gray
        python -m pip install pyinstaller --quiet
    }

    Write-Host "  Compiling FocusTimerSidecar.py..." -ForegroundColor Gray
    python -m PyInstaller `
        --onefile `
        --noconsole `
        --name "FocusTimerSidecar" `
        --distpath "app\resources" `
        --workpath "app\build\pyinstaller_work" `
        --specpath "app\build\pyinstaller_spec" `
        $sidecarPy

    if ($LASTEXITCODE -eq 0 -and (Test-Path $sidecarExe)) {
        $size = [math]::Round((Get-Item $sidecarExe).Length / 1MB, 1)
        Write-Host "  Sidecar built: $($size) MB" -ForegroundColor Green
    } else {
        Write-Host "  Sidecar build failed. Focus shield will be disabled in the packaged app." -ForegroundColor Red
    }
}

Write-Host ""

# Step 2: Install npm deps
Write-Host "[2/3] Installing npm dependencies..." -ForegroundColor Yellow
Set-Location (Join-Path $root "app")
npm install --prefer-offline 2>&1 | Where-Object { $_ -notmatch "^npm warn" } | Out-Host

if ($LASTEXITCODE -ne 0) {
    Write-Host "npm install failed!" -ForegroundColor Red
    Set-Location $root; exit 1
}

Write-Host ""

# Step 3: Build & package
Write-Host "[3/3] Building Electron app + packaging .exe..." -ForegroundColor Yellow

$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
$env:WIN_CSC_LINK = ""
$env:ELECTRON_BUILDER_CACHE = "$env:LOCALAPPDATA\electron-builder\Cache"

npm run dist

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Build failed. See errors above." -ForegroundColor Red
    Set-Location $root; exit 1
}

# Copy output to release/
$tempDist = "C:\Users\$env:USERNAME\AppData\Local\Temp\ft-dist"
$releaseDir = Join-Path $root "release"
New-Item -ItemType Directory -Force $releaseDir | Out-Null

Get-ChildItem $tempDist -Filter "*.exe" | Where-Object { $_.Name -notmatch "uninstaller" } | ForEach-Object {
    Copy-Item $_.FullName $releaseDir -Force
    $sizeMB = [math]::Round($_.Length / 1MB, 1)
    Write-Host "  Copied: $($_.Name) ($sizeMB MB)" -ForegroundColor Green
}

Set-Location $root

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   Build complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Output files in: Focus-timer\release\" -ForegroundColor White
Write-Host ""
Get-ChildItem $releaseDir -Filter "*.exe" | ForEach-Object {
    $sizeMB = [math]::Round($_.Length / 1MB, 1)
    Write-Host "  $($_.Name)  ($sizeMB MB)" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "Installer (.exe Setup): installs Focus Timer with Start Menu shortcut." -ForegroundColor Gray
Write-Host "Portable  (.exe):       runs directly anywhere - no installation needed." -ForegroundColor Gray
Write-Host ""
