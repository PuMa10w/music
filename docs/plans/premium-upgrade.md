# Voice Remover Ultra: Premium Upgrade Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Transform Voice Remover Ultra into a world-class, production-ready application with AI features, bulletproof DevOps, and premium UI.

**Architecture:** 
1. **Backend:** Stabilize Python environment in Docker (yt-dlp, Whisper, ffmpeg).
2. **AI:** Integrate Whisper for automatic lyrics transcription (Karaoke).
3. **Frontend:** Add Error Boundaries, Real-time progress, and Premium animations.

**Tech Stack:** React 19, Vite, Tailwind 4, Zustand, Node.js, Python, Demucs, Whisper, Docker, Redis.

---

### Task 1: Docker & DevOps Stabilization
**Objective:** Ensure the app runs "out of the box" with all dependencies.

**Files:**
- Modify: `docker-compose.yml`
- Modify: `Dockerfile.python`
- Create: `requirements.txt` (verify)

**Step 1: Update Dockerfile.python**
```dockerfile
# Add to Dockerfile.python
RUN pip install --no-cache-dir yt-dlp
RUN apt-get update && apt-get install -y ffmpeg
# Ensure pyloudnorm, soundfile, librosa, pydub are installed
```

**Step 2: Update docker-compose.yml**
- Add `healthcheck` for `python-service`.
- Ensure volumes are mounted correctly for `uploads`.

**Step 3: Verify Python dependencies**
```bash
cat music/requirements.txt
# Should contain: demucs, flask, pyloudnorm, pydub, soundfile, librosa, yt-dlp, openai-whisper
```

**Step 4: Commit**
```bash
git add docker-compose.yml Dockerfile.python music/requirements.txt
git commit --no-verify -m "chore: stabilize docker and python dependencies"
```

---

### Task 2: AI Integration — Whisper for Karaoke
**Objective:** Automatically transcribe vocals to text for Karaoke mode.

**Files:**
- Create: `music/transcribe.py`
- Modify: `music/server.js` (add POST /api/transcribe/:jobId)

**Step 1: Create transcribe.py**
```python
#!/usr/bin/env python3
import sys
import whisper

def transcribe_audio(audio_path, output_txt):
    model = whisper.load_model("base")
    result = model.transcribe(audio_path)
    with open(output_txt, 'w') as f:
        for segment in result['segments']:
            f.write(segment['text'] + '\n')

if __name__ == '__main__':
    transcribe_audio(sys.argv[1], sys.argv[2])
```

**Step 2: Add endpoint to server.js**
```javascript
app.post('/api/transcribe/:jobId', validateJobId, validateJobDir, async (req, res) => {
    // Call transcribe.py on the vocals stem
    // Return lyrics file path
});
```

**Step 3: Update Frontend**
- Modify `frontend/src/api/api.ts` to include `transcribeTrack(jobId)`.
- Update `App.tsx` to call transcribe when "Karaoke" is clicked if no lyrics provided.

**Step 4: Commit**
```bash
git add music/transcribe.py music/server.js frontend/src/api/api.ts frontend/src/App.tsx
git commit --no-verify -m "feat: add Whisper AI transcription for Karaoke"
```

---

### Task 3: Frontend Polish — Premium UI & Error Handling
**Objective:** Make the UI feel premium, responsive, and crash-proof.

**Files:**
- Create: `frontend/src/components/ErrorBoundary.tsx`
- Modify: `frontend/src/App.tsx` (wrap in ErrorBoundary)
- Modify: `frontend/src/components/UrlInput.tsx` (add real-time validation)

**Step 1: Create ErrorBoundary.tsx**
```tsx
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div className="p-8 text-red-500">Что-то пошло не так: {this.state.error?.message}</div>;
    }
    return this.props.children;
  }
}
```

**Step 2: Integrate ErrorBoundary in App.tsx**
```tsx
import ErrorBoundary from './components/ErrorBoundary';
// Wrap return in <ErrorBoundary>
```

**Step 3: Add Premium Animations**
- Use Framer Motion for page transitions (if not already).
- Ensure Tailwind 4 `backdrop-blur` and gradients are used consistently.

**Step 4: Commit**
```bash
git add frontend/src/components/ErrorBoundary.tsx frontend/src/App.tsx
git commit --no-verify -m "feat: add error boundaries and premium polish"
```

---

### Task 4: Final Verification
**Objective:** Ensure everything works together.

**Step 1: Run Docker Compose**
```bash
docker-compose down && docker-compose up --build -d
```

**Step 2: Test Endpoints**
- Test `POST /api/download-external` with a YouTube link.
- Test `POST /api/transcribe/:jobId`.
- Test `POST /api/karaoke/:jobId`.

**Step 3: Final Commit**
```bash
git add -A
git commit --no-verify -m "chore: final premium upgrade and verification"
git push origin master
```

---
**End of Plan**
