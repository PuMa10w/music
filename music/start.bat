@echo off
title Voice Remover Pro v5.0
cd /d "%~dp0"

echo ============================================
echo Voice Remover Pro v5.0
echo ============================================
echo.

REM Проверяем conda окружение
call conda env list | findstr /c:"music" >nul
if %errorlevel% neq 0 (
    echo [ERROR] Conda окружение 'music' не найдено!
    echo Запустите install-deps.bat для установки зависимостей.
    echo.
    pause
    exit /b 1
)

echo [1/2] Активируем conda окружение 'music'...
REM Не используем 'call conda activate' — вместо этого передаём python путь напрямую

echo [2/2] Запускаем сервер...
echo.
echo Откройте: http://localhost:8000
echo.

REM Запускаем через node, Python будет автоопределён
node server.js

pause
