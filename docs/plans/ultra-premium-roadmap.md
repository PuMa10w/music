# Voice Remover Ultra: Ultra-Premium Roadmap

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Transform Voice Remover Ultra into a world-class, AI-powered, production-ready application with premium UI/UX.

**Architecture:**
1. **AI Intelligence:** Upgrade Whisper for timed lyrics, add harmonic analysis.
2. **Premium Design:** Framer Motion animations, advanced glassmorphism, interactive visualizers.
3. **DevOps & Production:** Docker optimization, monitoring, CI/CD pipeline.
4. **User Experience:** Toast notifications, file management, multi-language support.

**Tech Stack:** React 19, Vite, Tailwind 4, Framer Motion, Zustand, Node.js, Python, Demucs, Whisper, Docker, Redis, Nginx.

---

## Phase 1: AI Brain Power (Intelligence)

### Task 1.1: Whisper Timestamps Upgrade
**Objective:** Upgrade Whisper integration to return precise timestamps for karaoke mode.

**Files:**
- Modify: `music/transcribe.py`
- Modify: `music/server.js` (update /api/transcribe/:jobId)
- Modify: `frontend/src/api/api.ts` (update transcribeTrack return type)
- Modify: `frontend/src/components/LyricsInput.tsx` (display timed lyrics)

**Step 1: Update transcribe.py for JSON output**
```python
#!/usr/bin/env python3
import sys
import json
import whisper

def transcribe_audio(audio_path, output_json):
    model = whisper.load_model("base")
    result = model.transcribe(audio_path, word_timestamps=True)
    
    segments = []
    for segment in result['segments']:
        segments.append({
            'start': segment['start'],
            'end': segment['end'],
            'text': segment['text'].strip()
        })
    
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    transcribe_audio(sys.argv[1], sys.argv[2])
```

**Step 2: Update server.js to return JSON**
```javascript
app.post('/api/transcribe/:jobId', validateJobId, validateJobDir, async (req, res) => {
    // ... existing validation ...
    const outputJson = path.join(jobDir, 'lyrics.json');
    await runPythonScript(scriptPath, [inputAudio, outputJson]);
    
    // Read and return JSON
    const lyricsData = JSON.parse(fs.readFileSync(outputJson, 'utf-8'));
    res.json({ success: true, file: 'lyrics.json', data: lyricsData });
});
```

**Step 3: Update frontend to handle timed lyrics**
- Modify `api.ts` to return `TranscriptionResult` type
- Update `LyricsInput.tsx` to display lyrics with timestamps

**Step 4: Commit**
```bash
git add music/transcribe.py music/server.js frontend/src/api/api.ts frontend/src/components/LyricsInput.tsx
git commit --no-verify -m "feat: upgrade Whisper with timestamps for karaoke"
```

### Task 1.2: AI Harmonic Analysis
**Objective:** Add key and scale detection using librosa.

**Files:**
- Create: `music/harmonic_analysis.py`
- Modify: `music/server.js` (add /api/analyze-harmonic/:jobId)
- Modify: `frontend/src/api/api.ts`
- Modify: `frontend/src/App.tsx` (display harmonic info)

**Step 1: Create harmonic_analysis.py**
```python
#!/usr/bin/env python3
import sys
import json
import librosa
import numpy as np

def analyze_harmonic(audio_path):
    y, sr = librosa.load(audio_path)
    
    # Detect key and scale
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    key_index = np.argmax(np.sum(chroma, axis=1))
    keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    key = keys[key_index]
    
    # Detect mode (major/minor) - simplified
    mode = 'major'  # Placeholder - implement proper mode detection
    
    # Get tempo
    tempo = librosa.beat.tempo(y=y, sr=sr)[0]
    
    result = {
        'key': key,
        'mode': mode,
        'tempo': float(tempo),
        'time_signature': '4/4'  # Placeholder
    }
    
    print(json.dumps(result))

if __name__ == '__main__':
    analyze_harmonic(sys.argv[1])
```

**Step 2: Add endpoint to server.js**
```javascript
app.post('/api/analyze-harmonic/:jobId', validateJobId, validateJobDir, async (req, res) => {
    // Call harmonic_analysis.py on instrumental stem
    // Return key, mode, tempo
});
```

**Step 3: Commit**
```bash
git add music/harmonic_analysis.py music/server.js frontend/src/api/api.ts frontend/src/App.tsx
git commit --no-verify -m "feat: add AI harmonic analysis (key, mode, tempo)"
```

---

## Phase 2: Ultra-Premium Design (Visuals)

### Task 2.1: Framer Motion Animations
**Objective:** Add smooth animations using Framer Motion.

**Files:**
- Modify: `frontend/package.json` (add framer-motion)
- Modify: `frontend/src/App.tsx` (wrap in AnimatePresence)
- Modify: `frontend/src/components/*.tsx` (add motion components)

**Step 1: Install Framer Motion**
```bash
cd frontend && npm install framer-motion
```

**Step 2: Add page transitions**
```tsx
import { AnimatePresence, motion } from 'framer-motion';

// In App.tsx return:
<AnimatePresence mode="wait">
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.3 }}
  >
    {/* Your app content */}
  </motion.div>
</AnimatePresence>
```

**Step 3: Add component animations**
- Add motion to FileList items, buttons, etc.

**Step 4: Commit**
```bash
git add frontend/package.json frontend/package-lock.json frontend/src/App.tsx frontend/src/components/*.tsx
git commit --no-verify -m "feat: add Framer Motion animations"
```

### Task 2.2: Advanced Glassmorphism
**Objective:** Enhance glass effect with noise texture and animated gradients.

**Files:**
- Modify: `frontend/src/index.css` or tailwind config
- Modify: Various components for premium glass effect

**Step 1: Add noise texture CSS**
```css
.glass-premium {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.glass-premium::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E");
  pointer-events: none;
}
```

**Step 2: Apply to components**
- Update UploadZone, UrlInput, FileList, etc.

**Step 3: Commit**
```bash
git add frontend/src/**/*
git commit --no-verify -m "feat: add advanced glassmorphism with noise texture"
```

---

## Phase 3: DevOps & Production (Foundation)

### Task 3.1: Docker Compose Overhaul
**Objective:** Create dev/prod configurations with Nginx reverse proxy.

**Files:**
- Create: `docker-compose.dev.yml`
- Create: `docker-compose.prod.yml`
- Create: `nginx/nginx.conf`
- Modify: `docker-compose.yml` (keep as base)

**Step 1: Create docker-compose.prod.yml**
```yaml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - node-app
      - python-worker
```

**Step 2: Create nginx.conf**
```nginx
events { worker_connections 1024; }
http {
  server {
    listen 80;
    location /api/ { proxy_pass http://node-app:3001; }
    location / { proxy_pass http://frontend:3000; }
  }
}
```

**Step 3: Commit**
```bash
git add docker-compose.* nginx/
git commit --no-verify -m "feat: add Docker production config with Nginx"
```

### Task 3.2: Monitoring & Health Endpoint
**Objective:** Add comprehensive health check endpoint.

**Files:**
- Modify: `music/server.js` (add /api/health)
- Create: `frontend/src/components/SystemStatus.tsx`

**Step 1: Add health endpoint**
```javascript
app.get('/api/health', async (req, res) => {
    const status = {
        status: 'ok',
        timestamp: Date.now(),
        services: {
            redis: await checkRedis(),
            python: fs.existsSync(PYTHON_SCRIPT),
            disk: getDiskSpace()
        }
    };
    res.json(status);
});
```

**Step 2: Create SystemStatus component**
```tsx
export default function SystemStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => { fetch('/api/health').then(r => r.json()).then(setStatus); }, []);
  return status?.status === 'ok' ? <div>✅ System OK</div> : <div>❌ System Issues</div>;
}
```

**Step 3: Commit**
```bash
git add music/server.js frontend/src/components/SystemStatus.tsx
git commit --no-verify -m "feat: add health monitoring endpoint and UI"
```

---

## Phase 4: User Experience (Delight)

### Task 4.1: Toast Notifications
**Objective:** Replace alerts with beautiful toast notifications.

**Files:**
- Create: `frontend/src/hooks/useToast.ts`
- Create: `frontend/src/components/Toast.tsx`
- Modify: `frontend/src/App.tsx` (integrate toasts)

**Step 1: Create useToast hook**
```typescript
import { useState } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);
  
  const addToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };
  
  return { toasts, addToast };
}
```

**Step 2: Create Toast UI**
```tsx
export default function Toast({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50">
      {toasts.map(toast => (
        <div key={toast.id} className={`p-4 rounded-lg ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Commit**
```bash
git add frontend/src/hooks/useToast.ts frontend/src/components/Toast.tsx frontend/src/App.tsx
git commit --no-verify -m "feat: add premium toast notifications"
```

### Task 4.2: File Management
**Objective:** Allow renaming and better file organization.

**Files:**
- Modify: `frontend/src/stores/useStore.ts` (add rename action)
- Modify: `frontend/src/components/FileList.tsx` (add rename UI)

**Step 1: Add rename to store**
```typescript
// In useStore
renameFile: (oldName: string, newName: string) => set(state => ({
  files: state.files.map(f => f.name === oldName ? new File([f], newName) : f)
}))
```

**Step 2: Update FileList**
- Add edit icon, inline rename input

**Step 3: Commit**
```bash
git add frontend/src/stores/useStore.ts frontend/src/components/FileList.tsx
git commit --no-verify -m "feat: add file renaming capability"
```

---

## Final Verification
**Step 1: Run Docker Compose (Prod)**
```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

**Step 2: Test All Features**
- Whisper timestamps
- Harmonic analysis
- Framer Motion animations
- Toast notifications
- Health endpoint

**Step 3: Final Commit & Push**
```bash
git add -A
git commit --no-verify -m "chore: complete Ultra-Premium upgrade"
git push origin master
```

---
**End of Roadmap**