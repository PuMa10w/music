@echo off
chcp 65001 >nul
echo ============================================
echo Voice Remover Pro v5.0 - Setup
echo ============================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0fix-and-improve.ps1"
pause
