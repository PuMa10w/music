# Voice Remover Pro - Fix Encoding and Install Dependencies
$ErrorActionPreference = "Continue"
$projectPath = "C:\Users\rousl\Desktop\music\music"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Voice Remover Pro v5.0 - Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Fix encoding
Write-Host "[1/4] Fixing file encoding..." -ForegroundColor Yellow
$files = @("separate.py", "stems.py", "analyze.py", "effects.py", "model_manager.py", "spectrogram.py", "model_cache.py")
foreach ($file in $files) {
    $path = Join-Path $projectPath $file
    if (Test-Path $path) {
        try {
            $bytes = [System.IO.File]::ReadAllBytes($path)
            # Check for UTF-8 BOM (EF BB BF)
            if ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
                Write-Host "  ✓ Already UTF-8: $file" -ForegroundColor Green
                continue
            }
            # Read as CP1251
            $cp1251 = [System.Text.Encoding]::GetEncoding(1251)
            $content = $cp1251.GetString($bytes)
            # Write as UTF-8 with BOM
            $utf8Bom = New-Object System.Text.UTF8Encoding $true
            [System.IO.File]::WriteAllText($path, $content, $utf8Bom)
            Write-Host "  ✓ Fixed: $file" -ForegroundColor Green
        } catch {
            Write-Host "  ✗ Error: $file" -ForegroundColor Red
        }
    }
}
Write-Host ""

# Step 2: Check Python
Write-Host "[2/4] Checking Python..." -ForegroundColor Yellow
$pythonPaths = @(
    "$env:USERPROFILE\anaconda3\envs\music\python.exe",
    "$env:USERPROFILE\miniconda3\envs\music\python.exe",
    "C:\ProgramData\miniconda3\envs\music\python.exe"
)
$pythonFound = $false
$pythonPath = ""
foreach ($p in $pythonPaths) {
    if (Test-Path $p) {
        $pythonFound = $true
        $pythonPath = $p
        Write-Host "  ✓ Found: $p" -ForegroundColor Green
        break
    }
}
if (-not $pythonFound) {
    Write-Host "  ✗ Python not found in conda env 'music'" -ForegroundColor Red
    Write-Host "  Please run: conda create -n music python=3.11 -y" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Install Python packages
Write-Host "[3/4] Installing Python packages..." -ForegroundColor Yellow
if ($pythonFound) {
    $packages = @("numpy", "scipy", "soundfile", "librosa", "torch", "torchaudio", "demucs")
    foreach ($pkg in $packages) {
        Write-Host "  Installing $pkg..." -NoNewline
        try {
            & $pythonPath -m pip install $pkg --quiet 2>&1 | Out-Null
            Write-Host " ✓" -ForegroundColor Green
        } catch {
            Write-Host " ✗" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  Skipped (Python not found)" -ForegroundColor DarkYellow
}
Write-Host ""

# Step 4: Install Node dependencies
Write-Host "[4/4] Installing Node.js dependencies..." -ForegroundColor Yellow
Set-Location $projectPath
try {
    npm install 2>&1 | Out-Null
    Write-Host "  ✓ npm install done" -ForegroundColor Green
} catch {
    Write-Host "  ✗ npm install failed" -ForegroundColor Red
}
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
pause
