# 🎵 Voice Remover Pro v5.0

Ultimate Stem Separation — профессиональное разделение аудио на партии с ML.

## 🚀 Возможности

### Разделение аудио
- **2-STEM** — Вокал + Инструментал (быстро)
- **4-STEM** — Вокал, Драмсы, Бас, Другое (HD качество)
- **6-STEM** — Lead Вокал, Backing Вокал, Драмсы, Бас, Пиано, Другое (Ultra)

### Режимы качества
- ⚡ **Fast** — быстрое разделение (Spleeter)
- ✨ **Quality** — высокое качество (Demucs v4 Hybrid Transformer)
- 💎 **Ultra** — максимальное качество (Ensemble Demucs)

### Пресеты жанров
🎵 Default • 🎤 Pop • 🎸 Rock • 🎧 Rap • 🎷 Jazz • 🎻 Classic • 🎹 Electronic • 🪕 Acoustic

### Обработка стемов
- 🎚️ **10-полосный эквалайзер** (31Hz — 16kHz) для каждого стема
- ✨ **Эффекты**: Реверберация, Компрессор, Хорус, Питч-шифт
- 🎛️ **Микшер** с громкостью и панорамой для каждого стема
- 📊 **Анализ трека**: BPM, тональность, LUFS, спектральный анализ
- 📈 **Спектрограмма** — визуализация частот
- 💾 **Экспорт** в MP3/WAV/FLAC/OGG/AAC

## 📁 Структура проекта

```
music/
├── server.js          # Бэкенд сервер (Express)
├── separate.py        # Python: 2-stem разделение
├── stems.py           # Python: 4-stem и 6-stem разделение
├── effects.py         # Python: эффекты и эквалайзер
├── analyze.py         # Python: анализ аудио (BPM, key, LUFS)
├── model_manager.py   # Python: управление ML-моделями
├── config.json        # Конфигурация
├── package.json       # Node.js зависимости
├── requirements.txt   # Python зависимости
├── public/
│   ├── index.html     # Фронтенд UI
│   ├── style.css      # Стили (Glass Morphism + Neon)
│   ├── app.js         # Клиентский JavaScript
│   └── particles.js   # Фоновые частицы
├── uploads/           # Загруженные файлы
└── outputs/           # Результаты обработки
```

## 🚀 Установка и запуск

### 1. Установка зависимостей

```bash
cd /Users/malowasvetlana/Desktop/music
npm install
```

### 2. Python зависимости

Убедитесь, что conda окружение `music` активировано:

```bash
conda activate music
pip install numpy soundfile scipy demucs librosa torch
```

### 3. Запуск сервера

```bash
node server.js
```

### 4. Открыть браузер

Перейдите на **http://localhost:8000**

## 🎮 Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| `Space` | Play / Pause |
| `S`     | Запустить разделение |
| `R`     | Сбросить всё |
| `Ctrl+O` | Открыть файл |
| `Esc` | Сбросить |

## 🔧 Технологии

- **Backend:** Node.js + Express
- **Audio Processing:** Python + NumPy + SoundFile + SciPy
- **ML Models:** Demucs v4 (Hybrid Transformer), Spleeter
- **YouTube:** yt-dlp
- **FFmpeg:** ffmpeg-static (встроенный)
- **Frontend:** HTML5 + CSS3 (Glass Morphism) + Vanilla JS
- **Background:** Canvas Particles

## 📝 Примечания

- 6-stem разделение: вокал разделяется на lead (центрированный) и backing (side-сигнал) через mid/side обработку
- Каждый стем можно обработать эквалайзером и эффектами независимо
- Результаты сохраняются в `outputs/` с уникальным ID для каждой сессии
- История последних 50 обработок сохраняется

## 📋 Требования

- Node.js v18+
- Python 3.10+
- Conda окружение `music` с установленными: demucs, librosa, numpy, soundfile, scipy, torch
