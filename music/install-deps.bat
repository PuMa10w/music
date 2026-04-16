@echo off
echo ============================================
echo Voice Remover Pro - Установка зависимостей
echo ============================================
echo.

echo [1/4] Проверяем conda...
where conda >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] conda не найден! Установите Miniconda или Anaconda:
    echo   https://docs.conda.io/en/latest/miniconda.html
    echo.
    pause
    exit /b 1
)
echo [OK] conda найден
echo.

echo [2/4] Создаём conda окружение 'music'...
call conda env list | findstr /c:"music" >nul
if %errorlevel% equ 0 (
    echo [INFO] Окружение 'music' уже существует, обновляем...
    call conda activate music
) else (
    call conda create -n music python=3.11 -y
    call conda activate music
)
echo.

echo [3/4] Устанавливаем Python пакеты...
echo   Это может занять 10-30 минут...
echo.
call conda run -n music pip install --upgrade pip
call conda run -n music pip install numpy scipy soundfile
call conda run -n music pip install torch torchaudio
call conda run -n music pip install demucs librosa
echo.

echo [4/4] Устанавливаем Node.js зависимости...
call npm install
echo.

echo ============================================
echo Установка завершена!
echo ============================================
echo.
echo Для запуска:
echo   1. conda activate music
echo   2. node server.js
echo.
echo Или используйте: start.bat
echo.
pause
