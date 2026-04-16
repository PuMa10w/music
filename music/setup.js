const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Helpers ───────────────────────────────────────────────────────────────

function run(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function exists(p) {
  return p !== null && fs.existsSync(p);
}

function log(label, value, ok) {
  const icon = ok ? '[OK]' : '[MISS]';
  console.log(`  ${icon} ${label}: ${value || '(not found)'}`);
}

// ─── OS detection ──────────────────────────────────────────────────────────

const platform = process.platform; // win32 | darwin | linux
const isWin = platform === 'win32';
const isMac = platform === 'darwin';

const osLabel = isWin ? 'Windows' : isMac ? 'macOS' : 'Linux';
console.log(`\n🔧 Environment Setup (${osLabel} / ${os.arch()})\n`);

// ─── Conda env ─────────────────────────────────────────────────────────────

const CONDA_ENV = process.env.CONDA_ENV || 'music';

function condaPrefix() {
  // Try: userprofile/anaconda3/envs/<env>  or  userprofile/miniconda3/envs/<env>
  const home = os.homedir();
  const bases = isWin
    ? [
        path.join(home, 'anaconda3', 'envs', CONDA_ENV),
        path.join(home, 'miniconda3', 'envs', CONDA_ENV),
        path.join(home, '.conda', 'envs', CONDA_ENV),
      ]
    : [
        path.join(home, 'anaconda3', 'envs', CONDA_ENV),
        path.join(home, 'miniconda3', 'envs', CONDA_ENV),
        path.join(home, '.conda', 'envs', CONDA_ENV),
        // macOS Homebrew
        path.join('/opt', 'homebrew', 'Caskroom', 'miniconda', 'base', 'envs', CONDA_ENV),
        path.join('/usr', 'local', 'Caskroom', 'miniconda', 'base', 'envs', CONDA_ENV),
      ];

  // Also check CONDA_PREFIX env
  if (process.env.CONDA_PREFIX) bases.unshift(process.env.CONDA_PREFIX);

  for (const b of bases) {
    if (fs.existsSync(b)) return b;
  }
  return null;
}

const cPrefix = condaPrefix();

// ─── Python ────────────────────────────────────────────────────────────────

let pythonPath = null;

// 1. From env
if (process.env.PYTHON_PATH && exists(process.env.PYTHON_PATH)) {
  pythonPath = process.env.PYTHON_PATH;
}

// 2. From conda env
if (!pythonPath && cPrefix) {
  const candidates = isWin
    ? [path.join(cPrefix, 'python.exe')]
    : [path.join(cPrefix, 'bin', 'python3'), path.join(cPrefix, 'bin', 'python')];
  for (const c of candidates) {
    if (exists(c)) { pythonPath = c; break; }
  }
}

// 3. Fallback: which/where
if (!pythonPath) {
  pythonPath = run(isWin ? 'where python' : 'which python3') || run(isWin ? 'where python' : 'which python');
}

log('Python', pythonPath, !!pythonPath);

// ─── yt-dlp ────────────────────────────────────────────────────────────────

let ytDlpPath = null;

if (process.env.YT_DLP_PATH && exists(process.env.YT_DLP_PATH)) {
  ytDlpPath = process.env.YT_DLP_PATH;
}

if (!ytDlpPath) {
  ytDlpPath = run(isWin ? 'where yt-dlp' : 'which yt-dlp');
}

// Try python module
if (!ytDlpPath && pythonPath) {
  const out = run(`${pythonPath} -c "import yt_dlp; print(yt_dlp.__file__)"`);
  if (out) ytDlpPath = `${pythonPath} -m yt_dlp`;
}

log('yt-dlp', ytDlpPath, !!ytDlpPath);

// ─── ffmpeg / ffprobe ──────────────────────────────────────────────────────

let ffmpegPath = null;
let ffprobePath = null;

if (process.env.FFMPEG_PATH && exists(process.env.FFMPEG_PATH)) {
  ffmpegPath = process.env.FFMPEG_PATH;
}

if (!ffmpegPath) {
  ffmpegPath = run(isWin ? 'where ffmpeg' : 'which ffmpeg');
}

if (!ffmpegPath && cPrefix) {
  const bin = isWin ? cPrefix : path.join(cPrefix, 'bin');
  const cands = isWin
    ? [path.join(bin, 'ffmpeg.exe')]
    : [path.join(bin, 'ffmpeg')];
  for (const c of cands) { if (exists(c)) { ffmpegPath = c; break; } }
}

// ffmpeg-static
if (!ffmpegPath) {
  try {
    const staticPath = require.resolve('ffmpeg-static');
    if (exists(staticPath)) ffmpegPath = staticPath;
  } catch { /* not installed */ }
}

log('ffmpeg', ffmpegPath, !!ffmpegPath);

// ffprobe
if (ffmpegPath) {
  const dir = path.dirname(ffmpegPath);
  const base = isWin ? 'ffprobe.exe' : 'ffprobe';
  ffprobePath = path.join(dir, base);
  if (!exists(ffprobePath)) ffprobePath = null;
}

if (!ffprobePath) {
  ffprobePath = run(isWin ? 'where ffprobe' : 'which ffprobe');
}

if (!ffprobePath && cPrefix) {
  const bin = isWin ? cPrefix : path.join(cPrefix, 'bin');
  const cands = isWin
    ? [path.join(bin, 'ffprobe.exe')]
    : [path.join(bin, 'ffprobe')];
  for (const c of cands) { if (exists(c)) { ffprobePath = c; break; } }
}

log('ffprobe', ffprobePath, !!ffprobePath);

// ─── Python packages ───────────────────────────────────────────────────────

const packages = ['demucs', 'librosa', 'numpy', 'soundfile', 'scipy', 'torch'];
const packageStatus = {};

console.log('\n  Python packages:');

if (pythonPath) {
  for (const pkg of packages) {
    const out = run(`${pythonPath} -c "import ${pkg}; print(${pkg}.__version__)"`);
    const ok = out !== null;
    packageStatus[pkg] = { ok, version: out };
    log(pkg, out, ok);
  }
} else {
  for (const pkg of packages) {
    packageStatus[pkg] = { ok: false, version: null };
    log(pkg, '(skipped — no Python)', false);
  }
}

// ─── Summary ───────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────');

const allPaths = {
  python: pythonPath,
  ytDlp: ytDlpPath,
  ffmpeg: ffmpegPath,
  ffprobe: ffprobePath,
  condaEnv: cPrefix,
  condaEnvName: CONDA_ENV,
  platform,
};

const missing = [];
if (!pythonPath) missing.push('Python');
if (!ytDlpPath) missing.push('yt-dlp');
if (!ffmpegPath) missing.push('ffmpeg');
if (!ffprobePath) missing.push('ffprobe');

for (const pkg of packages) {
  if (!packageStatus[pkg].ok) missing.push(`Python: ${pkg}`);
}

if (missing.length === 0) {
  console.log('✅ All dependencies found!');
} else {
  console.log(`⚠️  Missing: ${missing.join(', ')}`);
}

// ─── Write config.local.json ───────────────────────────────────────────────

const configLocal = {
  pythonPath: pythonPath || '',
  ytDlpPath: ytDlpPath || '',
  ffmpegPath: ffmpegPath || '',
  ffprobePath: ffprobePath || '',
  condaEnv: CONDA_ENV,
  condaPrefix: cPrefix || '',
  platform,
  missing,
  packages: Object.fromEntries(
    Object.entries(packageStatus).map(([k, v]) => [k, v.version || 'not installed'])
  ),
};

const outPath = path.join(__dirname, 'config.local.json');
fs.writeFileSync(outPath, JSON.stringify(configLocal, null, 2) + '\n', 'utf8');
console.log(`\n📄 Written: ${outPath}\n`);
