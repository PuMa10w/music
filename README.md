# 🎵 Voice Remover Ultra — Next-Gen AI Stem Separation Studio

![Version](https://img.shields.io/badge/version-2.0-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue) ![Status](https://img.shields.io/badge/status-ready-success)

**Ультрасовременный инструмент для разделения аудио на стемы (вокал, инструментал, ударные, бас и др.) с использованием передовых ML-моделей.**

---

## 🚀 Особенности

### 🎛️ Режимы разделения
- **Fast** — быстрое разделение (Spleeter)
- **Quality** — высокое качество (Demucs v4 Hybrid Transformer)
- **AI** — лучшее качество (Demucs Fine-Tuned)
- **Ultra** — максимальное качество (Ensemble: Demucs + MDX-Net)

### 🎨 Ультрасовременный дизайн
- **Glassmorphism UI** — стеклянные панели с размытием
- **Aurora Background** — анимированный градиентный фон
- **Framer Motion** — плавные анимации (страницы, кнопки, списки)
- **Gradient Text** — неоновые градиенты для заголовков
- **Fireflies** — летающие частицы на фоне
- **Dark/Light Theme** — переключение тем (авто)
- **Mobile Responsive** — адаптация под телефоны и планшеты

### 🎧 Инструменты
- **Waveform** — визуализация формы волны
- **Spectrogram** — спектрограмма аудио
- **EQ** — 10-полосный эквалайзер
- **Effects** — Reverb, Compressor, Chorus, Pitch Shift, Distortion, Autotune
- **Harmonic Analysis** — определение тональности и темпа (ключ/темпо)
- **BPM/Key Detection** — анализ ритма и тональности
- **Mastering** — нормализация по LUFS (Spotify, YouTube, CD)
- **Karaoke Mode** — создание караоке-видео с таймингами (Whisper)
- **Batch Processing** — обработка нескольких файлов одновременно
- **Processing History** — история операций
- **ZIP Download** — скачивание всех стемов одним архивом

### ⚡ Технологии
- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS 4, Framer Motion, Zustand
- **Backend**: Node.js, Express, Socket.IO (WebSocket), Python 3, Demucs, Spleeter, librosa, torch
- **Deployment**: Nginx reverse proxy (опционально)

---

## 📦 Установка

### Windows (рекомендуется)
1. Скачайте и запустите `setup.exe` (если есть) или выполните:
   ```bash
   # Установите Python 3.12+ и добавьте в PATH
   # Установите зависимости:
   pip install demucs spleeter torch torchaudio librosa soundfile numpy scipy yt-dlp
   ```
2. Установите Node.js 18+.
3. Клонируйте репозиторий:
   ```bash
   git clone git@github.com:PuMa10w/music.git
   cd music
   ```
4. Установите зависимости фронтенда:
   ```bash
   cd frontend
   npm install
   ```
5. Запустите бэкенд (в папке `music`):
   ```bash
   node server.js
   ```
6. Запустите фронтенд (в папке `frontend`):
   ```bash
   npm run dev
   ```
7. Откройте в браузере: http://localhost:3003

### Linux / WSL
```bash
# Установите зависимости
sudo apt-get install ffmpeg yt-dlp
pip3 install demucs spleeter torch torchaudio librosa soundfile numpy scipy

# Запуск
cd music/music
node server.js &
cd ../frontend
npm run dev
```

---

## 🎮 Использование

1. **Загрузка** — перетащите аудио-файлы или вставьте ссылку с YouTube.
2. **Выбор режима** — выберите Fast, Quality, AI или Ultra.
3. **Настройка** — выберите пресет (pop, rock, rap, classic) и силу вокала.
4. **Старт** — нажмите "START PROCESSING" (или Ctrl+Enter).
5. **Результат** — скачайте стемы по отдельности или ZIP-архивом.
6. **Дополнительно** — анализ, мастеринг, эффекты, караоке.

---

## 🌐 API Endpoints

| Метод | Путь | Описание |
|--------|------|----------|
| GET | `/api/health` | Проверка состояния |
| POST | `/api/upload` | Загрузка файла |
| POST | `/api/youtube` | Скачивание с YouTube |
| POST | `/api/separate/:jobId` | Разделение (2 стема) |
| POST | `/api/stems/:jobId` | Разделение (4 стема) |
| POST | `/api/stems6/:jobId` | Разделение (6 стемов) |
| POST | `/api/analyze/:jobId` | Анализ BPM/Key |
| POST | `/api/analyze-harmonic/:jobId` | Гармонический анализ |
| POST | `/api/master/:jobId` | Мастеринг |
| POST | `/api/effect/:jobId` | Применение эффекта |
| POST | `/api/transcribe/:jobId` | Транскрипция (Whisper) |
| GET | `/api/download-zip/:jobId` | Скачивание ZIP |
| WS | `/` | WebSocket прогресс |

---

## 🎯 Roadmap (завершено)

- [x] Glassmorphism UI
- [x] Aurora Background
- [x] Framer Motion анимации
- [x] Whisper timestamps (караоке)
- [x] Harmonic Analysis
- [x] Batch Processing
- [x] Processing History
- [x] ZIP Download
- [x] Mobile Responsive
- [x] Keyboard Shortcuts
- [x] Health monitoring
- [x] Toast notifications
- [x] Nginx reverse proxy (опционально)
- [x] AI Mode (htdemucs_ft)
- [x] AudioDownloader (YouTube, Spotify и др.)

---

## 📝 Лицензия

MIT License — свободное использование.

---

**Сделано с ❤️ и неоновыми градиентами.**  
*Voice Remover Ultra — когда качество имеет значение.*
