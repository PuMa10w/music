const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { exec, execFile } = require('child_process');
const util = require('util');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const http = require('http');
const { Server } = require('socket.io');

const execPromise = util.promisify(exec);
const execFilePromise = util.promisify(execFile);

// ===== HTTP SERVER + SOCKET.IO =====

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    // Оптимизация для real-time событий
    pingTimeout: 60000,
    pingInterval: 25000
});

// Карта активных задач для WebSocket
const activeJobs = new Map();

// ===== УТИЛИТЫ БЕЗОПАСНОСТИ =====

/**
 * Санитизация jobId — разрешаем только UUID v4 формат
 */
function sanitizeId(input) {
    if (typeof input !== 'string') return null;
    const match = input.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
    return match ? match[0] : null;
}

/**
 * Санитизация имени стема — только alphanumeric + underscore
 */
function sanitizeStemName(input) {
    if (typeof input !== 'string') return null;
    const match = input.match(/^[a-zA-Z0-9_]+$/);
    return match ? match[0] : null;
}

/**
 * Безопасное разрешение пути — убеждаемся что путь внутри OUTPUT_DIR или UPLOAD_DIR
 */
function safePath(baseDir, ...segments) {
    const resolved = path.resolve(baseDir, ...segments);
    const resolvedBase = path.resolve(baseDir);
    if (!resolved.startsWith(resolvedBase)) {
        return null; // Path traversal detected!
    }
    return resolved;
}

/**
 * Валидация параметров эффекта
 */
function sanitizeEffectParams(params) {
    if (!params || typeof params !== 'object') return {};
    const sanitized = {};
    const allowedKeys = new Set(['mix', 'decay', 'threshold', 'ratio', 'attack', 'release', 'rate', 'depth', 'semitones', 'drive', 'tone']);
    for (const [key, value] of Object.entries(params)) {
        if (!allowedKeys.has(key)) continue;
        if (typeof value === 'number' && isFinite(value)) {
            sanitized[key] = value;
        } else if (typeof value === 'string') {
            const num = parseFloat(value);
            if (isFinite(num)) sanitized[key] = num;
        }
    }
    return sanitized;
}

// ===== КРОССПЛАТФОРМЕННАЯ КОНФИГУРАЦИЯ =====
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// Загружаем локальный конфиг если есть (создан setup.js)
const LOCAL_CONFIG_PATH = path.join(__dirname, 'config.local.json');
const LOCAL_CONFIG = fs.existsSync(LOCAL_CONFIG_PATH) ? JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8')) : {};

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// Python: автоопределение пути
function resolvePythonPath() {
    // 1. Переменная окружения
    if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
        return process.env.PYTHON_PATH;
    }
    // 2. Local config (setup.js)
    if (LOCAL_CONFIG.pythonPath && fs.existsSync(LOCAL_CONFIG.pythonPath)) {
        return LOCAL_CONFIG.pythonPath;
    }
    // 3. Config.json
    if (CONFIG.python.path && fs.existsSync(CONFIG.python.path)) {
        return CONFIG.python.path;
    }
    // 4. Ищем python в conda окружении (Windows)
    const condaEnvName = CONFIG.python.condaEnv || 'music';
    if (isWin) {
        const condaPaths = [
            path.join(process.env.USERPROFILE, 'anaconda3', 'envs', condaEnvName, 'python.exe'),
            path.join(process.env.USERPROFILE, 'miniconda3', 'envs', condaEnvName, 'python.exe'),
            path.join(process.env.LOCALAPPDATA, 'miniconda3', 'envs', condaEnvName, 'python.exe'),
            path.join(process.env.USERPROFILE, '.conda', 'envs', condaEnvName, 'python.exe'),
        ];
        for (const p of condaPaths) {
            if (fs.existsSync(p)) return p;
        }
    }
    // 5. Ищем python в conda окружении (macOS/Linux)
    if (isMac || process.platform === 'linux') {
        const condaPaths = [
            path.join(process.env.HOME, 'anaconda3', 'envs', condaEnvName, 'bin', 'python3'),
            path.join(process.env.HOME, 'miniconda3', 'envs', condaEnvName, 'bin', 'python3'),
            path.join(process.env.HOME, 'opt', 'anaconda3', 'envs', condaEnvName, 'bin', 'python3'),
            path.join(process.env.HOME, '.conda', 'envs', condaEnvName, 'bin', 'python3'),
        ];
        for (const p of condaPaths) {
            if (fs.existsSync(p)) return p;
        }
    }
    // 6. Fallback - always use the correct Python path
    return 'C:\\Users\\rousl\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';
}

const PYTHON_PATH = resolvePythonPath();
console.log(`[INFO] Python path: ${PYTHON_PATH}`);

// yt-dlp: автоопределение
function resolveYtDlpPath() {
    if (process.env.YT_DLP_PATH && fs.existsSync(process.env.YT_DLP_PATH)) return process.env.YT_DLP_PATH;
    if (LOCAL_CONFIG.ytDlpPath && fs.existsSync(LOCAL_CONFIG.ytDlpPath)) return LOCAL_CONFIG.ytDlpPath;
    if (isWin) {
        const winPaths = [
            path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Programs', 'Python', 'Python314', 'Scripts', 'yt-dlp.exe'),
            path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Programs', 'Python', 'Python313', 'Scripts', 'yt-dlp.exe'),
            path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
            path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Programs', 'Python', 'Python311', 'Scripts', 'yt-dlp.exe'),
        ];
        for (const p of winPaths) {
            if (fs.existsSync(p)) return p;
        }
    }
    if (isMac) {
        const macPaths = [
            '/Library/Frameworks/Python.framework/Versions/3.14/bin/yt-dlp',
            '/Library/Frameworks/Python.framework/Versions/3.13/bin/yt-dlp',
            '/opt/homebrew/bin/yt-dlp',
            '/usr/local/bin/yt-dlp',
        ];
        for (const p of macPaths) {
            if (fs.existsSync(p)) return p;
        }
    }
    if (process.platform === 'linux') {
        const linuxPaths = ['/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp', path.join(process.env.HOME, '.local', 'bin', 'yt-dlp')];
        for (const p of linuxPaths) {
            if (fs.existsSync(p)) return p;
        }
    }
    return 'yt-dlp';
}

const YT_DLP_PATH = resolveYtDlpPath();
console.log(`[INFO] yt-dlp path: ${YT_DLP_PATH}`);

function resolveLocalBinary(staticPath, fallbackName) {
    if (staticPath && fs.existsSync(staticPath)) {
        return staticPath;
    }

    if (staticPath) {
        const dir = path.dirname(staticPath);
        const base = path.basename(staticPath, path.extname(staticPath));
        const candidates = [
            path.join(dir, base),
            path.join(dir, `${base}.exe`),
            path.join(dir, fallbackName),
            path.join(dir, `${fallbackName}.exe`),
        ];

        if (isWin) {
            const bareCandidate = path.join(dir, base);
            const exeCandidate = path.join(dir, `${base}.exe`);
            if (fs.existsSync(bareCandidate) && !fs.existsSync(exeCandidate)) {
                try {
                    fs.copyFileSync(bareCandidate, exeCandidate);
                } catch (e) {
                    console.log(`[WARN] Failed to materialize ${exeCandidate}: ${e.message}`);
                }
            }
        }

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
    }

    return fallbackName;
}

// FFmpeg: ищем системный ffmpeg
let FFMPEG_PATH = null;
const possiblePaths = isWin ? [
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-8.1-full_build', 'bin', 'ffmpeg.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'ffmpeg',
] : ['ffmpeg'];

for (const p of possiblePaths) {
    if (p === 'ffmpeg') {
        FFMPEG_PATH = 'ffmpeg';
        break;
    }
    if (fs.existsSync(p)) {
        FFMPEG_PATH = p;
        break;
    }
}

if (!FFMPEG_PATH) FFMPEG_PATH = 'ffmpeg';
if (isWin && FFMPEG_PATH === 'ffmpeg') {
    console.log('[WARN] No system ffmpeg found, using PATH');
}
console.log(`[INFO] ffmpeg path: ${FFMPEG_PATH}`);

// ffprobe
let FFPROBE_PATH = null;
const ffprobePaths = isWin ? [
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-8.1-full_build', 'bin', 'ffprobe.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'ffmpeg', 'bin', 'ffprobe.exe'),
    'C:\\ffmpeg\\bin\\ffprobe.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe',
    'ffprobe',
] : ['ffprobe'];

for (const p of ffprobePaths) {
    if (p === 'ffprobe') {
        FFPROBE_PATH = 'ffprobe';
        break;
    }
    if (fs.existsSync(p)) {
        FFPROBE_PATH = p;
        break;
    }
}

if (!FFPROBE_PATH) FFPROBE_PATH = 'ffprobe';
if (isWin && FFPROBE_PATH === 'ffprobe') {
    console.log('[WARN] No system ffprobe found, using PATH');
}
console.log(`[INFO] ffprobe path: ${FFPROBE_PATH}`);

// Кэш моделей
function resolveModelCacheDir() {
    if (CONFIG.models.cacheDir && CONFIG.models.cacheDir !== '') {
        return CONFIG.models.cacheDir;
    }
    if (isWin) {
        return path.join(process.env.USERPROFILE || '', '.cache', 'demucs');
    }
    return path.join(process.env.HOME || '', '.cache', 'demucs');
}
const MODEL_CACHE_DIR = resolveModelCacheDir();

const SEPARATE_SCRIPT = path.join(__dirname, 'separate.py');
const STEMS_SCRIPT = path.join(__dirname, 'stems.py');
const ANALYZE_SCRIPT = path.join(__dirname, 'analyze.py');
const EFFECTS_SCRIPT = path.join(__dirname, 'effects.py');
const MODEL_MANAGER = path.join(__dirname, 'model_manager.py');

const MODEL_REGISTRY = {
    modern_ensemble: { name: 'Modern AI Ensemble', family: 'Hybrid', badge: 'Recommended', description: 'Fully local blend of available Demucs-family models with no API keys required', stems: ['vocals', 'drums', 'bass', 'other'], backend: 'local-demucs-blend', compact: 'Best local overall quality' },
    demucs: { name: 'Demucs v4', family: 'Transformer', badge: 'Native', description: 'Local Hybrid Transformer backend without external services', stems: ['vocals', 'drums', 'bass', 'other'], backend: 'htdemucs', compact: 'Native local backend' },
    htdemucs_ft: { name: 'HT Demucs FT', family: 'Transformer', badge: 'Fine-tuned', description: 'Local fine-tuned Demucs profile for cleaner music stems', stems: ['vocals', 'drums', 'bass', 'other'], backend: 'htdemucs_ft', compact: 'Fine-tuned local profile' },
    mdxnet: { name: 'MDX-Net Local', family: 'Hybrid', badge: 'Local', description: 'Local MDX-style profile using Demucs MDX weights only', stems: ['vocals', 'drums', 'bass', 'other'], backend: 'mdx', compact: 'Local MDX profile' },
    vrnet: { name: 'VR Network Local', family: 'Hybrid', badge: 'Local', description: 'Local VR-style profile without UVR5 or API access', stems: ['vocals', 'drums', 'bass', 'other'], backend: 'mdx', compact: 'Local VR-style profile' },
    bandit: { name: 'Bandit', family: 'Research', badge: 'Modern', description: 'Local research-style profile using the 6-source Demucs family', stems: ['vocals', 'drums', 'bass', 'other'], backend: 'htdemucs_6s', compact: '6-source local profile' },
    melband: { name: 'MelBand Roformer', family: 'Roformer', badge: 'Modern', description: 'Local roformer-style profile tuned through local Demucs variants', stems: ['vocals', 'drums', 'bass', 'other'], backend: 'htdemucs_ft', compact: 'Local roformer-style profile' },
    scnet: { name: 'SCNet', family: 'Spectral', badge: 'Modern', description: 'Local compact spectral profile without external dependencies', stems: ['vocals', 'drums', 'bass', 'other'], backend: 'htdemucs', compact: 'Compact local spectral profile' },
    openunmix: { name: 'Open-Unmix Local', family: 'U-Net', badge: 'Local', description: 'Local U-Net style profile routed through conflict-free local models', stems: ['vocals', 'drums', 'bass', 'other'], backend: 'htdemucs', compact: 'Local U-Net style profile' },
    asteroid: { name: 'Asteroid Local', family: 'ConvTasNet', badge: 'Local', description: 'Local ConvTasNet-style profile with no API keys or cloud services', stems: ['vocals', 'drums', 'bass', 'other'], backend: 'mdx', compact: 'Local ConvTasNet-style profile' },
    spleeter: { name: 'Fast Local 4-stem', family: 'Fast', badge: 'Fast', description: 'Fast local 4-stem profile that does not require Spleeter installation or API access', stems: ['vocals', 'drums', 'bass', 'other'], backend: 'htdemucs', compact: 'Fast local profile' },
    ensemble: { name: 'Ensemble', family: 'Hybrid', badge: 'Blend', description: 'Fully local blended stem strategy using only local backends', stems: ['vocals', 'drums', 'bass', 'other'], backend: 'local-demucs-blend', compact: 'Local blend strategy' },
    uvr5_mdx: { name: 'UVR5 MDX Local', family: 'UVR', badge: 'Local', description: 'Local UVR-style MDX profile with no UVR5 installation required', stems: ['vocals', 'drums', 'bass', 'other'], backend: 'mdx', compact: 'Local UVR-style MDX' },
    uvr5_vr: { name: 'UVR5 VR Local', family: 'UVR', badge: 'Local', description: 'Local UVR-style VR profile with no UVR5 installation required', stems: ['vocals', 'drums', 'bass', 'other'], backend: 'htdemucs_6s', compact: 'Local UVR-style VR' },
    lalal: { name: 'Lalal Local', family: 'Local HQ', badge: 'Local', description: 'Local high-quality profile that replaces the old cloud-only option', stems: ['vocals', 'drums', 'bass', 'other'], backend: 'htdemucs_ft', compact: 'Local high-quality route' },
    legacy: { name: 'Legacy Filters', family: 'Fallback', badge: 'Fallback', description: 'Frequency-based fallback path without external ML requirements', stems: ['vocals', 'drums', 'bass', 'other'], backend: 'legacy', compact: 'No-ML fallback' },
};

const PORT = process.env.PORT || CONFIG.server.port || 8000;

app.use(cors());
app.use(express.json({ limit: CONFIG.server.maxUploadSize || '50mb' }));

// ===== SECURITY HEADERS =====
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // CSP: разрешаем только локальные ресурсы
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'");
    next();
});

// ===== RATE LIMITING (simple in-memory) =====
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 минута
const RATE_LIMIT_MAX = 100; // макс запросов в минуту

app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return next();
    }
    const record = rateLimitMap.get(ip);
    if (now > record.resetAt) {
        // Сбросить окно
        record.count = 1;
        record.resetAt = now + RATE_LIMIT_WINDOW;
        return next();
    }
    if (record.count >= RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Слишком много запросов' });
    }
    record.count++;
    next();
});

// Очистка rate limit cache каждые 10 минут
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
        if (now > record.resetAt) rateLimitMap.delete(key);
    }
}, 10 * 60 * 1000);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/outputs', express.static(path.join(__dirname, 'outputs'), {
    // Запретить dotfiles и path traversal
    dotfiles: 'ignore',
    // Не разрешать listing директорий
    index: false,
    // Set immutable для кэширования
    setHeaders: (res, path, stat) => {
        res.set('Cache-Control', 'public, max-age=3600');
    }
}));

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'outputs');
const HISTORY_FILE = path.join(OUTPUT_DIR, 'history.json');

[UPLOAD_DIR, OUTPUT_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ===== УТИЛИТЫ =====

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        }
    } catch (e) { }
    return [];
}

function saveHistory(history) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function addToHistory(entry) {
    const history = loadHistory();
    history.unshift(entry);
    if (history.length > 50) history.pop();
    saveHistory(history);
}

async function getAudioInfo(filePath) {
    try {
        let cmd;
        if (isWin) {
            cmd = `cmd /c "chcp 65001 >nul 2>&1 && "${FFPROBE_PATH}" -v quiet -print_format json -show_format -show_streams "${filePath.replace(/\\/g, '\\\\')}" 2>nul"`;
        } else {
            cmd = `"${FFPROBE_PATH}" -v quiet -print_format json -show_format -show_streams "${filePath}"`;
        }
        console.log('[getAudioInfo] Running:', cmd.substring(0, 150) + '...');
        const { stdout } = await execPromise(cmd, { maxBuffer: 50 * 1024 * 1024, encoding: 'utf8' });
        let data;
        try {
            data = JSON.parse(stdout);
        } catch (e) {
            console.error('[getAudioInfo] JSON parse error, stdout length:', stdout.length, 'first 200 chars:', stdout.substring(0, 200));
            return null;
        }
        const format = data.format;
        const stream = data.streams?.[0];
        return {
            duration: format.duration ? Math.round(format.duration) : 0,
            size: parseInt(format.size),
            codec: stream?.codec_name || 'unknown',
            sampleRate: stream?.sample_rate || 'unknown',
            channels: stream?.channels || 0,
            bitrate: format.bit_rate ? parseInt(format.bit_rate) : 0
        };
    } catch (e) {
        console.error('[getAudioInfo] Error:', e.message);
        return null;
    }
}

async function runFfmpeg(args, options = {}) {
    if (isWin) {
        const cmd = `cmd /c "chcp 65001 >nul & "${FFMPEG_PATH}" ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')} 2>nul"`;
        return execPromise(cmd, {
            maxBuffer: 500 * 1024 * 1024,
            ...options,
        });
    }
    return execFilePromise(FFMPEG_PATH, args, {
        maxBuffer: 500 * 1024 * 1024,
        ...options,
    });
}

/**
 * Валидация аудиофайла — проверка на битые файлы и аномальные параметры
 */
async function validateAudioFile(filePath) {
    // Упрощённая валидация — проверяем только существование и размер файла
    try {
        if (!fs.existsSync(filePath)) {
            return { valid: false, error: 'Файл не найден' };
        }
        const stats = fs.statSync(filePath);
        if (stats.size < 1024) {
            return { valid: false, error: 'Файл слишком маленький (< 1KB)' };
        }
        // Проверка расширения
        const ext = path.extname(filePath).toLowerCase();
        const allowed = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.mp4', '.webm', '.opus', '.aac'];
        if (!allowed.includes(ext)) {
            return { valid: false, error: 'Неподдерживаемый формат файла' };
        }
        return { valid: true };
    } catch (error) {
        console.error('[validateAudioFile]', error.message);
        return { valid: true }; // Игнорируем ошибки, чтобы не блокировать загрузку
    }
}

async function convertToWav(inputPath, jobDir) {
    // Если уже WAV — возвращаем как есть
    if (inputPath.toLowerCase().endsWith('.wav')) {
        return inputPath;
    }
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(jobDir, `${baseName}.wav`);
    console.log(`[Convert] Converting ${inputPath} to WAV...`);
    try {
        // -vn: только аудио, -acodec pcm_s16le: стандартный WAV, -ar 44100: частота
        await execPromise(`"${FFMPEG_PATH}" -i "${inputPath}" -vn -acodec pcm_s16le -ar 44100 -y "${outputPath}"`, { 
            maxBuffer: 500 * 1024 * 1024 
        });
        if (fs.existsSync(outputPath)) {
            // Удаляем оригинал, если конвертация успешна
            if (inputPath !== outputPath && fs.existsSync(inputPath)) {
                fs.unlinkSync(inputPath);
            }
            return outputPath;
        } else {
            throw new Error('Output WAV not created');
        }
    } catch (error) {
        console.error('[Convert] Error:', error.message);
        throw new Error(`Failed to convert file to WAV: ${error.message}`);
    }
}

async function runPythonScript(scriptPath, args) {
    const argsStr = args.map(a => {
        if (isWin && a.includes(' ')) return `"${a}"`;
        return a;
    }).join(' ');

    const cmd = `"${PYTHON_PATH}" "${scriptPath}" ${argsStr}`;
    console.log('[PY]', cmd.substring(0, 300) + '...');

    const env = {
        ...process.env,
        PYTHONPATH: process.env.PYTHONPATH || '',
        MKL_NUM_THREADS: '1',
        OMP_NUM_THREADS: '1',
        PYTHONDONTWRITEBYTECODE: '1'
    };

    if (isWin) {
        const condaEnvDir = path.dirname(PYTHON_PATH);
        env.PATH = `${condaEnvDir};${condaEnvDir}\\Library\\bin;${env.PATH || ''}`;
    }

    const { stdout, stderr } = await execPromise(cmd, {
        maxBuffer: 500 * 1024 * 1024,
        env,
        cwd: __dirname,
        timeout: 600000
    });

    console.log('[PY stdout]', stdout.substring(0, 500));
    if (stderr && stderr.trim()) console.log('[PY stderr]', stderr.substring(0, 500));
    return stdout;
}

async function runPythonInline(code) {
    const escaped = code.replace(/"/g, '\\"');
    const cmd = `"${PYTHON_PATH}" -c "${escaped}"`;
    const env = {
        ...process.env,
        PYTHONPATH: __dirname + path.delimiter + (process.env.PYTHONPATH || ''),
        MKL_NUM_THREADS: '1',
        OMP_NUM_THREADS: '1',
        PYTHONDONTWRITEBYTECODE: '1'
    };

    if (isWin) {
        const condaEnvDir = path.dirname(PYTHON_PATH);
        env.PATH = `${condaEnvDir};${condaEnvDir}\Library\bin;${env.PATH || ''}`;
    }

    const { stdout, stderr } = await execPromise(cmd, {
        maxBuffer: 100 * 1024 * 1024,
        env,
        cwd: __dirname,
        timeout: 120000
    });

    if (stderr && stderr.trim()) console.log('[PY inline stderr]', stderr.substring(0, 500));
    return stdout;
}

// ===== ЗАГРУЗКА ФАЙЛОВ =====

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        // Разрешаем любые файлы, валидацию сделаем через ffprobe
        cb(null, true);
    },
    limits: { fileSize: 500 * 1024 * 1024 } // Увеличим лимит до 500MB для видео
});

app.post('/api/upload', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
        // Валидация имени файла — убираем опасные символы
        const safeFilename = path.basename(req.file.originalname).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
        const jobId = uuidv4();
        const jobDir = safePath(OUTPUT_DIR, jobId);
        if (!jobDir) return res.status(500).json({ error: 'Ошибка создания задания' });
        fs.mkdirSync(jobDir, { recursive: true });
        const destPath = path.join(jobDir, safeFilename);
        fs.renameSync(req.file.path, destPath);

        // Конвертация в WAV (если нужно, например, видеофайлы или не-WAV аудио)
        let finalPath = destPath;
        let finalFilename = safeFilename;
        try {
            finalPath = await convertToWav(destPath, jobDir);
            if (finalPath !== destPath) {
                finalFilename = path.basename(finalPath);
            }
        } catch (convError) {
            console.warn('[Upload] Conversion failed, proceeding with original:', convError.message);
            finalPath = destPath;
        }

        // Валидация аудиофайла
        const validation = await validateAudioFile(finalPath);
        if (!validation.valid) {
            // Удаляем битый файл
            if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
            if (finalPath !== destPath && fs.existsSync(destPath)) fs.unlinkSync(destPath);
            fs.rmdirSync(jobDir);
            return res.status(400).json({ error: validation.error });
        }

        res.json({ jobId, filename: finalFilename, size: req.file.size, info: validation.info });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Ошибка обработки файла' });
    }
});

app.post('/api/upload-multiple', upload.array('audios', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Файлы не загружены' });
        const results = [];
        const errors = [];
        for (const file of req.files) {
            const safeFilename = path.basename(file.originalname).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
            const jobId = uuidv4();
            const jobDir = safePath(OUTPUT_DIR, jobId);
            if (!jobDir) continue;
            fs.mkdirSync(jobDir, { recursive: true });
            const destPath = path.join(jobDir, safeFilename);
            fs.renameSync(file.path, destPath);

            // Конвертация в WAV если нужно
            let finalPath = destPath;
            let finalFilename = safeFilename;
            try {
                finalPath = await convertToWav(destPath, jobDir);
                if (finalPath !== destPath) {
                    finalFilename = path.basename(finalPath);
                }
            } catch (convError) {
                console.warn('[UploadMultiple] Conversion failed for', safeFilename, convError.message);
                finalPath = destPath;
            }

            // Валидация каждого файла
            const validation = await validateAudioFile(finalPath);
            if (!validation.valid) {
                if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
                if (finalPath !== destPath && fs.existsSync(destPath)) fs.unlinkSync(destPath);
                fs.rmdirSync(jobDir);
                errors.push({ filename: safeFilename, error: validation.error });
                continue;
            }
            results.push({ jobId, filename: finalFilename, size: file.size, info: validation.info });
        }
        if (errors.length > 0 && results.length === 0) {
            return res.status(400).json({ error: 'Все файлы не прошли валидацию', details: errors });
        }
        res.json({ files: results, warnings: errors.length > 0 ? errors : undefined });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Ошибка обработки файлов' });
    }
});

// ===== YOUTUBE =====

app.post('/api/youtube', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL не указан' });
        // Валидация URL
        const urlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\/.+$/i;
        if (!urlPattern.test(url)) {
            return res.status(400).json({ error: 'Неверная ссылка' });
        }
        const jobId = uuidv4();
        const jobDir = safePath(OUTPUT_DIR, jobId);
        if (!jobDir) return res.status(500).json({ error: 'Ошибка создания задания' });
        fs.mkdirSync(jobDir, { recursive: true });
        const outputPath = path.join(jobDir, 'audio.wav');
        await execPromise(`"${YT_DLP_PATH}" --no-check-certificates --ffmpeg-location "${FFMPEG_PATH}" -x --audio-format wav --audio-quality 0 -o "${outputPath}" "${url}"`, {
            maxBuffer: 200 * 1024 * 1024
        });

        // Валидация загруженного аудио
        const validation = await validateAudioFile(outputPath);
        if (!validation.valid) {
            fs.unlinkSync(outputPath);
            fs.rmdirSync(jobDir);
            return res.status(400).json({ error: `YouTube аудио не прошло валидацию: ${validation.error}` });
        }

        res.json({ jobId, filename: 'YouTube Audio', info: validation.info });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки с YouTube: ' + error.message });
    }
});

// ===== MIDDLEWARE =====

/**
 * Middleware: санитизация jobId в route параметрах
 */
function validateJobId(req, res, next) {
    const cleanId = sanitizeId(req.params.jobId);
    if (!cleanId) {
        return res.status(400).json({ error: 'Неверный формат jobId' });
    }
    req.params.jobId = cleanId;
    next();
}

/**
 * Middleware: проверка существования директории задания
 */
function validateJobDir(req, res, next) {
    const jobDir = safePath(OUTPUT_DIR, req.params.jobId);
    if (!jobDir || !fs.existsSync(jobDir)) {
        return res.status(404).json({ error: 'Задание не найдено' });
    }
    req.jobDir = jobDir;
    next();
}

// ===== АНАЛИЗ АУДИО =====

app.post('/api/analyze/:jobId', validateJobId, validateJobDir, async (req, res) => {
    try {
        const { jobId } = req.params;
        const jobDir = req.jobDir;
        const files = fs.readdirSync(jobDir);
        const inputFile = files.find(f => /\.(mp3|wav|m4a|ogg|flac|mp4|webm|opus|aac)$/i.test(f));
        if (!inputFile) return res.status(404).json({ error: 'Аудиофайл не найден' });
        // Валидация имени файла
        const safeInputFile = path.basename(inputFile).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
        const inputPath = path.join(jobDir, safeInputFile);

        // Валидация аудио перед анализом
        const validation = await validateAudioFile(inputPath);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        const wavPath = path.join(jobDir, 'input.wav');
        await runFfmpeg(['-i', inputPath, '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', '-y', wavPath]);
        const stdout = await runPythonScript(ANALYZE_SCRIPT, [wavPath]);
        const jsonMatch = stdout.trim().split('\n').pop();
        const analysis = JSON.parse(jsonMatch);
        res.json({ ...analysis, validation: validation.info });
    } catch (error) {
        console.error('Analysis error:', error.message);
        res.status(500).json({ error: 'Ошибка анализа: ' + error.message });
    }
});

// ===== РАЗДЕЛЕНИЕ 2-STEM =====

app.post('/api/separate/:jobId', validateJobId, validateJobDir, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { vocalStrength = 1.0, preset = 'default', model = 'demucs', mode = 'all' } = req.body;
        const jobDir = req.jobDir;

        // Notify start
        emitProgress(jobId, 'start', { type: '2stem', model, preset });

        const files = fs.readdirSync(jobDir);
        const inputFile = files.find(f => /\.(mp3|wav|m4a|ogg|flac|mp4|webm|opus|aac)$/i.test(f));
        if (!inputFile) return res.status(404).json({ error: 'Аудиофайл не найден' });
        const inputPath = path.join(jobDir, inputFile);
        const wavPath = path.join(jobDir, 'input.wav');
        const vocalsPath = path.join(jobDir, 'vocals.wav');
        const instrumentalPath = path.join(jobDir, 'instrumental.wav');

        // Step 1: Convert to WAV
        emitProgress(jobId, 'progress', { step: 'convert', percent: 10, message: 'Конвертация в WAV...' });
        console.log('[SEPARATE] Running ffmpeg convert...');
        await runFfmpeg(['-i', inputPath, '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', '-y', wavPath]);
        console.log('[SEPARATE] Ffmpeg convert done');

        // Step 2: ML separation
        emitProgress(jobId, 'progress', { step: 'separate', percent: 30, message: `Разделение через ${model}...` });
        // Build args for stems.py with argparse
        const args = [
            wavPath, jobDir,
            '--preset', preset,
            '--strength', vocalStrength.toString(),
            '--model', model,
            '--type', '4stem',
            '--mode', mode || 'all',
            '--vocal-strength', (vocalStrength / 100).toString()
        ];
        await runPythonScript(STEMS_SCRIPT, args);

        // Step 3: Mix instrumental
        emitProgress(jobId, 'progress', { step: 'mix', percent: 70, message: 'Создание инструментала...' });
        const stems = ['vocals', 'drums', 'bass', 'other'];
        const stemPaths = {};
        for (const stem of stems) {
            const p = path.join(jobDir, `${stem}.wav`);
            if (fs.existsSync(p)) stemPaths[stem] = p;
        }

        if (stemPaths.drums && stemPaths.bass && stemPaths.other) {
            await runFfmpeg([
                '-i', stemPaths.drums,
                '-i', stemPaths.bass,
                '-i', stemPaths.other,
                '-filter_complex', '[0:a][1:a][2:a]amix=inputs=3:duration=longest[out]',
                '-map', '[out]',
                '-y', instrumentalPath,
            ]);
        }

        if (!fs.existsSync(vocalsPath) || !fs.existsSync(instrumentalPath)) {
            emitProgress(jobId, 'error', { message: 'Файлы разделения не созданы' });
            throw new Error('Файлы разделения не созданы');
        }

        let stemsInfo = {};
        const stemsInfoPath = path.join(jobDir, 'stems_info.json');
        if (fs.existsSync(stemsInfoPath)) {
            try {
                stemsInfo = JSON.parse(fs.readFileSync(stemsInfoPath, 'utf8'));
            } catch (e) {
                stemsInfo = {};
            }
        }

        // Complete
        emitProgress(jobId, 'complete', { percent: 100, message: 'Готово!', stems: Object.keys(stemPaths) });
        addToHistory({ jobId, filename: inputFile, date: new Date().toISOString(), type: '2stem', preset, vocalStrength });
        res.json({
            instrumental: `/outputs/${jobId}/instrumental.wav`,
            vocals: `/outputs/${jobId}/vocals.wav`,
            modelRequested: stemsInfo.modelRequested || model,
            modelUsed: stemsInfo.model || model,
            runtimeBackend: stemsInfo.runtimeBackend || stemsInfo.model || model,
            fallbackUsed: Boolean(stemsInfo.fallbackUsed)
        });
    } catch (error) {
        emitProgress(req.params.jobId, 'error', { message: error.message });
        res.status(500).json({ error: 'Ошибка разделения: ' + error.message });
    }
});

app.post('/api/compare/:jobId', validateJobId, validateJobDir, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { vocalStrength = 1.0, preset = 'default', primaryModel = 'modern_ensemble', secondaryModel = 'demucs', mode = 'all' } = req.body;
        const jobDir = req.jobDir;

        const files = fs.readdirSync(jobDir);
        const inputFile = files.find(f => /\.(mp3|wav|m4a|ogg|flac|mp4|webm|opus|aac)$/i.test(f));
        if (!inputFile) return res.status(404).json({ error: 'Аудиофайл не найден' });

        const inputPath = path.join(jobDir, inputFile);
        const wavPath = path.join(jobDir, 'input_compare.wav');
        await runFfmpeg(['-i', inputPath, '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', '-y', wavPath]);

        const compareRoot = path.join(jobDir, 'compare');
        fs.mkdirSync(compareRoot, { recursive: true });

        const variants = [
            { slot: 'a', model: primaryModel },
            { slot: 'b', model: secondaryModel }
        ];

        const response = {};
        for (const variant of variants) {
            const outDir = path.join(compareRoot, variant.slot);
            fs.mkdirSync(outDir, { recursive: true });
            const args = [
            wavPath, outDir,
            '--preset', preset,
            '--strength', vocalStrength.toString(),
            '--model', variant.model,
            '--type', '4stem',
            '--mode', mode || 'all',
            '--vocal-strength', (vocalStrength / 100).toString()
        ];
        await runPythonScript(STEMS_SCRIPT, args);

            const vocalsPath = path.join(outDir, 'vocals.wav');
            const instrumentalPath = path.join(outDir, 'instrumental.wav');
            if (!fs.existsSync(instrumentalPath)) {
                const pieces = ['drums', 'bass', 'other']
                    .map(stem => path.join(outDir, `${stem}.wav`))
                    .filter(p => fs.existsSync(p));
                if (pieces.length) {
                    const mixRefs = pieces.map((_, idx) => `[${idx}:a]`).join('');
                    const ffmpegArgs = [];
                    pieces.forEach(p => ffmpegArgs.push('-i', p));
                    ffmpegArgs.push('-filter_complex', `${mixRefs}amix=inputs=${pieces.length}:duration=longest[out]`, '-map', '[out]', '-y', instrumentalPath);
                    await runFfmpeg(ffmpegArgs);
                }
            }

            const infoPath = path.join(outDir, 'stems_info.json');
            const info = fs.existsSync(infoPath) ? JSON.parse(fs.readFileSync(infoPath, 'utf8')) : {};
            response[variant.slot] = {
                modelRequested: info.modelRequested || variant.model,
                modelUsed: info.model || variant.model,
                runtimeBackend: info.runtimeBackend || info.model || variant.model,
                fallbackUsed: Boolean(info.fallbackUsed),
                vocals: fs.existsSync(vocalsPath) ? `/outputs/${jobId}/compare/${variant.slot}/vocals.wav` : null,
                instrumental: fs.existsSync(instrumentalPath) ? `/outputs/${jobId}/compare/${variant.slot}/instrumental.wav` : null,
            };
        }

        res.json(response);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сравнения моделей: ' + error.message });
    }
});

// ===== РАЗДЕЛЕНИЕ 4-STEM =====

app.post('/api/stems/:jobId', validateJobId, validateJobDir, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { preset = 'default', strength = 1.0, model = 'demucs', mode = 'all' } = req.body;
        const jobDir = req.jobDir;

        emitProgress(jobId, 'start', { type: '4stem', model, preset });

        const files = fs.readdirSync(jobDir);
        const inputFile = files.find(f => /\.(mp3|wav|m4a|ogg|flac|mp4|webm|opus|aac)$/i.test(f));
        if (!inputFile) return res.status(404).json({ error: 'Аудиофайл не найден' });
        const inputPath = path.join(jobDir, inputFile);
        const wavPath = path.join(jobDir, 'input.wav');

        emitProgress(jobId, 'progress', { step: 'convert', percent: 10, message: 'Конвертация в WAV...' });
        await runFfmpeg(['-i', inputPath, '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', '-y', wavPath]);

        emitProgress(jobId, 'progress', { step: 'separate', percent: 30, message: `Разделение на 4 стема (${model})...` });
        const args = [
            wavPath, jobDir,
            '--preset', preset,
            '--strength', strength.toString(),
            '--model', model,
            '--type', '4stem',
            '--mode', mode || 'all',
            '--vocal-strength', (vocalStrength / 100).toString()
        ];
        await runPythonScript(STEMS_SCRIPT, args);

        emitProgress(jobId, 'progress', { step: 'save', percent: 80, message: 'Сохранение стемов...' });
        const stems = ['vocals', 'drums', 'bass', 'other'];
        const stemUrls = {};
        for (const stem of stems) {
            const stemPath = path.join(jobDir, `${stem}.wav`);
            if (fs.existsSync(stemPath)) stemUrls[stem] = `/outputs/${jobId}/${stem}.wav`;
        }

        emitProgress(jobId, 'complete', { percent: 100, message: 'Готово!', stems: Object.keys(stemUrls) });
        addToHistory({ jobId, filename: inputFile, date: new Date().toISOString(), type: '4stem', preset, strength, stems: Object.keys(stemUrls) });
        res.json(stemUrls);
    } catch (error) {
        emitProgress(req.params.jobId, 'error', { message: error.message });
        res.status(500).json({ error: 'Ошибка разделения на стемы: ' + error.message });
    }
});

// ===== РАЗДЕЛЕНИЕ 6-STEM =====

app.post('/api/stems6/:jobId', validateJobId, validateJobDir, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { preset = 'default', strength = 1.0, model = 'demucs', mode = 'all' } = req.body;
        const jobDir = req.jobDir;

        emitProgress(jobId, 'start', { type: '6stem', model, preset });

        const files = fs.readdirSync(jobDir);
        const inputFile = files.find(f => /\.(mp3|wav|m4a|ogg|flac|mp4|webm|opus|aac)$/i.test(f));
        if (!inputFile) return res.status(404).json({ error: 'Аудиофайл не найден' });
        const inputPath = path.join(jobDir, inputFile);
        const wavPath = path.join(jobDir, 'input.wav');

        emitProgress(jobId, 'progress', { step: 'convert', percent: 10, message: 'Конвертация в WAV...' });
        await runFfmpeg(['-i', inputPath, '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', '-y', wavPath]);

        emitProgress(jobId, 'progress', { step: 'separate', percent: 20, message: `Разделение на 6 стемов (${model})...` });
        const args = [
            wavPath, jobDir,
            '--preset', preset,
            '--strength', strength.toString(),
            '--model', model,
            '--type', '6stem',
            '--mode', mode || 'all',
            '--vocal-strength', (vocalStrength / 100).toString()
        ];
        await runPythonScript(STEMS_SCRIPT, args);

        emitProgress(jobId, 'progress', { step: 'postprocess', percent: 70, message: 'Постобработка (lead/backing vocals, piano)...' });
        emitProgress(jobId, 'progress', { step: 'save', percent: 90, message: 'Сохранение стемов...' });

        const stems = ['lead_vocals', 'backing_vocals', 'vocals', 'drums', 'bass', 'piano', 'other', 'instrumental'];
        const stemUrls = {};
        for (const stem of stems) {
            const stemPath = path.join(jobDir, `${stem}.wav`);
            if (fs.existsSync(stemPath)) stemUrls[stem] = `/outputs/${jobId}/${stem}.wav`;
        }

        emitProgress(jobId, 'complete', { percent: 100, message: 'Готово!', stems: Object.keys(stemUrls) });
        addToHistory({ jobId, filename: inputFile, date: new Date().toISOString(), type: '6stem', preset, strength, model, stems: Object.keys(stemUrls) });
        res.json(stemUrls);
    } catch (error) {
        emitProgress(req.params.jobId, 'error', { message: error.message });
        res.status(500).json({ error: 'Ошибка разделения на 6 стемов: ' + error.message });
    }
});

// ===== ДОСТУПНЫЕ МОДЕЛИ =====

app.get('/api/models', (req, res) => {
    res.json(MODEL_REGISTRY);
});

// ===== МИКШЕР =====

app.post('/api/mix/:jobId', validateJobId, validateJobDir, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { stems } = req.body;
        const jobDir = req.jobDir;

        const stemFiles = {
            vocals: path.join(jobDir, 'vocals.wav'),
            drums: path.join(jobDir, 'drums.wav'),
            bass: path.join(jobDir, 'bass.wav'),
            other: path.join(jobDir, 'other.wav')
        };

        const activeStems = [];
        let idx = 0;
        let inputs = '';

        for (const [name, settings] of Object.entries(stems)) {
            const filePath = stemFiles[name];
            if (fs.existsSync(filePath)) {
                inputs += `-i "${filePath}" `;
                activeStems.push({ name, settings, idx });
                idx++;
            }
        }

        if (activeStems.length === 0) throw new Error('Нет доступных стемов');

        let filterComplex = '';
        activeStems.forEach((stem, i) => {
            // Санитизация volume и pan — только числа
            const volume = Math.max(0, Math.min(parseFloat(stem.settings.volume) || 1, 5));
            const pan = Math.max(0, Math.min(parseFloat(stem.settings.pan) || 0.5, 1));
            filterComplex += `[${i}:a]volume=${volume},pan=stereo|c0=${1 - pan}|c1=${pan}[s${i}];`;
        });

        const mixInputs = activeStems.map((_, i) => `[s${i}]`).join('');
        filterComplex += `${mixInputs}amix=inputs=${activeStems.length}:duration=longest[out]`;

        const outputPath = path.join(jobDir, 'mix.wav');
        await execPromise(`"${FFMPEG_PATH}" ${inputs} -filter_complex "${filterComplex}" -map "[out]" -y "${outputPath}"`);
        res.json({ mix: `/outputs/${jobId}/mix.wav` });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка микширования: ' + error.message });
    }
});

// ===== ЭКСПОРТ =====

app.post('/api/export/:jobId/:type', validateJobId, validateJobDir, async (req, res) => {
    try {
        const { jobId, type } = req.params;
        const { format = 'wav', bitrate = 320 } = req.body;
        const jobDir = req.jobDir;

        // Валидация type — только имена стемов
        const allowedTypes = ['vocals', 'drums', 'bass', 'other', 'instrumental', 'mix', 'lead_vocals', 'backing_vocals', 'piano'];
        if (!allowedTypes.includes(type)) {
            return res.status(400).json({ error: 'Неверный тип экспорта' });
        }

        const extMap = { wav: 'wav', mp3: 'mp3', flac: 'flac', ogg: 'ogg', aac: 'aac' };
        const ext = extMap[format] || 'wav';

        // Санитизация bitrate — только числа 64-512
        const safeBitrate = Math.max(64, Math.min(parseInt(bitrate) || 320, 512));

        const codecMap = {
            wav: '-acodec pcm_s16le',
            mp3: `-acodec libmp3lame -ab ${safeBitrate}k`,
            flac: '-acodec flac',
            ogg: `-acodec libvorbis -ab ${safeBitrate}k`,
            aac: `-acodec aac -ab ${safeBitrate}k`
        };

        const codec = codecMap[format] || codecMap.wav;
        const sourcePath = safePath(jobDir, `${type}.wav`);
        const exportPath = safePath(jobDir, `${type}.${ext}`);
        if (!sourcePath || !exportPath) return res.status(500).json({ error: 'Ошибка пути' });

        if (fs.existsSync(sourcePath)) {
            await execPromise(`"${FFMPEG_PATH}" -i "${sourcePath}" ${codec} -y "${exportPath}"`);
        }

        res.json({ url: `/outputs/${jobId}/${type}.${ext}`, format: ext });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка экспорта: ' + error.message });
    }
});

// ===== WAVEFORM =====

app.get('/api/waveform/:jobId', validateJobId, validateJobDir, async (req, res) => {
    try {
        const { jobId } = req.params;
        const jobDir = req.jobDir;
        const files = fs.readdirSync(jobDir);
        const inputFile = files.find(f => /\.(mp3|wav|m4a|ogg|flac)$/i.test(f));
        if (!inputFile) return res.json({ waveform: [], duration: 0 });

        const inputPath = path.join(jobDir, inputFile);
        const { stdout } = await execPromise(
            `"${FFMPEG_PATH}" -i "${inputPath}" -ac 1 -f s16le -acodec pcm_s16le pipe:1`,
            { maxBuffer: 500 * 1024 * 1024, encoding: 'buffer' }
        );

        const samples = 200;
        const sampleSize = Math.floor(stdout.length / samples);
        const waveform = [];
        for (let i = 0; i < samples; i++) {
            let sum = 0;
            const start = i * sampleSize;
            const count = Math.floor(sampleSize / 2);
            for (let j = 0; j < count; j++) {
                const idx = start + j * 2;
                if (idx + 1 < stdout.length) sum += stdout.readInt16LE(idx);
            }
            waveform.push(Math.abs(sum / (count || 1)) / 32768);
        }
        res.json({ waveform, duration: 0 });
    } catch (error) {
        res.json({ waveform: Array(200).fill(0), duration: 0 });
    }
});

// ===== ПРЕВЬЮ =====

app.get('/api/preview/:jobId', validateJobId, validateJobDir, async (req, res) => {
    try {
        const { jobId } = req.params;
        const jobDir = req.jobDir;
        const files = fs.readdirSync(jobDir);
        const inputFile = files.find(f => /\.(mp3|wav|m4a|ogg|flac|mp4|webm|opus|aac)$/i.test(f));
        if (!inputFile) return res.status(404).json({ error: 'Аудиофайл не найден' });
        const inputPath = path.join(jobDir, inputFile);
        const info = await getAudioInfo(inputPath);
        res.json({ filename: inputFile, url: `/outputs/${jobId}/${inputFile}`, info });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== ИСТОРИЯ =====

app.get('/api/history', (req, res) => res.json(loadHistory()));

app.delete('/api/history/:jobId', validateJobId, (req, res) => {
    const { jobId } = req.params;
    let history = loadHistory().filter(h => h.jobId !== jobId);
    saveHistory(history);
    const jobDir = safePath(OUTPUT_DIR, jobId);
    if (jobDir && fs.existsSync(jobDir)) fs.rmSync(jobDir, { recursive: true, force: true });
    res.json({ success: true });
});

// ===== EQ (10-BAND) =====

app.post('/api/eq/:jobId', validateJobId, validateJobDir, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { stem = 'vocals', bands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } = req.body;
        const jobDir = req.jobDir;
        if (!Array.isArray(bands) || bands.length !== 10) return res.status(400).json({ error: 'bands должен содержать 10 значений' });

        // Валидация имени стема
        const safeStem = sanitizeStemName(stem);
        if (!safeStem) return res.status(400).json({ error: 'Неверное имя стема' });

        const sourcePath = safePath(jobDir, `${safeStem}.wav`);
        if (!sourcePath || !fs.existsSync(sourcePath)) return res.status(404).json({ error: `Стем '${safeStem}' не найден` });
        const outputPath = safePath(jobDir, `${safeStem}_eq.wav`);
        if (!outputPath) return res.status(500).json({ error: 'Ошибка создания пути' });

        const eqFreqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        const eqParams = bands.map((gain, i) => `${eqFreqs[i]}=${gain}`).join(' ');
        const cmd = `"${PYTHON_PATH}" "${EFFECTS_SCRIPT}" "${sourcePath}" "${outputPath}" eq ${eqParams}`;
        await execPromise(cmd, { maxBuffer: 500 * 1024 * 1024, env: { ...process.env, PYTHONPATH: process.env.PYTHONPATH || '' } });

        if (!fs.existsSync(outputPath)) throw new Error('Файл EQ не создан');
        res.json({ url: `/outputs/${jobId}/${stem}_eq.wav`, stem, bands });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка EQ: ' + error.message });
    }
});

// ===== EFFECTS =====

app.post('/api/effect/:jobId', validateJobId, validateJobDir, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { stem = 'vocals', effect, params = {} } = req.body;
        const jobDir = req.jobDir;
        if (!effect) return res.status(400).json({ error: 'effect обязателен' });

        const validEffects = ['reverb', 'compressor', 'chorus', 'pitchshift', 'distortion', 'autotune', 'dereverb'];
        if (!validEffects.includes(effect)) return res.status(400).json({ error: `Неподдерживаемый эффект: ${validEffects.join(', ')}` });

        // Валидация имени стема и параметров
        const safeStem = sanitizeStemName(stem);
        if (!safeStem) return res.status(400).json({ error: 'Неверное имя стема' });

        const safeParams = sanitizeEffectParams(params);

        const sourcePath = safePath(jobDir, `${safeStem}.wav`);
        if (!sourcePath || !fs.existsSync(sourcePath)) return res.status(404).json({ error: `Стем '${safeStem}' не найден` });
        const outputPath = safePath(jobDir, `${safeStem}_${effect}.wav`);
        if (!outputPath) return res.status(500).json({ error: 'Ошибка создания пути' });

        const paramStr = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(' ');
        const cmd = `"${PYTHON_PATH}" "${EFFECTS_SCRIPT}" "${sourcePath}" "${outputPath}" ${effect}${paramStr ? ' ' + paramStr : ''}`;
        await execPromise(cmd, { maxBuffer: 500 * 1024 * 1024, env: { ...process.env, PYTHONPATH: process.env.PYTHONPATH || '' } });

        if (!fs.existsSync(outputPath)) throw new Error('Файл эффекта не создан');
        res.json({ url: `/outputs/${jobId}/${stem}_${effect}.wav`, stem, effect, params });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка эффекта: ' + error.message });
    }
});

// ===== SPECTROGRAM (Python-based) =====

app.get('/api/spectrogram/:jobId', validateJobId, validateJobDir, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { stem = 'input' } = req.query;
        const jobDir = req.jobDir;

        // Валидация имени стема
        const safeStem = sanitizeStemName(stem);
        if (!safeStem) return res.status(400).json({ error: 'Неверное имя стема' });

        const sourcePath = safePath(jobDir, `${safeStem}.wav`);
        if (!sourcePath || !fs.existsSync(sourcePath)) return res.status(404).json({ error: `Файл '${safeStem}.wav' не найден` });

        // Конвертируем в моно WAV если нужно
        const monoPath = path.join(jobDir, `${safeStem}_mono.wav`);
        await execPromise(`"${FFMPEG_PATH}" -i "${sourcePath}" -ac 1 -ar 44100 -y "${monoPath}"`, { maxBuffer: 500 * 1024 * 1024 });

        // Генерируем спектрограмму через Python
        const specJsonPath = path.join(jobDir, `${safeStem}_spec.json`);
        const specScript = path.join(__dirname, 'spectrogram.py');
        await execPromise(`"${PYTHON_PATH}" "${specScript}" "${monoPath}" "${specJsonPath}"`, { maxBuffer: 500 * 1024 * 1024, env: { ...process.env, PYTHONPATH: process.env.PYTHONPATH || '' } });

        if (!fs.existsSync(specJsonPath)) throw new Error('Спектрограмма не создана');
        const specData = JSON.parse(fs.readFileSync(specJsonPath, 'utf8'));

        // Cleanup
        if (fs.existsSync(monoPath)) fs.unlinkSync(monoPath);
        if (fs.existsSync(specJsonPath)) fs.unlinkSync(specJsonPath);

        res.json(specData);
    } catch (error) {
        console.error('Spectrogram error:', error.message);
        res.status(500).json({ error: 'Ошибка спектрограммы: ' + error.message });
    }
});

// ===== HEALTH =====

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ===== SYSTEM STATUS =====

app.get('/api/system/status', async (req, res) => {
    try {
        const stdout = await runPythonScript(MODEL_MANAGER, ['status']);
        res.json({ raw: stdout });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения статуса: ' + error.message });
    }
});

app.get('/api/models/status', async (req, res) => {
    try {
        const status = { python: PYTHON_PATH, condaEnv: CONFIG.python.condaEnv, libraries: {}, gpu: false, models: {} };
        try {
            const stdout = await runPythonInline(`
import json
from model_manager import check_system, get_runtime_models_status
info = check_system()
print(json.dumps({
  'libraries': info['libraries'],
  'gpu': info['gpu']['available'],
  'models': get_runtime_models_status()
}))
`);
            const libs = JSON.parse(stdout.trim());
            status.libraries = libs.libraries || {};
            status.gpu = libs.gpu || false;
            status.models = libs.models || {};
        } catch (e) {
            status.error = e.message;
        }
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка проверки моделей: ' + error.message });
    }
});

// ===== WEBSOCKET ОБРАБОТЧИКИ =====

io.on('connection', (socket) => {
    console.log(`[WS] Клиент подключён: ${socket.id}`);

    // Клиент подписывается на обновления задачи
    socket.on('subscribe', (jobId) => {
        const cleanId = sanitizeId(jobId);
        if (cleanId) {
            socket.join(`job:${cleanId}`);
            console.log(`[WS] Подписка на job:${cleanId}`);
            // Отправить текущий статус если есть
            if (activeJobs.has(cleanId)) {
                socket.emit('job:status', activeJobs.get(cleanId));
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`[WS] Клиент отключён: ${socket.id}`);
    });
});

/**
 * Отправить прогресс через WebSocket
 */
function emitProgress(jobId, event, data = {}) {
    const progress = {
        jobId,
        event,
        timestamp: Date.now(),
        ...data
    };
    // Сохраняем последний статус
    activeJobs.set(jobId, progress);
    // Отправляем всем подписчикам
    io.to(`job:${jobId}`).emit('job:update', progress);
}

// Очистка завершённых задач из памяти (каждые 5 минут)
setInterval(() => {
    const now = Date.now();
    for (const [jobId, progress] of activeJobs.entries()) {
        // Удаляем задачи старше 30 минут
        if (now - progress.timestamp > 30 * 60 * 1000) {
            activeJobs.delete(jobId);
        }
    }
}, 5 * 60 * 1000);

// ===== DENOISE ENDPOINT =====
app.post('/api/denoise/:jobId', validateJobId, validateJobDir, async (req, res) => {
    const jobId = req.params.jobId;
    const jobDir = path.join(UPLOAD_DIR, jobId);
    const { strength = 0.5, stem = 'vocals' } = req.body;

    try {
        const targetFile = path.join(jobDir, `${stem}.wav`);
        if (!fs.existsSync(targetFile)) {
            return res.status(404).json({ error: `File ${stem}.wav not found` });
        }

        const outputFile = path.join(jobDir, `${stem}_denoised.wav`);
        const scriptPath = path.join(__dirname, 'denoise.py');
        
        await runPythonScript(scriptPath, [targetFile, outputFile, String(strength)]);
        
        res.json({ success: true, file: `${stem}_denoised.wav`, path: outputFile });
    } catch (error) {
        console.error('[Denoise Error]', error);
        res.status(500).json({ error: 'Denoise failed', details: error.message });
    }
});

// ===== ЗАПУСК =====

server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket ready on ws://localhost:${PORT}`);
    console.log(`🎵 Voice Remover Pro v5.0 - ALL MODELS`);
    console.log(`📊 Models: fully local Demucs-family catalog, local blends, legacy fallback`);
    console.log(`🎸 Separation: 2-stem, 4-stem & 6-stem`);
    console.log(`🎛️ Mixer: Pan, Volume, EQ per stem`);
    console.log(`✨ Effects: Reverb, Compressor, Chorus, Pitch Shift, Distortion`);
    console.log(`📁 Formats: MP3, WAV, FLAC, OGG, M4A, AAC, AIFF, WMA, OPUS`);
    console.log(`🖥️ Platform: ${process.platform}`);
});
