# Voice Remover Pro v5.0 - Установка

## ✅ Выполнено

1. **Исправлена кодировка файлов** - все Python файлы конвертированы в UTF-8
2. **Создан установочный скрипт** - setup-complete.ps1

## ⚠️ Требуется: Установка Miniconda

Python не найден в системе. Необходимо установить Miniconda для работы с ML-моделями.

### Шаг 1: Установите Miniconda

1. Скачайте установщик: https://docs.conda.io/en/latest/miniconda.html
   - Windows: "Miniconda3 Windows 64-bit"
2. Запустите установщик
3. Нажмите "Next" → "I Agree" → "Install"
4. **ВАЖНО:** Отметьте галочку "Add Miniconda to PATH" (если есть)
5. После установки **перезапустите терминал/PowerShell**

### Шаг 2: Запустите скрипт установки

Откройте PowerShell и выполните:

```powershell
cd C:\Users\rousl\Desktop\music\music
.\setup-complete.ps1
```

Или вручную:

```powershell
# Создание окружения
conda create -n music python=3.11 -y

# Активация
conda activate music

# Установка зависимостей
pip install numpy scipy soundfile librosa torch torchaudio demucs

# Установка Node.js зависимостей
npm install
```

### Шаг 3: Запуск приложения

```powershell
conda activate music
node server.js
```

Затем откройте в браузере: http://localhost:8000

## 📋 Статус проекта

| Компонент | Статус |
|-----------|--------|
| Кодировка файлов | ✅ Исправлено |
| Python зависимости | ⏳ Ожидает установки Miniconda |
| Node.js зависимости | ✅ Установлены |
| ML модели | ⏳ Будут загружены после установки Python |

## 🎯 Следующие шаги после установки Python

1. Добавление UVR5 моделей
2. Оптимизация производительности
3. Улучшение кроссплатформенности
4. UI/UX улучшения
