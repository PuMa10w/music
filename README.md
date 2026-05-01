# 🎵 Voice Remover Ultra — Premium Edition

> Next-gen stem separation studio with AI-powered features, premium UI, and production-ready architecture.

![Version](https://img.shields.io/badge/version-3.0-premium-green) ![Docker](https://img.shields.io/badge/docker-ready-blue) ![React](https://img.shields.io/badge/react-19-61dafb) ![AI](https://img.shields.io/badge/AI-Whisper%20%2B%20Demucs-orange)

---

## 🚀 Features

### 🧠 AI Brain Power
- **Stem Separation**: Split tracks into 2/4/6 stems using Demucs (modern_ensemble)
- **Whisper Transcription**: Automatic lyrics detection with **word-level timestamps** for Karaoke mode
- **Harmonic Analysis**: Detect key, mode (major/minor), and BPM using librosa
- **AI Mastering**: Loudness normalization (EBU R128), compression, peak normalization

### 🎨 Premium Design
- **Glassmorphism UI**: Advanced frosted glass effect with noise texture (Tailwind 4)
- **Framer Motion**: Smooth page transitions and component animations
- **Real-time Visualizers**: Spectrogram (Web Audio API), Waveform (WaveSurfer.js)
- **Responsive Layout**: Works on desktop and mobile (Tailwind responsive classes)

### 🎤 Special Modes
- **Karaoke Mode**: Auto-transcribed lyrics with timestamps, overlay on video
- **Video Audio Replacement**: Replace audio track in video files
- **Download from URL**: Paste YouTube/SoundCloud links, auto-download via yt-dlp
- **Batch Processing**: Queue multiple files with progress bar

### 🐳 DevOps & Production
- **Docker Ready**: Multi-container setup (Node.js, Python, Redis, Nginx)
- **Health Monitoring**: `/api/health` endpoint with system status UI
- **Nginx Reverse Proxy**: Unified port configuration for production
- **Error Boundaries**: Graceful error handling with premium UI

### 🚀 User Experience
- **Toast Notifications**: Beautiful pop-up messages (success/error)
- **File Management**: Inline file renaming with pencil icon
- **EQ Presets**: 10-band equalizer with JSON export/import
- **Keyboard Shortcuts**: Power-user features (Space, Ctrl+Enter, etc.)

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind 4, Framer Motion, Zustand |
| **Backend** | Node.js, Express, Python (Demucs, Whisper, librosa) |
| **Infrastructure** | Docker, Docker Compose, Nginx, Redis |
| **AI Models** | Demucs (stem separation), Whisper (transcription), librosa (analysis) |

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local dev)
- Python 3.11+ (for local dev)

### Run with Docker (Recommended)
```bash
# Clone repo
git clone git@github.com:PuMa10w/music.git
cd music

# Start all services
docker-compose up --build -d

# Check status
docker-compose ps

# Open in browser
open http://localhost:3000
```

### Local Development
```bash
# Terminal 1: Frontend
cd frontend
npm install
npm run dev

# Terminal 2: Backend
cd music
node server.js

# Terminal 3: Python Worker
cd music
python worker.py
```

---

## 🎹 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause preview |
| `Ctrl + Enter` | Start processing all files |
| `Ctrl + U` | Focus URL input |
| `Ctrl + M` | Toggle Mastering |
| `Escape` | Close modals / Cancel rename |

---

## 📂 Project Structure

```
music/
├── frontend/          # React 19 + Vite + Tailwind 4
│   ├── src/
│   │   ├── components/  # UI components (Glassmorphism, Toasts, etc.)
│   │   ├── stores/      # Zustand state management
│   │   ├── api/         # API client
│   │   └── hooks/       # Custom hooks (useToast)
│   └── package.json
├── music/             # Backend (Node.js + Python)
│   ├── server.js       # Express API server
│   ├── *.py           # Python scripts (Demucs, Whisper, etc.)
│   └── Dockerfile.python
├── docker-compose.yml    # Base config
├── docker-compose.prod.yml  # Production with Nginx
└── README.md
```

---

## 🎤 API Endpoints

### Core
- `POST /api/upload` — Upload audio/video files
- `POST /api/separate/:jobId` — Start stem separation
- `GET /api/status/:jobId` — Check processing status
- `GET /api/download/:jobId/:file` — Download results

### AI Features
- `POST /api/transcribe/:jobId` — Whisper transcription (JSON with timestamps)
- `POST /api/analyze-harmonic/:jobId` — Harmonic analysis (key, mode, tempo)
- `POST /api/master/:jobId` — AI Mastering (LUFS normalization)

### Utilities
- `POST /api/download-external` — Download from YouTube/SoundCloud
- `POST /api/karaoke/:jobId` — Generate karaoke video
- `POST /api/replace-audio/:jobId` — Replace audio in video
- `GET /api/health` — System health check

---

## 🎨 Premium Features (Details)

### Glassmorphism UI
All major components use the `.glass-premium` class with:
- `backdrop-filter: blur(20px)`
- Noise texture overlay (SVG data URI)
- Gradient borders and shadows
- Smooth hover transitions

### Toast Notifications
- Auto-dismiss after 3 seconds
- Color-coded (green = success, red = error)
- Fixed positioning (top-right)
- Accessible and non-intrusive

### Whisper Integration
- Base model for fast transcription
- Word-level timestamps (`word_timestamps=True`)
- JSON output: `[{start, end, text}]`
- Karaoke mode: auto-scroll with highlighting

---

## 🧪 Testing

```bash
# Frontend tests (Vitest)
cd frontend
npm run test:run

# Backend tests
cd music
pytest tests/
```

---

## 🚀 Deployment

### Production (Docker + Nginx)
```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

### Health Check
```bash
curl http://localhost/api/health
# Returns: {status: "ok", services: {redis, python, disk}}
```

---

## 📝 Changelog (Premium Edition)

### v3.0 (Current)
- ✅ Whisper AI with timestamps
- ✅ Harmonic Analysis (key, mode, BPM)
- ✅ Framer Motion animations
- ✅ Advanced Glassmorphism
- ✅ Toast notifications
- ✅ File renaming UI
- ✅ Nginx reverse proxy
- ✅ Health monitoring endpoint
- ✅ Docker production config

### v2.0
- ✅ AI Mastering (EBU R128)
- ✅ Batch processing
- ✅ EQ with presets
- ✅ Download from URL

### v1.0
- ✅ Basic stem separation
- ✅ Spectrogram & Waveform
- ✅ Video preview

---

## 🤝 Contributing

1. Fork the repo
2. Create feature branch (`git checkout -b feature/awesome`)
3. Commit changes (`git commit -m 'Add awesome feature'`)
4. Push to branch (`git push origin feature/awesome`)
5. Open Pull Request

---

## 📄 License

MIT License — free for personal and commercial use.

---

## 💡 Credits

- **Demucs** — Facebook Research (stem separation)
- **Whisper** — OpenAI (speech recognition)
- **librosa** — Audio analysis library
- **Tailwind 4** — Utility-first CSS
- **Framer Motion** — Animation library

---

## 🚀 Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: [your-email@example.com]

---

**Made with ❤️ and 🎵 by PuMa10w**
