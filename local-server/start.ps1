# Draftly Studio - Local AI Server (PowerShell)
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Draftly Studio - Local AI Server" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Store models on F drive (plenty of space)
$env:HF_HOME = "F:\AI-Models\huggingface"
Write-Host "Models cache: $env:HF_HOME"

# Check Python
try { python --version | Out-Null } catch {
    Write-Host "ERROR: Python not found. Install Python 3.10+ from python.org" -ForegroundColor Red
    exit 1
}

# Create venv if needed
if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment..."
    python -m venv .venv
}

# Activate
& .\.venv\Scripts\Activate.ps1

# Install deps if torch not found
$torchCheck = pip show torch 2>$null
if (-not $torchCheck) {
    Write-Host "Installing PyTorch with CUDA (first time only, ~2.5GB download)..." -ForegroundColor Yellow
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
    pip install diffusers transformers accelerate safetensors
    pip install fastapi "uvicorn[standard]" python-multipart Pillow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Starting on http://localhost:8000" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "GPU: GTX 1050 Ti (4GB) — using CPU offloading"
Write-Host "Image gen: SD 1.5 (loads on first request)"
Write-Host "Video gen: AnimateDiff (loads on first request)"
Write-Host ""
Write-Host "Press Ctrl+C to stop"
Write-Host ""

python server.py
