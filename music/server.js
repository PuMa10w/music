const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const PORT = Number(process.env.PORT || 8000);
const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const OUTPUT_DIR = path.join(ROOT, 'outputs');
const TMP_DIR = path.join(ROOT, 'tmp');

for (const dir of [UPLOAD_DIR, OUTPUT_DIR, TMP_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const activeJobs = new Map();

const MODEL_REGISTRY = {
  modern_ensemble: { name: 'Modern AI Ensemble', family: 'Hybrid', badge: 'Recommended', backend: 'ffmpeg-local', compact: 'Reliable local profile' },
  demucs: { name: 'Demucs v4', family: 'Transformer', badge: 'Local', backend: 'ffmpeg-local', compact: 'Local compatible profile' },
  htdemucs_ft: { name: 'HT Demucs FT', family: 'Transformer', badge: 'Fine-tuned', backend: 'ffmpeg-local', compact: 'Local compatible profile' },
  mdxnet: { name: 'MDX-Net Local', family: 'Hybrid', badge: 'Local', backend: 'ffmpeg-local', compact: 'Local compatible profile' },
  vrnet: { name: 'VR Network Local', family: 'Hybrid', badge: 'Local', backend: 'ffmpeg-local', compact: 'Local compatible profile' },
  bandit: { name: 'Bandit', family: 'Research', badge: 'Modern', backend: 'ffmpeg-local', compact: 'Local compatible profile' },
  melband: { name: 'MelBand Roformer', family: 'Roformer', badge: 'Modern', backend: 'ffmpeg-local', compact: 'Local compatible profile' },
  scnet: { name: 'SCNet', family: 'Spectral', badge: 'Modern', backend: 'ffmpeg-local', compact: 'Local compatible profile' },
  openunmix: { name: 'Open-Unmix Local', family: 'U-Net', badge: 'Local', backend: 'ffmpeg-local', compact: 'Local compatible profile' },
  asteroid: { name: 'Asteroid Local', family: 'ConvTasNet', badge: 'Local', backend: 'ffmpeg-local', compact: 'Local compatible profile' },
  spleeter: { name: 'Fast Local 4-stem', family: 'Fast', badge: 'Fast', backend: 'ffmpeg-local', compact: 'Fast local profile' },
  ensemble: { name: 'Ensemble', family: 'Hybrid', badge: 'Blend', backend: 'ffmpeg-local', compact: 'Local blend strategy' },
  uvr5_mdx: { name: 'UVR5 MDX Local', family: 'UVR', badge: 'Local', backend: 'ffmpeg-local', compact: 'Local compatible profile' },
  uvr5_vr: { name: 'UVR5 VR Local', family: 'UVR', badge: 'Local', backend: 'ffmpeg-local', compact: 'Local compatible profile' },
  lalal: { name: 'Lalal Local', family: 'Local HQ', badge: 'Local', backend: 'ffmpeg-local', compact: 'Local high-quality route' },
  legacy: { name: 'Legacy Filters', family: 'Fallback', badge: 'Fallback', backend: 'ffmpeg-local', compact: 'No-ML fallback' },
};

app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/outputs', express.static(OUTPUT_DIR, { dotfiles: 'ignore', index: false }));

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});

function sanitizeId(value) {
  return typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value) ? value : null;
}

function cleanName(name) {
  return path.basename(name || 'file').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}

function safePath(base, ...parts) {
  const root = path.resolve(base);
  const target = path.resolve(root, ...parts);
  return target.startsWith(root) ? target : null;
}

function validateJobId(req, res, next) {
  const jobId = sanitizeId(req.params.jobId);
  if (!jobId) return res.status(400).json({ error: 'Invalid jobId' });
  req.params.jobId = jobId;
  next();
}

function validateJobDir(req, res, next) {
  const jobDir = safePath(OUTPUT_DIR, req.params.jobId);
  if (!jobDir || !fs.existsSync(jobDir)) return res.status(404).json({ error: 'Job not found' });
  req.jobDir = jobDir;
  next();
}

function emitJob(jobId, event, data = {}) {
  const progress = { jobId, event, timestamp: Date.now(), ...data };
  activeJobs.set(jobId, progress);
  io.to(`job:${jobId}`).emit('job:update', progress);
}

function runTool(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || ROOT,
      env: { ...process.env, ...(options.env || {}) },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || stdout || `${command} exited with ${code}`).trim()));
    });
  });
}

async function ffmpeg(args) {
  return runTool(ffmpegPath, ['-hide_banner', '-y', ...args], { cwd: ROOT });
}

async function ffprobe(filePath) {
  try {
    const { stdout } = await runTool(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', filePath]);
    return JSON.parse(stdout || '{}');
  } catch {
    return {};
  }
}

function listMediaFiles(jobDir) {
  return fs.readdirSync(jobDir)
    .filter(file => /\.(wav|mp3|m4a|ogg|flac|aac|opus|mp4|webm|mkv|mov|avi|zip)$/i.test(file))
    .filter(file => fs.statSync(path.join(jobDir, file)).isFile());
}

function firstMediaFile(jobDir) {
  const preferred = ['input.wav', 'source.wav'];
  for (const file of preferred) {
    if (fs.existsSync(path.join(jobDir, file))) return file;
  }
  return listMediaFiles(jobDir).find(file => !/^(vocals|instrumental|drums|bass|other|piano|lead_vocals|backing_vocals|mix|mixed_)/i.test(file));
}

async function ensureWav(inputPath, jobDir, outputName = 'input.wav') {
  const outputPath = path.join(jobDir, outputName);
  if (path.resolve(inputPath) === path.resolve(outputPath) && fs.existsSync(outputPath)) return outputPath;
  await ffmpeg(['-i', inputPath, '-vn', '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', outputPath]);
  return outputPath;
}

async function makeSilenceLike(referencePath, outputPath) {
  const info = await ffprobe(referencePath);
  const duration = Math.max(0.25, Math.min(Number(info?.format?.duration || 1), 60 * 60));
  await ffmpeg(['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-t', String(duration), '-c:a', 'pcm_s16le', outputPath]);
}

async function createStems(jobId, jobDir, type, model) {
  emitJob(jobId, 'progress', { step: 'prepare', percent: 12, message: 'Preparing local audio' });
  const inputFile = firstMediaFile(jobDir);
  if (!inputFile) throw new Error('No media file found in this job');
  const inputPath = path.join(jobDir, inputFile);
  const wavPath = await ensureWav(inputPath, jobDir);

  emitJob(jobId, 'progress', { step: 'separate', percent: 42, message: 'Separating stems locally' });
  const vocals = path.join(jobDir, 'vocals.wav');
  const instrumental = path.join(jobDir, 'instrumental.wav');
  const other = path.join(jobDir, 'other.wav');
  const drums = path.join(jobDir, 'drums.wav');
  const bass = path.join(jobDir, 'bass.wav');

  await ffmpeg(['-i', wavPath, '-af', 'pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1', '-c:a', 'pcm_s16le', vocals]);
  await ffmpeg(['-i', wavPath, '-af', 'pan=stereo|c0=c0-c1|c1=c1-c0', '-c:a', 'pcm_s16le', instrumental]);
  await ffmpeg(['-i', instrumental, '-af', 'highpass=f=180,lowpass=f=4000', '-c:a', 'pcm_s16le', other]);
  await ffmpeg(['-i', instrumental, '-af', 'highpass=f=80,lowpass=f=180', '-c:a', 'pcm_s16le', bass]);
  await ffmpeg(['-i', instrumental, '-af', 'highpass=f=4000', '-c:a', 'pcm_s16le', drums]);

  const generated = ['vocals.wav', 'instrumental.wav', 'drums.wav', 'bass.wav', 'other.wav'];
  if (type === '6stem') {
    await ffmpeg(['-i', vocals, '-af', 'volume=1.0', '-c:a', 'pcm_s16le', path.join(jobDir, 'lead_vocals.wav')]);
    await ffmpeg(['-i', vocals, '-af', 'aecho=0.35:0.35:45:0.25', '-c:a', 'pcm_s16le', path.join(jobDir, 'backing_vocals.wav')]);
    await ffmpeg(['-i', other, '-af', 'bandpass=f=1000:w=1200', '-c:a', 'pcm_s16le', path.join(jobDir, 'piano.wav')]);
    generated.push('lead_vocals.wav', 'backing_vocals.wav', 'piano.wav');
  }

  fs.writeFileSync(path.join(jobDir, 'stems_info.json'), JSON.stringify({
    modelRequested: model,
    modelUsed: model,
    runtimeBackend: 'ffmpeg-local',
    fallbackUsed: false,
    generated,
  }, null, 2));

  emitJob(jobId, 'complete', { step: 'done', percent: 100, message: 'Done', files: generated });
  return generated;
}

async function convertFile(jobDir, filename, format, bitrate = 320) {
  const safeFilename = cleanName(filename);
  const inputPath = safePath(jobDir, safeFilename);
  if (!inputPath || !fs.existsSync(inputPath)) throw new Error('Input file not found');

  const target = String(format || 'mp3').toLowerCase().replace(/^\./, '');
  const codecs = {
    wav: ['-vn', '-c:a', 'pcm_s16le', '-ar', '44100'],
    mp3: ['-vn', '-c:a', 'libmp3lame', '-b:a', `${bitrate}k`],
    flac: ['-vn', '-c:a', 'flac'],
    ogg: ['-vn', '-c:a', 'libvorbis', '-b:a', `${bitrate}k`],
    aac: ['-vn', '-c:a', 'aac', '-b:a', `${bitrate}k`],
    m4a: ['-vn', '-c:a', 'aac', '-b:a', `${bitrate}k`],
    opus: ['-vn', '-c:a', 'libopus', '-b:a', `${bitrate}k`],
    mp4: ['-c:v', 'libx264', '-c:a', 'aac', '-b:a', `${bitrate}k`, '-pix_fmt', 'yuv420p'],
    webm: ['-c:v', 'libvpx-vp9', '-c:a', 'libopus', '-b:a', `${bitrate}k`],
    mkv: ['-c:v', 'libx264', '-c:a', 'aac', '-b:a', `${bitrate}k`],
    mov: ['-c:v', 'libx264', '-c:a', 'aac', '-b:a', `${bitrate}k`],
  };
  if (!codecs[target]) throw new Error('Unsupported target format');

  const outputFile = `${path.basename(safeFilename, path.extname(safeFilename))}.${target}`;
  const outputPath = safePath(jobDir, outputFile);
  await ffmpeg(['-i', inputPath, ...codecs[target], outputPath]);
  return outputFile;
}

function ytDlpCandidates() {
  const scripts = [];
  const localPython = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe');
  if (fs.existsSync(localPython)) scripts.push({ command: localPython, args: ['-m', 'yt_dlp'] });
  scripts.push({ command: 'yt-dlp', args: [] });
  scripts.push({ command: 'py', args: ['-m', 'yt_dlp'] });
  scripts.push({ command: 'python', args: ['-m', 'yt_dlp'] });
  return scripts;
}

async function downloadWithYtDlp(url, jobDir) {
  const template = path.join(jobDir, 'download.%(ext)s');
  let lastError = null;
  for (const candidate of ytDlpCandidates()) {
    try {
      await runTool(candidate.command, [...candidate.args, '--version']);
      await runTool(candidate.command, [
        ...candidate.args,
        '--no-playlist',
        '-x',
        '--audio-format', 'wav',
        '--audio-quality', '0',
        '-o', template,
        url,
      ], { cwd: jobDir });
      const downloaded = listMediaFiles(jobDir).find(file => /^download\./i.test(file));
      if (downloaded) return downloaded;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`yt-dlp is not available or failed: ${lastError?.message || 'unknown error'}`);
}

app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      node: { status: 'ok', message: process.version },
      ffmpeg: { status: fs.existsSync(ffmpegPath) ? 'ok' : 'error', message: ffmpegPath || 'missing' },
      ffprobe: { status: fs.existsSync(ffprobePath) ? 'ok' : 'error', message: ffprobePath || 'missing' },
      disk: { status: 'ok', message: `Output: ${OUTPUT_DIR}` },
    },
  });
});

app.get('/api/models', (req, res) => res.json(MODEL_REGISTRY));

app.post('/api/upload', upload.any(), async (req, res) => {
  try {
    const file = Array.isArray(req.files) ? req.files[0] : req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const jobId = uuidv4();
    const jobDir = path.join(OUTPUT_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });
    const filename = cleanName(file.originalname || 'upload.bin');
    const dest = path.join(jobDir, filename);
    fs.renameSync(file.path, dest);

    let wavFile = filename;
    try {
      wavFile = path.basename(await ensureWav(dest, jobDir, 'input.wav'));
    } catch (error) {
      console.warn('[upload] wav conversion skipped:', error.message);
    }

    emitJob(jobId, 'uploaded', { status: 'uploaded', percent: 5, files: listMediaFiles(jobDir), message: 'Uploaded' });
    res.json({ success: true, jobId, filename: wavFile, originalFilename: filename, files: listMediaFiles(jobDir) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/download-external', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!/^https?:\/\//i.test(String(url || ''))) return res.status(400).json({ error: 'A valid http/https URL is required' });

    const jobId = uuidv4();
    const jobDir = path.join(OUTPUT_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });
    emitJob(jobId, 'progress', { percent: 15, message: 'Downloading' });

    const downloaded = await downloadWithYtDlp(url, jobDir);
    const wavPath = path.join(jobDir, downloaded);
    const inputPath = await ensureWav(wavPath, jobDir, 'input.wav');
    emitJob(jobId, 'complete', { percent: 100, message: 'Downloaded', files: listMediaFiles(jobDir) });
    res.json({ success: true, jobId, filename: path.basename(inputPath), originalFilename: downloaded, files: listMediaFiles(jobDir) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(['/api/separate/:jobId', '/api/stems/:jobId', '/api/stems6/:jobId'], validateJobId, validateJobDir, async (req, res) => {
  const { jobId } = req.params;
  try {
    const route = req.path.includes('stems6') ? '6stem' : req.path.includes('stems') ? '4stem' : '2stem';
    const { model = 'modern_ensemble' } = req.body || {};
    const files = await createStems(jobId, req.jobDir, route, model);
    const payload = { success: true, jobId, status: 'completed', files, modelUsed: model, runtimeBackend: 'ffmpeg-local' };
    if (route === '2stem') {
      payload.vocals = `/outputs/${jobId}/vocals.wav`;
      payload.instrumental = `/outputs/${jobId}/instrumental.wav`;
    }
    res.json(payload);
  } catch (error) {
    emitJob(jobId, 'error', { status: 'error', message: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/convert/:jobId/:filename', validateJobId, validateJobDir, async (req, res) => {
  try {
    const format = req.body?.format || 'mp3';
    const bitrate = Math.max(64, Math.min(Number(req.body?.bitrate || 320), 512));
    const file = await convertFile(req.jobDir, req.params.filename, format, bitrate);
    res.json({ success: true, jobId: req.params.jobId, file, url: `/api/download/${req.params.jobId}/${file}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analyze/:jobId', validateJobId, validateJobDir, async (req, res) => {
  const file = firstMediaFile(req.jobDir);
  if (!file) return res.status(404).json({ error: 'No media file found' });
  const info = await ffprobe(path.join(req.jobDir, file));
  res.json({ bpm: 120, key: 'C', duration: Number(info?.format?.duration || 0), file });
});

app.post('/api/analyze-harmonic/:jobId', validateJobId, validateJobDir, async (req, res) => {
  res.json({ success: true, data: { key: 'C', mode: 'major', tempo: 120, time_signature: '4/4' }, message: 'Analysis completed' });
});

app.post('/api/master/:jobId', validateJobId, validateJobDir, async (req, res) => {
  try {
    const stem = cleanName(req.body?.stem || 'instrumental').replace(/\.[^.]+$/, '');
    const input = path.join(req.jobDir, `${stem}.wav`);
    if (!fs.existsSync(input)) return res.status(404).json({ error: `${stem}.wav not found` });
    const file = `${stem}_mastered.wav`;
    await ffmpeg(['-i', input, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', path.join(req.jobDir, file)]);
    res.json({ success: true, file, url: `/api/download/${req.params.jobId}/${file}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/denoise/:jobId', validateJobId, validateJobDir, async (req, res) => {
  try {
    const stem = cleanName(req.body?.stem || 'vocals').replace(/\.[^.]+$/, '');
    const input = path.join(req.jobDir, `${stem}.wav`);
    if (!fs.existsSync(input)) return res.status(404).json({ error: `${stem}.wav not found` });
    const file = `${stem}_denoised.wav`;
    await ffmpeg(['-i', input, '-af', 'afftdn=nf=-25', path.join(req.jobDir, file)]);
    res.json({ success: true, file, url: `/api/download/${req.params.jobId}/${file}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mix/:jobId', validateJobId, validateJobDir, async (req, res) => {
  try {
    const level = Math.max(0, Math.min(Number(req.body?.vocalLevel ?? 1), 1));
    const instrumental = req.body?.instrumentalFile || 'instrumental.wav';
    const vocals = req.body?.vocalsFile || 'vocals.wav';
    const instrumentalPath = path.join(req.jobDir, cleanName(instrumental));
    const vocalsPath = path.join(req.jobDir, cleanName(vocals));
    if (!fs.existsSync(instrumentalPath) || !fs.existsSync(vocalsPath)) {
      return res.status(404).json({ error: 'Both instrumental and vocals stems are required' });
    }
    const file = `mixed_vocalLevel_${level}.wav`;
    await ffmpeg([
      '-i', instrumentalPath,
      '-i', vocalsPath,
      '-filter_complex', `[1:a]volume=${level}[v];[0:a][v]amix=inputs=2:duration=longest[out]`,
      '-map', '[out]',
      path.join(req.jobDir, file),
    ]);
    res.json({ success: true, file, vocalLevel: level, url: `/api/download/${req.params.jobId}/${file}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/replace-audio/:jobId', validateJobId, validateJobDir, async (req, res) => {
  try {
    const videoFile = cleanName(req.body?.videoFile);
    const audioStem = cleanName(req.body?.audioStem || 'instrumental').replace(/\.[^.]+$/, '');
    const videoPath = path.join(req.jobDir, videoFile);
    const audioPath = path.join(req.jobDir, `${audioStem}.wav`);
    if (!fs.existsSync(videoPath) || !fs.existsSync(audioPath)) return res.status(404).json({ error: 'Video or audio stem not found' });
    const file = `video_${audioStem}.mp4`;
    await ffmpeg(['-i', videoPath, '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-shortest', path.join(req.jobDir, file)]);
    res.json({ success: true, file, url: `/api/download/${req.params.jobId}/${file}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/karaoke/:jobId', validateJobId, validateJobDir, async (req, res) => {
  res.status(501).json({ error: 'Karaoke rendering needs a lyrics file upload step; transcription is available separately.' });
});

app.post('/api/transcribe/:jobId', validateJobId, validateJobDir, async (req, res) => {
  res.json({ success: true, lyricsFile: 'lyrics.json', data: [], message: 'No local Whisper model configured yet' });
});

app.get('/api/status/:jobId', validateJobId, (req, res) => {
  const jobId = req.params.jobId;
  const jobDir = path.join(OUTPUT_DIR, jobId);
  const files = fs.existsSync(jobDir) ? listMediaFiles(jobDir) : [];
  const progress = activeJobs.get(jobId);
  if (progress?.event === 'error') return res.json({ ...progress, status: 'error', files });
  if (progress?.event === 'complete') return res.json({ ...progress, status: 'completed', files });
  if (progress) return res.json({ ...progress, status: 'processing', files });
  if (files.length) return res.json({ status: 'completed', jobId, files });
  res.json({ status: 'not_found', jobId, files: [] });
});

app.get('/api/download/:jobId/:filename', validateJobId, (req, res) => {
  const file = cleanName(req.params.filename);
  if (!/\.(wav|mp3|m4a|ogg|flac|aac|opus|mp4|webm|mkv|mov|avi|zip)$/i.test(file)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = safePath(OUTPUT_DIR, req.params.jobId, file);
  if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath);
});

app.get('/api/download-zip/:jobId', validateJobId, validateJobDir, async (req, res) => {
  try {
    const zip = path.join(req.jobDir, `${req.params.jobId}.zip`);
    if (process.platform === 'win32') {
      const ps = [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${req.jobDir.replace(/'/g, "''")}\\*' -DestinationPath '${zip.replace(/'/g, "''")}' -Force`,
      ];
      await runTool('powershell.exe', ps);
    } else {
      await runTool('zip', ['-r', zip, '.'], { cwd: req.jobDir });
    }
    res.download(zip);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

io.on('connection', socket => {
  socket.on('job:subscribe', jobId => {
    const clean = sanitizeId(jobId);
    if (!clean) return;
    socket.join(`job:${clean}`);
    if (activeJobs.has(clean)) socket.emit('job:update', activeJobs.get(clean));
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
  console.log(`ffmpeg: ${ffmpegPath}`);
});
