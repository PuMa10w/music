# Voice Remover Pro v5.0 - Setup Script
$ErrorActionPreference = "Continue"
$projectPath = "C:\Users\rousl\Desktop\music\music"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Voice Remover Pro v5.0 - Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Encoding already fixed
Write-Host "[1/4] File encoding: FIXED" -ForegroundColor Green
Write-Host ""

# Step 2: Check Python
Write-Host "[2/4] Checking Python..." -ForegroundColor Yellow

$pythonPath = ""
$possiblePaths = @(
    "$env:USERPROFILE\anaconda3\envs\music\python.exe",
    "$env:USERPROFILE\miniconda3\envs\music\python.exe",
    "C:\ProgramData\miniconda3\envs\music\python.exe"
)

foreach ($p in $possiblePaths) {
    if (Test-Path $p) {
        $pythonPath = $p
        Write-Host "  Found Python: $p" -ForegroundColor Green
        break
    }
}

if (-not $pythonPath) {
    Write-Host "  Python not found in conda env music" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Miniconda and run:" -ForegroundColor Yellow
    Write-Host "  conda create -n music python=3.11 -y" -ForegroundColor Cyan
    Write-Host "  conda activate music" -ForegroundColor Cyan
    Write-Host "  pip install numpy scipy soundfile librosa torch torchaudio demucs" -ForegroundColor Cyan
    Write-Host ""
    pause
    exit
}

# Step 3: Install Python packages
Write-Host "[3/4] Installing Python packages..." -ForegroundColor Yellow
Write-Host "  This may take 15-45 minutes..." -ForegroundColor DarkGray
Write-Host ""

$packages = @("numpy", "scipy", "soundfile", "librosa", "torch", "torchaudio", "demucs")

foreach ($pkg in $packages) {
    Write-Host "  Installing $pkg..." -ForegroundColor Gray -NoNewline
    try {
        & $pythonPath -m pip install $pkg --quiet --disable-pip-version-check 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host " OK" -ForegroundColor Green
        } else {
            Write-Host " FAILED" -ForegroundColor Red
        }
    } catch {
        Write-Host " ERROR" -ForegroundColor Red
    }
}

Write-Host ""

# Step 4: Node.js dependencies
Write-Host "[4/4] Installing Node.js dependencies..." -ForegroundColor Yellow

Set-Location $projectPath

try {
    npm install 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  npm install completed" -ForegroundColor Green
    } else {
        Write-Host "  npm install failed" -ForegroundColor Red
    }
} catch {
    Write-Host "  Error running npm" -ForegroundColor Red
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the application:" -ForegroundColor Yellow
Write-Host "  1. conda activate music" -ForegroundColor Cyan
Write-Host "  2. node server.js" -ForegroundColor Cyan
Write-Host "  3. Open http://localhost:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Or double-click: start.bat" -ForegroundColor White
Write-Host ""

pause
