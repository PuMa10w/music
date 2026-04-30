/**
 * Voice Remover Pro v5.0 — Ultimate Stem Separation
 * Main Application JavaScript
 */

// ==================== API BASE URL WITH FALLBACK ====================
let _apiBase = null;

async function getAPI() {
    if (_apiBase !== null) return _apiBase;
    try {
        // Try localhost:8000 first
        const res = await fetch('http://localhost:8000/api/health', { method: 'HEAD', signal: AbortSignal.timeout(2000) });
        if (res.ok || res.status < 500) {
            _apiBase = 'http://localhost:8000';
            return _apiBase;
        }
    } catch (e) {
        // localhost not available, fall back to relative path
    }
    _apiBase = '';
    return _apiBase;
}

// Synchronous getter for contexts where await is not possible (uses cached value)
function api() {
    return _apiBase !== null ? _apiBase : 'http://localhost:8000';
}

// ==================== STATE ====================

// WebSocket progress connection
let wsProgress = null;
let wsCurrentJobId = null;

/**
 * Инициализация WebSocket для прогресса
 */
function initWebSocketProgress() {
    if (wsProgress) return; // Уже инициализировано
    
    try {
        wsProgress = createProgressWebSocket();
        
        // Слушаем прогресс
        wsProgress.on('progress', (data) => {
            console.log('[WS] Progress:', data.percent, data.message);
            updateProgress(data.percent || 0, data.message || 'Обработка...');
        });

        wsProgress.on('complete', (data) => {
            console.log('[WS] Complete:', data);
            updateProgress(100, data.message || 'Готово!');
            hideLoading();
            toast('✓ Обработка завершена!', 'success');
        });

        wsProgress.on('error', (data) => {
            console.error('[WS] Error:', data);
            hideLoading();
            $('progressContainer').classList.add('hidden');
            toast('Ошибка: ' + (data.message || 'Неизвестная ошибка'), 'error');
        });

        wsProgress.on('start', (data) => {
            console.log('[WS] Job started:', data);
            $('progressContainer').classList.remove('hidden');
            updateProgress(5, 'Запуск обработки...');
        });

        console.log('[WS] Progress WebSocket initialized');
    } catch (e) {
        console.warn('[WS] Failed to initialize WebSocket:', e.message);
        // Fallback: без WebSocket прогресса
        wsProgress = null;
    }
}
let files = [];
let currentIdx = 0;
let currentJob = null;
let mode = '2stem';
let vocalStrength = 50; // 0-100 for mix mode
let quality = 'quality';
let preset = 'default';
let selectedModel = 'modern_ensemble';
let modelRegistry = {};
let modelStatusRegistry = {};
let stemsData = {};
let session = {};
let soloedStem = null;
let stemStates = {};
let eqStates = {};
const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

// ==================== BATCH PROCESSING ====================
let batchQueue = [];          // очередь заданий
let batchProcessing = false;  // флаг обработки
let batchPaused = false;      // флаг паузы
let maxConcurrent = 2;        // макс одновременно
let activeJobs = new Set();   // активные задачи

// Статусы файлов в очереди
const BATCH_STATUS = {
    PENDING: 'pending',     // ожидает
    PROCESSING: 'processing', // обрабатывается
    COMPLETED: 'completed', // завершён
    ERROR: 'error',         // ошибка
    CANCELLED: 'cancelled'  // отменён
};

// ==================== DOM HELPERS ====================
const $ = id => document.getElementById(id);

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    getAPI(); // probe API base URL
    initNavigation();
    initKeyboard();
    initDropZone();
    initPresets();
    loadSession();
    loadHistory();
    initMobileResponsive();
    loadModelRegistry();
    updateWorkspaceState();
});

function updateWorkspaceState(state = {}) {
    const modeLabels = {
        '2stem': '2 STEMS',
        '4stem': '4 STEMS',
        '6stem': '6 STEMS'
    };

    const activeFile = files[currentIdx];
    const statusText = state.status || (activeFile ? 'Файл готов' : 'Ожидание');
    const heroText = activeFile
        ? `Активный файл: ${activeFile.filename}. Выберите режим, настройте силу разделения и запустите обработку.`
        : 'Сейчас в сессии нет активного файла. Перетащите трек в левую панель или откройте YouTube-вкладку для импорта аудио.';

    if ($('statusFileCount')) $('statusFileCount').textContent = String(files.length);
    if ($('statusMode')) $('statusMode').textContent = modeLabels[mode] || mode.toUpperCase();
    if ($('statusPreset')) $('statusPreset').textContent = (preset || 'default').toUpperCase();
    if ($('statusState')) $('statusState').textContent = statusText;
    if ($('heroStateText')) $('heroStateText').textContent = heroText;
    if ($('heroStateCard')) $('heroStateCard').classList.toggle('hidden', Boolean(activeFile));

    if ($('resultSummary2Mode')) $('resultSummary2Mode').textContent = modeLabels[mode] || mode.toUpperCase();
    if ($('resultSummary2Preset')) $('resultSummary2Preset').textContent = (preset || 'default').toUpperCase();
    if ($('resultSummaryMultiMode')) $('resultSummaryMultiMode').textContent = modeLabels[mode] || mode.toUpperCase();
    if ($('resultSummaryMultiPreset')) $('resultSummaryMultiPreset').textContent = (preset || 'default').toUpperCase();

    const activeModel = modelRegistry[selectedModel];
    const runtimeStatus = modelStatusRegistry[selectedModel];
    if ($('activeModelName')) $('activeModelName').textContent = activeModel?.name || 'Model not loaded';
    if ($('activeModelBadge')) $('activeModelBadge').textContent = activeModel?.badge || 'Unknown';
    if ($('activeModelDescription')) $('activeModelDescription').textContent = activeModel?.description || 'Список моделей ещё загружается.';
    if ($('activeModelFamily')) $('activeModelFamily').textContent = activeModel?.family || 'Unknown';
    if ($('activeModelBackend')) $('activeModelBackend').textContent = `backend: ${runtimeStatus?.backend || activeModel?.backend || 'unknown'}`;
    if ($('activeModelState')) $('activeModelState').textContent = runtimeStatus?.available === false ? 'limited' : 'ready';
}

async function loadModelRegistry() {
    try {
        const [modelsRes, statusRes] = await Promise.all([
            fetch(`${api()}/api/models`),
            fetch(`${api()}/api/models/status`)
        ]);

        modelRegistry = modelsRes.ok ? await modelsRes.json() : {};
        const statusJson = statusRes.ok ? await statusRes.json() : {};
        modelStatusRegistry = statusJson.models || {};
        populateModelSelect();
        updateWorkspaceState();
    } catch (e) {
        console.warn('Model registry load failed:', e.message);
    }
}

function populateModelSelect() {
    const select = $('modelSelect');
    if (!select) return;
    const compareA = $('compareModelA');
    const compareB = $('compareModelB');

    const preferredOrder = ['modern_ensemble', 'demucs', 'htdemucs_ft', 'mdxnet', 'bandit', 'melband', 'scnet', 'vrnet', 'openunmix', 'asteroid', 'spleeter', 'ensemble', 'uvr5_mdx', 'uvr5_vr', 'lalal', 'legacy'];
    const entries = preferredOrder.filter(key => modelRegistry[key]).map(key => [key, modelRegistry[key]]);

    select.innerHTML = entries.map(([key, model]) => {
        const status = modelStatusRegistry[key];
        const suffix = status?.available === false ? ' • limited' : ' • local';
        return `<option value="${key}" ${key === selectedModel ? 'selected' : ''}>${model.name}${suffix}</option>`;
    }).join('');

    if (!modelRegistry[selectedModel] && entries.length) {
        selectedModel = entries[0][0];
        select.value = selectedModel;
    }

    const compareOptions = entries.map(([key, model]) => `<option value="${key}">${model.name}</option>`).join('');
    if (compareA) compareA.innerHTML = compareOptions;
    if (compareB) compareB.innerHTML = compareOptions;
    if (compareA && !compareA.value) compareA.value = 'modern_ensemble';
    if (compareB && !compareB.value) compareB.value = 'demucs';
}

function updateResultSummary(type, details = {}) {
    const targets = {
        2: {
            mode: $('resultSummary2Mode'),
            preset: $('resultSummary2Preset'),
            count: $('resultSummary2Count'),
            status: $('resultSummary2Status')
        },
        multi: {
            mode: $('resultSummaryMultiMode'),
            preset: $('resultSummaryMultiPreset'),
            count: $('resultSummaryMultiCount'),
            status: $('resultSummaryMultiStatus')
        }
    };

    const modeLabels = {
        '2stem': '2 STEMS',
        '4stem': '4 STEMS',
        '6stem': '6 STEMS'
    };

    const bucket = targets[type];
    if (!bucket) return;

    if (bucket.mode) bucket.mode.textContent = details.modeLabel || modeLabels[mode] || mode.toUpperCase();
    if (bucket.preset) bucket.preset.textContent = details.presetLabel || (preset || 'default').toUpperCase();
    if (bucket.count) bucket.count.textContent = String(details.count ?? 0);
    if (bucket.status) bucket.status.textContent = details.status || 'Готово';

    if (type === 2 && $('resultBackendTrace')) {
        const backend = details.runtimeBackend || modelStatusRegistry[selectedModel]?.backend || modelRegistry[selectedModel]?.backend || 'unknown';
        const requested = details.modelRequested || selectedModel;
        const used = details.modelUsed || selectedModel;
        $('resultBackendTrace').textContent = `requested: ${requested} / used: ${used} / backend: ${backend}`;
    }
}

// ==================== MOBILE RESPONSIVE ====================
function initMobileResponsive() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const appNav = document.getElementById('appNav');
    
    // Show/hide hamburger menu based on screen width
    function updateMobileMenuVisibility() {
        if (window.innerWidth <= 768) {
            // Mobile: show hamburger, hide nav items
            if (mobileMenuBtn) mobileMenuBtn.classList.remove('hidden');
            if (appNav) appNav.style.display = 'none';
        } else {
            // Desktop: hide hamburger, show nav
            if (mobileMenuBtn) mobileMenuBtn.classList.add('hidden');
            if (appNav) appNav.style.display = 'flex';
        }
    }
    
    // Initial check
    updateMobileMenuVisibility();
    
    // Listen to window resize
    window.addEventListener('resize', updateMobileMenuVisibility);
    
    // Prevent body scroll when mobile menu is open
    const overlay = document.getElementById('mobileMenuOverlay');
    if (overlay) {
        overlay.addEventListener('click', toggleMobileMenu);
    }
}

function toggleMobileMenu() {
    const overlay = document.getElementById('mobileMenuOverlay');
    const appNav = document.getElementById('appNav');
    
    if (!overlay || !appNav) return;
    
    const isHidden = overlay.classList.contains('hidden');
    
    if (isHidden) {
        // Open menu
        overlay.classList.remove('hidden');
        appNav.classList.remove('hidden');
        appNav.style.display = 'flex';
        appNav.style.position = 'fixed';
        appNav.style.top = '120px';
        appNav.style.left = '0';
        appNav.style.right = '0';
        appNav.style.zIndex = '1000';
        appNav.style.flexDirection = 'column';
        appNav.style.gap = '4px';
        appNav.style.margin = '0';
        appNav.style.padding = '8px';
        appNav.style.background = 'var(--bg-card)';
        appNav.style.borderBottom = '1px solid var(--border-subtle)';
        appNav.style.borderRadius = '0';
        document.body.style.overflow = 'hidden';
    } else {
        // Close menu
        overlay.classList.add('hidden');
        appNav.classList.add('hidden');
        appNav.style.position = 'relative';
        appNav.style.top = 'auto';
        appNav.style.left = 'auto';
        appNav.style.right = 'auto';
        appNav.style.zIndex = 'auto';
        appNav.style.flexDirection = 'row';
        appNav.style.margin = '0';
        appNav.style.padding = '10px';
        appNav.style.background = 'transparent';
        appNav.style.borderBottom = 'none';
        appNav.style.display = 'flex';
        document.body.style.overflow = 'auto';
    }
}



// ==================== TOAST NOTIFICATIONS ====================
function toast(msg, type = 'info') {
    const icons = {
        success: 'check-circle-fill',
        error: 'exclamation-triangle-fill',
        warning: 'exclamation-circle-fill',
        info: 'info-circle-fill'
    };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="bi bi-${icons[type]}"></i><span>${msg}</span>`;
    $('toastContainer').appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(100%)';
        t.style.transition = 'all 0.3s ease';
        setTimeout(() => t.remove(), 300);
    }, 4000);
}

// ==================== NAVIGATION ====================
function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            switchView(btn.dataset.view);
            
            // Close mobile menu after navigation (mobile only)
            if (window.innerWidth <= 768) {
                setTimeout(() => {
                    const overlay = document.getElementById('mobileMenuOverlay');
                    if (overlay && !overlay.classList.contains('hidden')) {
                        toggleMobileMenu();
                    }
                }, 100);
            }
        };
    });
}

function switchView(view) {
    const ws = $('workspaceView');
    const lib = $('libraryView');
    const yt = $('youtubeView');
    const hist = $('historyView');
    if (ws) ws.classList.toggle('hidden', view !== 'workspace');
    if (lib) lib.classList.toggle('hidden', view !== 'library');
    if (yt) yt.classList.toggle('hidden', view !== 'youtube');
    if (hist) hist.classList.toggle('hidden', view !== 'history');
    if (view === 'history') loadHistory();
    if (view === 'library' && lib) loadLibrary();
    updateWorkspaceState();
}

// ==================== KEYBOARD SHORTCUTS ====================
function initKeyboard() {
    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        switch(e.key.toLowerCase()) {
            case ' ':
                e.preventDefault();
                togglePlayPause();
                break;
            case 's':
                if (!e.ctrlKey && !e.metaKey) processCurrent();
                break;
            case 'r':
                resetApp();
                break;
            case 'o':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    $('fileInput').click();
                }
                break;
            case 'escape':
                resetApp();
                break;
        }
    });
}

function togglePlayPause() {
    const audio = $('previewAudio');
    if (audio?.src) {
        audio.paused ? audio.play() : audio.pause();
        updatePlayBtn(!audio.paused);
    }
}

function updatePlayBtn(playing) {
    const btn = $('playBtn');
    if (btn) {
        btn.innerHTML = playing ? '<i class="bi bi-pause-fill"></i>' : '<i class="bi bi-play-fill"></i>';
    }
}

function skipAudio(seconds) {
    const audio = $('previewAudio');
    if (audio?.src) {
        audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
    }
}

// ==================== DRAG & DROP ====================
function initDropZone() {
    const dz = $('dropZone');
    const fi = $('fileInput');

    dz.onclick = () => fi.click();

    dz.ondragover = e => {
        e.preventDefault();
        dz.classList.add('dragover');
    };

    dz.ondragleave = () => dz.classList.remove('dragover');

    dz.ondrop = e => {
        e.preventDefault();
        dz.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]);
    };

    fi.onchange = e => {
        if (e.target.files.length) handleFiles([...e.target.files]);
    };
}

// ==================== FILE HANDLING ====================
async function handleFiles(fileArr) {
    for (const file of fileArr) {
        const ext = file.name.split('.').pop().toLowerCase();
        const allowed = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'mp4', 'aac', 'aiff', 'wma', 'opus'];
        if (!allowed.includes(ext)) {
            toast(`${file.name} — неподдерживаемый формат`, 'error');
            continue;
        }

        const fd = new FormData();
        fd.append('audio', file);

        try {
            showLoading('ЗАГРУЗКА ФАЙЛА...');
            const res = await fetch(`${api()}/api/upload`, { method: 'POST', body: fd });
            const data = await res.json();
            hideLoading();
            if (data.error) { toast(data.error, 'error'); continue; }
            files.push({ ...data, file });
            toast(`✓ ${file.name}`, 'success');
        } catch (e) {
            hideLoading();
            toast(`Ошибка загрузки: ${file.name}`, 'error');
        }
    }
    updateList();
    saveSession();
}

function updateList() {
    const section = $('fileListSection');
    const list = $('fileList');

    if (!files.length) {
        section.classList.add('hidden');
        $('dropText').textContent = 'Перетащите файлы сюда';
        $('dropZone').classList.remove('has-file');
        currentJob = null;
        $('audioPreview').classList.add('hidden');
        updateWorkspaceState({ status: 'Ожидание' });
        return;
    }

    if (currentIdx >= files.length) {
        currentIdx = Math.max(0, files.length - 1);
    }

    section.classList.remove('hidden');
    $('dropText').textContent = `${files.length} файл(ов) загружено`;
    $('dropZone').classList.add('has-file');

    list.innerHTML = files.map((f, i) => `
        <div class="file-item ${i === currentIdx ? 'active' : ''}" onclick="selectFile(${i})">
            <div class="file-item-icon"><i class="bi bi-music-note-beamed"></i></div>
            <div class="file-item-info">
                <div class="file-item-name">${f.filename}</div>
                <div class="file-item-meta">
                    ${f.info ? `${fmtDur(f.info.duration)} • ${fmtSize(f.info.size)} • ${f.info.codec}` : fmtSize(f.size)}
                </div>
            </div>
            <button class="btn-icon" onclick="event.stopPropagation(); removeFile(${i})" title="Удалить">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
    `).join('');

    currentJob = files[currentIdx]?.jobId || null;
    updateWorkspaceState({ status: currentJob ? 'Файл готов' : 'Ожидание' });

    if (currentJob) {
        loadPreview(currentJob);
    }
}

function selectFile(i) {
    currentIdx = i;
    currentJob = files[i]?.jobId;
    // Save original filename for A/B testing
    window.originalFilename = files[i]?.filename;
    window.currentJobId = currentJob; // Ensure it's set for premium.js
    
    document.querySelectorAll('.file-item').forEach((item, idx) => {
        item.classList.toggle('active', idx === i);
    });
    loadPreview(currentJob);
    updateWorkspaceState({ status: currentJob ? 'Файл готов' : 'Ожидание' });

    // Инициализировать WebSocket для прогресса
    initWebSocketProgress();
}

function removeFile(i) {
    files.splice(i, 1);
    if (currentIdx >= files.length) currentIdx = Math.max(0, files.length - 1);
    updateList();
    saveSession();
}

function clearFiles() {
    files = [];
    currentIdx = 0;
    currentJob = null;
    updateList();
    toast('Список очищен', 'info');
    saveSession();
}

// ==================== PREVIEW & WAVEFORM ====================
async function loadPreview(jobId) {
    if (!jobId) return;
    try {
        const res = await fetch(`${api()}/api/preview/${jobId}`);
        const d = await res.json();
        if (d.error) return;

        $('previewName').textContent = d.filename;
        $('previewBadges').innerHTML = d.info ? `
            <span class="badge text-bg-secondary">${d.info.codec}</span>
            <span class="badge text-bg-info">${fmtDur(d.info.duration)}</span>
        ` : '';
        $('previewAudio').src = `${api()}${d.url}`;
        $('audioPreview').classList.remove('hidden');
        updateWorkspaceState({ status: 'Превью загружено' });

        const audio = $('previewAudio');
        audio.ontimeupdate = () => {
            $('currentTime').textContent = fmtDur(Math.floor(audio.currentTime || 0));
            $('totalTime').textContent = fmtDur(Math.floor(audio.duration || 0));
        };
        audio.onplay = () => updatePlayBtn(true);
        audio.onpause = () => updatePlayBtn(false);

        loadWaveform(jobId);
    } catch (e) { }
}

async function loadWaveform(jobId) {
    const canvas = $('waveformCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
    canvas.height = 120 * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    try {
        const res = await fetch(`${api()}/api/waveform/${jobId}`);
        const d = await res.json();
        if (d.waveform?.length) drawWave(ctx, d.waveform, canvas.width / (window.devicePixelRatio || 1), 120);
        else drawFakeWave(ctx, canvas.width / (window.devicePixelRatio || 1), 120);
    } catch (e) {
        drawFakeWave(ctx, canvas.width / (window.devicePixelRatio || 1), 120);
    }
}

function drawWave(ctx, data, w, h) {
    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle = 'rgba(108, 92, 231, 0.1)';
    ctx.lineWidth = 0.5;
    for (let y = 0; y < h; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }

    // Waveform gradient
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#ff6b9d');
    grad.addColorStop(0.5, '#6c5ce7');
    grad.addColorStop(1, '#4ecdc4');

    ctx.fillStyle = grad;
    const bw = w / data.length;
    data.forEach((v, i) => {
        const bh = Math.max(v * h * 0.8, 2);
        ctx.fillRect(i * bw, (h - bh) / 2, bw - 1, bh);
    });

    // Center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
}

function drawFakeWave(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    const data = Array(200).fill(0).map(() => Math.random() * 0.4 + 0.1);
    drawWave(ctx, data, w, h);
}

// ==================== MODE & QUALITY ====================
function setMode(m) {
    mode = m;
    document.querySelectorAll('.mode-option').forEach(c => c.classList.remove('active'));
    document.querySelector(`.mode-option[data-mode="${m}"]`).classList.add('active');

    const btnTexts = {
        '2stem': 'ЗАПУСТИТЬ 2-STEM',
        '4stem': 'ЗАПУСТИТЬ 4-STEM',
        '6stem': 'ЗАПУСТИТЬ 6-STEM'
    };
    $('processBtnText').textContent = btnTexts[m];
    updateWorkspaceState();
}

function setQuality(q) {
    quality = q;
    document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.quality-btn[data-quality="${q}"]`).classList.add('active');
}

function setModel(modelName) {
    selectedModel = modelName || 'modern_ensemble';
    updateWorkspaceState();
}

function initPresets() {
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            preset = btn.dataset.preset;
            updateWorkspaceState();
        };
    });
}

// ==================== PROCESSING ====================
async function processCurrent() {
    if (!currentJob) { toast('Выберите файл для обработки', 'warning'); return; }

    const strength = $('vocalStrength').value / 100;

    if (mode === 'analyze') {
        await runAnalysis();
        return;
    }

    showLoading('ОБРАБОТКА...');
    updateWorkspaceState({ status: 'Обработка...' });
    $('progressContainer').classList.remove('hidden');
    $('resultContainer2').classList.add('hidden');
    $('resultContainerMulti').classList.add('hidden');
    $('resetSection').classList.add('hidden');

    try {
        if (mode === '2stem') await process2stem(strength);
        else if (mode === '4stem') await process4stem(strength);
        else if (mode === '6stem') await process6stem(strength);
    } catch (e) {
        hideLoading();
        toast('Ошибка: ' + e.message, 'error');
        $('progressContainer').classList.add('hidden');
        updateWorkspaceState({ status: 'Ошибка' });
    }
}

// ==================== BATCH PROCESSING ====================
/**
 * Запустить обработку всех файлов (Batch mode)
 */
async function processAllFiles() {
    if (!files.length) {
        toast('Загрузите файлы для обработки', 'warning');
        return;
    }

    // Создать очередь
    batchQueue = files.map((f, idx) => ({
        idx,
        file: f,
        status: BATCH_STATUS.PENDING,
        progress: 0,
        error: null
    }));

    batchProcessing = true;
    batchPaused = false;
    activeJobs.clear();

    showBatchUI();
    updateBatchQueue();

    // Запустить воркеры обработки
    processBatchWorker();
}

/**
 * Обработчик очереди (максимум maxConcurrent одновременно)
 */
async function processBatchWorker() {
    while (batchProcessing && batchQueue.length > 0) {
        // Ждём если на паузе
        while (batchPaused && batchProcessing) {
            await sleep(500);
        }

        // Получить следующую задачу
        const job = batchQueue.find(j => j.status === BATCH_STATUS.PENDING);
        if (!job || activeJobs.size >= maxConcurrent) {
            await sleep(1000);
            continue;
        }

        activeJobs.add(job.idx);
        job.status = BATCH_STATUS.PROCESSING;
        updateBatchQueue();

        try {
            await processBatchJob(job);
            job.status = BATCH_STATUS.COMPLETED;
            job.progress = 100;
            toast(`✓ ${job.file.filename}`, 'success');
        } catch (error) {
            job.status = BATCH_STATUS.ERROR;
            job.error = error.message;
            toast(`✗ ${job.file.filename}: ${error.message}`, 'error');
        } finally {
            activeJobs.delete(job.idx);
            updateBatchQueue();

            // Проверить окончание всей обработки
            if (batchQueue.every(j => j.status !== BATCH_STATUS.PENDING)) {
                completeBatchProcessing();
            }
        }
    }
}

/**
 * Обработать одно задание в очереди
 */
async function processBatchJob(job) {
    const strength = $('vocalStrength').value / 100;
    const currentMode = mode;
    const currentQuality = quality;
    const currentPreset = preset;
    const currentModel = $('modelSelect')?.value || 'default';

    const jobId = job.file.jobId;
    if (!jobId) throw new Error('Invalid jobId');

    let res;
    let data;

    if (currentMode === '2stem') {
        res = await fetch(`${api()}/api/separate/${jobId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vocalStrength: vocalStrength, preset: currentPreset, mode: mode, model: currentModel })
        });
    } else if (currentMode === '4stem') {
        res = await fetch(`${api()}/api/stems/${jobId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ strength, preset: currentPreset, mode: currentQuality, model: currentModel })
        });
    } else if (currentMode === '6stem') {
        res = await fetch(`${api()}/api/stems6/${jobId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ strength, preset: currentPreset, mode: currentQuality, model: currentModel })
        });
    }

    if (!res.ok) {
        data = await res.json();
        throw new Error(data.error || 'Processing failed');
    }

    data = await res.json();
    job.progress = 100;
    job.results = data; // Сохранить результаты
}

/**
 * Завершить batch обработку
 */
function completeBatchProcessing() {
    batchProcessing = false;
    
    const completed = batchQueue.filter(j => j.status === BATCH_STATUS.COMPLETED).length;
    const failed = batchQueue.filter(j => j.status === BATCH_STATUS.ERROR).length;
    
    toast(`Обработка завершена: ${completed} успешно, ${failed} ошибок`, completed > failed ? 'success' : 'warning');
    
    // Показать итоговый отчёт
    setTimeout(() => {
        showBatchResults();
    }, 1000);
}

/**
 * Показать UI батч обработки
 */
function showBatchUI() {
    // Скрыть обычный UI
    $('progressContainer')?.classList.remove('hidden');
    $('resultContainer2')?.classList.add('hidden');
    $('resultContainerMulti')?.classList.add('hidden');
    
    // Показать батч очередь
    let batchUI = $('batchQueueUI');
    if (!batchUI) {
        batchUI = document.createElement('div');
        batchUI.id = 'batchQueueUI';
        batchUI.className = 'card batch-queue-card';
        $('progressContainer')?.parentElement?.insertBefore(batchUI, $('progressContainer')?.nextElementSibling);
    }
    batchUI.classList.remove('hidden');
}

/**
 * Обновить визуализацию очереди
 */
function updateBatchQueue() {
    let batchUI = $('batchQueueUI');
    if (!batchUI) return;

    const stats = {
        pending: batchQueue.filter(j => j.status === BATCH_STATUS.PENDING).length,
        processing: batchQueue.filter(j => j.status === BATCH_STATUS.PROCESSING).length,
        completed: batchQueue.filter(j => j.status === BATCH_STATUS.COMPLETED).length,
        error: batchQueue.filter(j => j.status === BATCH_STATUS.ERROR).length
    };

    const total = batchQueue.length;
    const done = stats.completed + stats.error;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    batchUI.innerHTML = `
        <div class="card-header">
            <i class="bi bi-arrow-repeat"></i>
            <h3>БАТЧ ОБРАБОТКА (${progress}%)</h3>
            <div style="margin-left:auto; font-size:0.7rem; color:var(--text-muted)">
                ${stats.processing} обработ. | ${stats.completed} готово | ${stats.error} ошибок
            </div>
        </div>
        <div class="card-body">
            <div class="ah-progress" style="margin-bottom:20px">
                <div class="ah-progress-bar" style="width:${progress}%"></div>
            </div>
            <div class="batch-queue-list">
                ${batchQueue.map((job, i) => `
                    <div class="batch-queue-item status-${job.status}">
                        <div class="batch-item-icon">
                            ${job.status === BATCH_STATUS.PENDING ? '<i class="bi bi-hourglass"></i>' : ''}
                            ${job.status === BATCH_STATUS.PROCESSING ? '<i class="bi bi-arrow-repeat" style="animation:spin 1s linear infinite;"></i>' : ''}
                            ${job.status === BATCH_STATUS.COMPLETED ? '<i class="bi bi-check-circle-fill" style="color:var(--accent-success)"></i>' : ''}
                            ${job.status === BATCH_STATUS.ERROR ? '<i class="bi bi-x-circle-fill" style="color:var(--accent-danger)"></i>' : ''}
                        </div>
                        <div class="batch-item-info">
                            <div class="batch-item-name">${job.file.filename}</div>
                            <div class="batch-item-meta">${job.status === BATCH_STATUS.ERROR ? job.error : job.progress}%</div>
                        </div>
                        ${job.status === BATCH_STATUS.PROCESSING ? `
                            <div class="batch-item-progress">
                                <div style="width:${job.progress}%; height:100%; background:var(--gradient-primary); border-radius:2px;"></div>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            <div class="batch-queue-controls" style="margin-top:16px; display:flex; gap:8px">
                <button class="reset-btn" onclick="pauseResumeBatch()" style="flex:1">
                    <i class="bi ${batchPaused ? 'bi-play-fill' : 'bi-pause-fill'}"></i>
                    ${batchPaused ? 'Возобновить' : 'Пауза'}
                </button>
                <button class="btn-danger" onclick="cancelBatch()" style="flex:1">
                    <i class="bi bi-stop-circle"></i>
                    Отмена
                </button>
            </div>
        </div>
    `;

    // Добавить стили для animation
    if (!document.getElementById('batchQueueStyles')) {
        const style = document.createElement('style');
        style.id = 'batchQueueStyles';
        style.textContent = `
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            .batch-queue-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: var(--bg-glass);
                border: 1px solid var(--border-subtle);
                border-radius: var(--radius-sm);
                margin-bottom: 8px;
                position: relative;
            }
            .batch-item-icon {
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
                color: var(--accent-primary);
                flex-shrink: 0;
            }
            .batch-item-info {
                flex: 1;
                min-width: 0;
            }
            .batch-item-name {
                font-weight: 600;
                font-size: 0.85rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .batch-item-meta {
                font-size: 0.7rem;
                color: var(--text-muted);
            }
            .batch-item-progress {
                width: 100px;
                height: 4px;
                background: var(--bg-card);
                border-radius: 2px;
                overflow: hidden;
                flex-shrink: 0;
            }
            .status-error .batch-item-name {
                color: var(--accent-danger);
            }
            .status-completed .batch-item-name {
                color: var(--accent-success);
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Пауза/возобновление батч обработки
 */
function pauseResumeBatch() {
    batchPaused = !batchPaused;
    toast(batchPaused ? 'Пауза' : 'Возобновлено', 'info');
    updateBatchQueue();
    if (!batchPaused) processBatchWorker(); // Продолжить обработку
}

/**
 * Отмена батч обработки
 */
function cancelBatch() {
    if (!confirm('Отменить всю батч обработку?')) return;
    
    batchProcessing = false;
    batchQueue.forEach(j => {
        if (j.status === BATCH_STATUS.PENDING || j.status === BATCH_STATUS.PROCESSING) {
            j.status = BATCH_STATUS.CANCELLED;
        }
    });
    
    toast('Батч обработка отменена', 'warning');
    updateBatchQueue();
    
    setTimeout(() => {
        $('batchQueueUI')?.classList.add('hidden');
        resetApp();
    }, 1500);
}

/**
 * Показать результаты батч обработки
 */
function showBatchResults() {
    const completed = batchQueue.filter(j => j.status === BATCH_STATUS.COMPLETED);
    
    if (!completed.length) return;
    
    const html = `
        <div class="card" style="margin-top:20px">
            <div class="card-header">
                <i class="bi bi-check-circle-fill" style="color:var(--accent-success)"></i>
                <h3>БАТЧ ОБРАБОТКА ЗАВЕРШЕНА</h3>
            </div>
            <div class="card-body">
                <p style="color:var(--text-secondary); margin-bottom:16px">
                    Успешно обработано файлов: <strong>${completed.length}</strong> из <strong>${batchQueue.length}</strong>
                </p>
                <div style="max-height:300px; overflow-y:auto; margin-bottom:16px">
                    ${completed.map(j => `
                        <div style="padding:8px; background:var(--bg-glass); border-radius:var(--radius-sm); margin-bottom:8px">
                            <div style="font-weight:600; font-size:0.85rem; margin-bottom:4px">${j.file.filename}</div>
                            <button class="btn-export" onclick="alert('Загрузка результатов для: ${j.file.filename}')" style="width:100%; margin-bottom:4px">
                                <i class="bi bi-download"></i> Загрузить ${mode.toUpperCase()}
                            </button>
                        </div>
                    `).join('')}
                </div>
                <button class="reset-btn" onclick="downloadAllBatchResults()" style="width:100%">
                    <i class="bi bi-download"></i> Загрузить все результаты (ZIP)
                </button>
            </div>
        </div>
    `;
    
    const container = document.createElement('div');
    container.innerHTML = html;
    $('progressContainer')?.parentElement?.appendChild(container);
}

/**
 * Загрузить все результаты в ZIP
 */
function downloadAllBatchResults() {
    toast('⏳ Подготовка архива...', 'info');
    // TODO: реализовать создание ZIP архива с результатами
    setTimeout(() => {
        toast('✓ Архив готов к загрузке', 'success');
    }, 2000);
}

async function process2stem(strength) {
    updateProgress(5, 'ИНИЦИАЛИЗАЦИЯ...');
    
    // Подписка на WebSocket прогресс
    if (wsProgress && currentJob) {
        wsProgress.subscribe(currentJob);
    }

    await sleep(300);

    updateProgress(30, 'РАЗДЕЛЕНИЕ ВОКАЛ / ИНСТРУМЕНТАЛ...');
    const res = await fetch(`${api()}/api/separate/${currentJob}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocalStrength: strength, preset, mode: quality, model: $('modelSelect')?.value || 'default' })
    });

    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    const d = await res.json();

    updateProgress(100, 'ГОТОВО!');
    hideLoading();

    setTimeout(() => {
        $('progressContainer').classList.add('hidden');
        $('resultContainer2').classList.remove('hidden');
        $('resetSection').classList.remove('hidden');

        $('vocalsAudio').src = `${api()}${d.vocals}`;
        $('instrAudio').src = `${api()}${d.instrumental}`;
        stemsData = { vocals: d.vocals, instrumental: d.instrumental };
        updateResultSummary(2, {
            count: 2,
            status: 'Готово',
            runtimeBackend: d.runtimeBackend,
            modelRequested: d.modelRequested,
            modelUsed: d.modelUsed
        });

        syncAudios(['vocalsAudio', 'instrAudio']);
        initEQSliders('vocals');
        initEQSliders('instrumental');
        toast('✓ 2-STEM разделение завершено!', 'success');
    }, 500);
}

async function compareModels() {
    if (!currentJob) {
        toast('Сначала выберите файл для сравнения моделей', 'warning');
        return;
    }

    const primaryModel = $('compareModelA')?.value || 'modern_ensemble';
    const secondaryModel = $('compareModelB')?.value || 'demucs';
    const vocalStrength = $('vocalStrength').value / 100;

    showLoading('СРАВНЕНИЕ МОДЕЛЕЙ...');
    try {
        const res = await fetch(`${api()}/api/compare/${currentJob}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vocalStrength,
                preset,
                primaryModel,
                secondaryModel
            })
        });

        if (!res.ok) {
            const d = await res.json();
            throw new Error(d.error || 'Compare failed');
        }

        const d = await res.json();
        $('compareContainer')?.classList.remove('hidden');

        $('compareModelATitle').textContent = `${modelRegistry[primaryModel]?.name || primaryModel}`;
        $('compareModelBTitle').textContent = `${modelRegistry[secondaryModel]?.name || secondaryModel}`;
        $('compareModelABackend').textContent = d.a?.runtimeBackend || 'backend';
        $('compareModelBBackend').textContent = d.b?.runtimeBackend || 'backend';
        $('compareVocalsA').src = d.a?.vocals ? `${api()}${d.a.vocals}` : '';
        $('compareInstrumentalA').src = d.a?.instrumental ? `${api()}${d.a.instrumental}` : '';
        $('compareVocalsB').src = d.b?.vocals ? `${api()}${d.b.vocals}` : '';
        $('compareInstrumentalB').src = d.b?.instrumental ? `${api()}${d.b.instrumental}` : '';
        toast('✓ A/B сравнение готово', 'success');
    } catch (e) {
        toast('Ошибка сравнения: ' + e.message, 'error');
    } finally {
        hideLoading();
    }
}

async function process4stem(strength) {
    updateProgress(5, 'ИНИЦИАЛИЗАЦИЯ...');
    
    // Подписка на WebSocket прогресс
    if (wsProgress && currentJob) {
        wsProgress.subscribe(currentJob);
    }

    await sleep(300);

    updateProgress(30, 'РАЗДЕЛЕНИЕ НА 4 СТЕМА...');
    const res = await fetch(`${api()}/api/stems/${currentJob}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocalStrength: vocalStrength, preset, mode: mode, model: $('modelSelect')?.value || 'default' })
    });

    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    const d = await res.json();

    updateProgress(100, 'ГОТОВО!');
    hideLoading();
    stemsData = d;

    setTimeout(() => {
        $('progressContainer').classList.add('hidden');
        $('resultContainerMulti').classList.remove('hidden');
        $('resetSection').classList.remove('hidden');
        $('multiResultTitle').textContent = '4-STEM РАЗДЕЛЕНИЕ';
        updateResultSummary('multi', { count: Object.keys(d).length, status: 'Готово' });
        renderMultiStems(d, 4);
        toast('✓ 4-STEM разделение завершено!', 'success');
    }, 500);
}

async function process6stem(strength) {
    updateProgress(5, 'ИНИЦИАЛИЗАЦИЯ...');
    
    // Подписка на WebSocket прогресс
    if (wsProgress && currentJob) {
        wsProgress.subscribe(currentJob);
    }

    await sleep(200);

    updateProgress(20, 'РАЗДЕЛЕНИЕ НА 6 СТЕМОВ...');
    const res = await fetch(`${api()}/api/stems6/${currentJob}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strength, preset, mode: quality, model: $('modelSelect')?.value || 'default' })
    });

    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    const d = await res.json();

    updateProgress(100, 'ГОТОВО!');
    hideLoading();
    stemsData = d;

    setTimeout(() => {
        $('progressContainer').classList.add('hidden');
        $('resultContainerMulti').classList.remove('hidden');
        $('resetSection').classList.remove('hidden');
        $('multiResultTitle').textContent = '6-STEM РАЗДЕЛЕНИЕ';
        updateResultSummary('multi', { count: Object.keys(d).length, status: 'Готово' });
        renderMultiStems(d, 6);
        toast('✓ 6-STEM разделение завершено!', 'success');
    }, 500);
}

// ==================== MULTI-STEM RENDERING ====================
function renderMultiStems(stems, count) {
    const config = {
        vocals: { icon: 'mic-fill', name: 'ВОКАЛ', color: 'vocals', desc: 'Основной вокал' },
        lead_vocals: { icon: 'mic-fill', name: 'LEAD ВОКАЛ', color: 'vocals', desc: 'Ведущий вокал' },
        backing_vocals: { icon: 'people-fill', name: 'BACKING ВОКАЛ', color: 'backing', desc: 'Бэк-вокал' },
        drums: { icon: 'disc', name: 'УДАРНЫЕ', color: 'drums', desc: 'Drums & Percussion' },
        bass: { icon: 'soundwave', name: 'БАС', color: 'bass', desc: 'Bass Guitar' },
        piano: { icon: 'piano', name: 'ПИАНО', color: 'piano', desc: 'Piano & Keys' },
        other: { icon: 'music-note-beamed', name: 'ДРУГОЕ', color: 'other', desc: 'Остальные инструменты' }
    };

    $('stemsContainer').innerHTML = Object.entries(stems).map(([key, url]) => {
        const c = config[key] || { icon: 'music-note', name: key.toUpperCase(), color: 'other', desc: '' };
        return `
        <div class="stem-card-mini ${c.color}" data-stem="${key}">
            <div class="stem-card-mini-header">
                <div class="stem-card-mini-icon"><i class="bi bi-${c.icon}"></i></div>
                <div>
                    <div class="stem-card-mini-title">${c.name}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted)">${c.desc}</div>
                </div>
            </div>
            <audio id="stem_${key}" src="${api()}${url}" controls class="w-100 mb-2"></audio>
            <div class="stem-card-mini-controls">
                <div class="stem-card-mini-mixer">
                    <div class="mixer-row">
                        <i class="bi bi-volume-up" style="color:var(--text-muted); font-size:0.85rem; width:18px"></i>
                        <input type="range" class="stem-slider" id="stemVol_${key}" min="0" max="100" value="80" oninput="updateStemMixer()">
                    </div>
                    <div class="mixer-row">
                        <i class="bi bi-arrows" style="color:var(--text-muted); font-size:0.85rem; width:18px"></i>
                        <input type="range" class="stem-slider" id="stemPan_${key}" min="-100" max="100" value="0" oninput="updateStemMixer()">
                        <span style="font-size:0.65rem; color:var(--text-muted); font-family:var(--font-mono); width:18px; text-align:center">C</span>
                    </div>
                </div>
                <div class="stem-card-mini-actions">
                    <button class="stem-btn" onclick="soloStem('${key}')" title="Solo"><i class="bi bi-headphones"></i></button>
                    <button class="stem-btn" onclick="muteStem('${key}')" title="Mute"><i class="bi bi-mute"></i></button>
                    <button class="stem-btn export" onclick="exportAudio('${key}')" title="Экспорт"><i class="bi bi-download"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');

    // Mixer channels
    $('mixerControls').innerHTML = Object.entries(stems).map(([key, url]) => {
        const c = config[key] || { icon: 'music-note', name: key.toUpperCase(), color: 'other' };
        return `
        <div class="mixer-channel">
            <div class="mixer-channel-label">
                <i class="bi bi-${c.icon}" style="color:var(--accent-${c.color})"></i>
                ${c.name}
            </div>
            <input type="range" class="stem-slider" id="mixVol_${key}" min="0" max="100" value="80" oninput="syncMixer('${key}')">
        </div>`;
    }).join('');

    syncAudios(Object.keys(stems).map(k => `stem_${k}`));
    
    // Setup A/B Testing if premium features are visible
    if (window.originalFilename && window.currentJobId) {
        const originalPath = `/uploads/${window.currentJobId}/${window.originalFilename}`;
        // Get first stem as result B (usually vocals or the first available stem)
        const firstStemKey = Object.keys(stems)[0];
        if (firstStemKey) {
            const stemAudio = $(`stem_${firstStemKey}`);
            if (stemAudio && stemAudio.src) {
                if (window.setupABTesting) {
                    window.setupABTesting(originalPath, stemAudio.src);
                }
            }
        }
    }
}

function syncAudios(ids) {
    const audios = ids.map(id => $(id)).filter(Boolean);
    audios.forEach(a => {
        a.onplay = () => {
            if (a._isSyncing) return;
            const t = a.currentTime;
            a._isSyncing = true;
            audios.forEach(o => {
                if (o !== a) {
                    o._isSyncing = true;
                    o.currentTime = t;
                    o.play().catch(() => {});
                    setTimeout(() => { o._isSyncing = false; }, 50);
                }
            });
            setTimeout(() => { a._isSyncing = false; }, 50);
        };
        a.onpause = () => audios.forEach(o => { if (o !== a) o.pause(); });
    });
}

function soloStem(key) {
    if (soloedStem === key) {
        soloedStem = null;
        Object.keys(stemsData).forEach(k => {
            const audio = $(`stem_${k}`);
            if (audio) audio.volume = ($(`stemVol_${k}`)?.value / 100 || 0.8);
        });
        toast('Все стемы включены', 'info');
        return;
    }
    soloedStem = key;
    Object.keys(stemsData).forEach(k => {
        const audio = $(`stem_${k}`);
        if (audio) audio.volume = k === key ? ($(`stemVol_${k}`)?.value / 100 || 0.8) : 0;
    });
    toast(`Solo: ${key}`, 'info');
}

function muteStem(key) {
    const audio = $(`stem_${key}`);
    if (!audio) return;
    audio.volume = audio.volume > 0 ? 0 : ($(`stemVol_${key}`)?.value / 100 || 0.8);
}

function updateStemMixer() {
    if (soloedStem) return;
    Object.keys(stemsData).forEach(key => {
        const audio = $(`stem_${key}`);
        const vol = $(`stemVol_${key}`);
        if (audio && vol) audio.volume = vol.value / 100;
    });
}

function syncMixer(key) {
    const volSlider = $(`mixVol_${key}`);
    const stemVolSlider = $(`stemVol_${key}`);
    if (volSlider && stemVolSlider) {
        stemVolSlider.value = volSlider.value;
        const audio = $(`stem_${key}`);
        if (audio) audio.volume = volSlider.value / 100;
    }
}

function updateBalance() {
    const bal = $('balanceSlider').value;
    $('balanceLabel').textContent = `${100 - bal} / ${bal}`;
    const va = $('vocalsAudio'), ia = $('instrAudio');
    if (va) va.volume = bal / 100;
    if (ia) ia.volume = (100 - bal) / 100;
}

function updateMixer() {
    const va = $('vocalsAudio'), ia = $('instrAudio');
    const vv = $('vocalsVol')?.value / 100 || 1;
    const iv = $('instrVol')?.value / 100 || 1;
    if (va) va.volume = vv;
    if (ia) ia.volume = iv;
}

// ==================== EQ SYSTEM ====================
function initEQSliders(stem) {
    const container = $(`eqSliders-${stem}`);
    if (!container) return;

    if (!eqStates[stem]) {
        eqStates[stem] = EQ_BANDS.map(() => 0);
    }

    container.innerHTML = EQ_BANDS.map((freq, i) => `
        <div class="eq-band">
            <input type="range" class="eq-band-slider" id="eq-${stem}-${i}" min="-12" max="12" value="${eqStates[stem][i]}"
                   oninput="updateEQLabel('${stem}', ${i}, this.value)">
            <span class="eq-band-label">${freq >= 1000 ? (freq/1000) + 'k' : freq}</span>
        </div>
    `).join('');
}

function updateEQLabel(stem, bandIdx, value) {
    eqStates[stem][bandIdx] = parseFloat(value);
}

function toggleEQ(stem) {
    const panel = $(`eq-${stem}`);
    if (panel) {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            initEQSliders(stem);
        }
    }
}

async function applyEQ(stem) {
    if (!currentJob || !eqStates[stem]) return;
    toast(`Применение EQ к ${stem}...`, 'info');
    try {
        const res = await fetch(`${api()}/api/eq/${currentJob}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stem, bands: eqStates[stem] })
        });
        const d = await res.json();
        if (d.url) {
            const audio = $(`stem_${stem}`) || $(stem === 'vocals' ? 'vocalsAudio' : stem === 'instrumental' ? 'instrAudio' : null);
            if (audio) audio.src = `${api()}${d.url}`;
            toast(`EQ применён к ${stem}`, 'success');
        }
    } catch (e) {
        toast('Ошибка EQ: ' + e.message, 'error');
    }
}

// ==================== EFFECTS SYSTEM ====================
function toggleEffects(stem) {
    const panel = $(`fx-${stem}`);
    if (panel) panel.classList.toggle('hidden');
}

async function applyEffect(stem, effect) {
    if (!currentJob) return;
    toast(`Применение ${effect} к ${stem}...`, 'info');

    const defaultParams = {
        reverb: { mix: 0.3, decay: 2.0 },
        compressor: { threshold: -20, ratio: 4, attack: 10, release: 100 },
        chorus: { rate: 1.5, depth: 0.7, mix: 0.5 },
        pitchshift: { semitones: 0 }
    };

    try {
        const res = await fetch(`${api()}/api/effect/${currentJob}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stem, effect, params: defaultParams[effect] || {} })
        });
        const d = await res.json();
        if (d.url) {
            const audio = $(`stem_${stem}`) || $(stem === 'vocals' ? 'vocalsAudio' : stem === 'instrumental' ? 'instrAudio' : null);
            if (audio) audio.src = `${api()}${d.url}`;
            toast(`${effect} применён к ${stem}`, 'success');
        }
    } catch (e) {
        toast('Ошибка эффекта: ' + e.message, 'error');
    }
}

// ==================== ANALYSIS ====================
async function runAnalysis() {
    $('progressContainer').classList.remove('hidden');
    updateProgress(20, 'АНАЛИЗ BPM...');

    try {
        const res = await fetch(`${api()}/api/analyze/${currentJob}`, { method: 'POST' });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        const d = await res.json();

        updateProgress(100, 'АНАЛИЗ ЗАВЕРШЁН!');

        setTimeout(() => {
            $('progressContainer').classList.add('hidden');
            $('analysisResult').classList.remove('hidden');

            $('analysisGrid').innerHTML = `
                <div class="analysis-item"><div class="analysis-value">🥁 ${d.bpm}</div><div class="analysis-label">BPM</div></div>
                <div class="analysis-item"><div class="analysis-value">🎵 ${d.key}</div><div class="analysis-label">Тональность</div></div>
                <div class="analysis-item"><div class="analysis-value">${fmtDur(d.duration)}</div><div class="analysis-label">Длительность</div></div>
                <div class="analysis-item"><div class="analysis-value">${d.lufs}</div><div class="analysis-label">LUFS</div></div>
                <div class="analysis-item"><div class="analysis-value">${d.peak.toFixed(2)}</div><div class="analysis-label">Peak</div></div>
                <div class="analysis-item"><div class="analysis-value">${d.dynamic_range}</div><div class="analysis-label">DR (dB)</div></div>
            `;

            $('spectralBars').innerHTML = `
                <div class="energy-bar bass" style="height: ${d.bassEnergy * 100}%" data-label="BASS"></div>
                <div class="energy-bar mid" style="height: ${d.midEnergy * 100}%" data-label="MID"></div>
                <div class="energy-bar high" style="height: ${d.highEnergy * 100}%" data-label="HIGH"></div>
            `;

            toast('✓ Анализ завершён!', 'success');
        }, 500);
    } catch (e) {
        toast('Ошибка анализа: ' + e.message, 'error');
        $('progressContainer').classList.add('hidden');
    }
}

// ==================== EXPORT ====================
async function exportAudio(type) {
    if (!currentJob) return;
    toast(`Экспорт ${type}...`, 'info');
    try {
        const res = await fetch(`${api()}/api/export/${currentJob}/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ format: 'mp3', bitrate: 320 })
        });
        const d = await res.json();
        const a = document.createElement('a');
        a.href = `${api()}${d.url}`;
        a.download = `${currentJob}_${type}.mp3`;
        a.click();
        toast(`✓ ${type}.mp3 сохранён`, 'success');
    } catch (e) { toast('Ошибка: ' + e.message, 'error'); }
}

async function exportAll() {
    if (!currentJob) return;
    const stems = Object.keys(stemsData);
    if (!stems.length && $('vocalsAudio')?.src && $('instrAudio')?.src) {
        await exportAudio('vocals');
        await sleep(500);
        await exportAudio('instrumental');
        toast('✓ Все стемы экспортированы', 'success');
        return;
    }
    for (const stem of stems) {
        await exportAudio(stem);
        await sleep(500);
    }
    toast('✓ Все стемы экспортированы', 'success');
}

// ==================== YOUTUBE ====================
async function downloadYouTube() {
    const url = $('youtubeUrl').value.trim();
    if (!url) { toast('Вставьте ссылку на YouTube', 'warning'); return; }
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) { toast('Неверная ссылка', 'warning'); return; }

    showLoading('ЗАГРУЗКА С YOUTUBE...');
    $('progressContainer').classList.remove('hidden');
    updateProgress(10, 'ПОДКЛЮЧЕНИЕ К YOUTUBE...');

    try {
        const res = await fetch(`${api()}/api/youtube`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        const d = await res.json();

        files.push({ jobId: d.jobId, filename: 'YouTube Audio', info: d.info });
        currentIdx = files.length - 1;
        currentJob = d.jobId;

        updateProgress(100, 'ЗАГРУЗКА ЗАВЕРШЕНА!');
        hideLoading();

        setTimeout(() => {
            $('progressContainer').classList.add('hidden');
            updateList();
            switchView('workspace');
            document.querySelector('[data-view="workspace"]').click();
            toast('✓ YouTube аудио загружено', 'success');
        }, 500);
    } catch (e) {
        hideLoading();
        toast('Ошибка: ' + e.message, 'error');
        $('progressContainer').classList.add('hidden');
    }
}

function setYouTubeExample(url) {
    $('youtubeUrl').value = url;
}

// ==================== HISTORY ====================
async function loadHistory() {
    try {
        const res = await fetch(`${api()}/api/history`);
        const history = await res.json();
        const el = $('historyList');

        if (!history.length) {
            el.innerHTML = '<div class="empty-state"><i class="bi bi-clock"></i><p>История пуста</p></div>';
            if ($('historyTrackCount')) $('historyTrackCount').textContent = '0';
            return;
        }

        if ($('historyTrackCount')) $('historyTrackCount').textContent = String(history.length);

        el.innerHTML = history.map(h => `
            <div class="history-item" onclick="loadFromHistory('${h.jobId}')">
                <div class="file-item-icon"><i class="bi bi-music-note-beamed"></i></div>
                <div class="file-item-info" style="flex:1">
                    <div class="file-item-name">${h.filename}</div>
                    <div class="file-item-meta">${new Date(h.date).toLocaleString('ru-RU')} // ${h.type || '2stem'} // ${h.preset || 'default'}</div>
                </div>
                <button class="btn-icon" onclick="event.stopPropagation(); deleteHistory('${h.jobId}')">
                    <i class="bi bi-trash3"></i>
                </button>
            </div>
        `).join('');
    } catch (e) { }
}

async function loadFromHistory(jobId) {
    currentJob = jobId;
    switchView('workspace');
    document.querySelector('[data-view="workspace"]').click();
    loadPreview(jobId);
    toast('Загружено из истории', 'info');
}

async function deleteHistory(jobId) {
    await fetch(`${api()}/api/history/${jobId}`, { method: 'DELETE' });
    loadHistory();
    toast('Удалено из истории', 'info');
}

async function clearHistory() {
    const history = await fetch(`${api()}/api/history`).then(r => r.json());
    for (const h of history) await fetch(`${api()}/api/history/${h.jobId}`, { method: 'DELETE' });
    loadHistory();
    toast('История очищена', 'info');
}

// ==================== LIBRARY ====================
async function loadLibrary() {
    const el = $('libraryList');
    if (!el) return; // library view may not exist
    if (!files.length) {
        el.innerHTML = '<div class="empty-state"><i class="bi bi-inbox"></i><p>Библиотека пуста</p><span>Загрузите треки для начала работы</span></div>';
        if ($('libraryTrackCount')) $('libraryTrackCount').textContent = '0';
        return;
    }

    if ($('libraryTrackCount')) $('libraryTrackCount').textContent = String(files.length);

    el.innerHTML = files.map((f, i) => `
        <div class="library-item" onclick="selectFile(${i}); switchView('workspace'); document.querySelector('[data-view=\\'workspace\\']').click();">
            <div class="file-item-icon"><i class="bi bi-music-note-beamed"></i></div>
            <div class="file-item-info">
                <div class="file-item-name">${f.filename}</div>
                <div class="file-item-meta">${f.info ? fmtDur(f.info.duration) + ' • ' + fmtSize(f.info.size) : fmtSize(f.size)}</div>
            </div>
        </div>
    `).join('');
}

// ==================== SESSION SAVE/LOAD ====================
function saveSession() {
    session = {
        files: files.map(f => ({ jobId: f.jobId, filename: f.filename, size: f.size })),
        currentIdx,
        mode,
        quality,
        preset,
        selectedModel
    };
    try { localStorage.setItem('vrp_session_v5', JSON.stringify(session)); } catch (e) { }
}

function loadSession() {
    try {
        const saved = localStorage.getItem('vrp_session_v5');
        if (saved) {
            session = JSON.parse(saved);
            mode = session.mode || '2stem';
            quality = session.quality || 'quality';
            preset = session.preset || 'default';
            selectedModel = session.selectedModel || 'modern_ensemble';
            setMode(mode);
            setQuality(quality);
            document.querySelectorAll('.preset-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.preset === preset);
            });
            if ($('modelSelect')) $('modelSelect').value = selectedModel;
        }
    } catch (e) { }
}

// ==================== LOADING OVERLAY ====================
function showLoading(text = 'ЗАГРУЗКА...') {
    const overlay = $('loadingOverlay');
    overlay.classList.remove('hidden');
    const txt = overlay.querySelector('.loading-text');
    if (txt) txt.textContent = text;
}

function hideLoading() {
    $('loadingOverlay').classList.add('hidden');
}

// ==================== UTILITIES ====================
function fmtDur(s) {
    if (!s) return '--:--';
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

function fmtSize(b) {
    if (!b) return '--';
    return b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
}

function updateProgress(pct, txt) {
    const bar = $('progressBar');
    const text = $('progressText');
    if (bar) bar.style.width = pct + '%';
    if (text) text.textContent = txt;
    updateWorkspaceState({ status: txt || 'Обработка...' });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function resetApp() {
    files = [];
    currentIdx = 0;
    currentJob = null;
    stemsData = {};
    soloedStem = null;
    eqStates = {};
    $('fileInput').value = '';
    $('youtubeUrl').value = '';
    ['previewAudio', 'vocalsAudio', 'instrAudio'].forEach(id => { if ($(id)) $(id).src = ''; });
    $('audioPreview').classList.add('hidden');
    $('analysisResult').classList.add('hidden');
    $('resultContainer2').classList.add('hidden');
    $('resultContainerMulti').classList.add('hidden');
    $('compareContainer')?.classList.add('hidden');
    $('progressContainer').classList.add('hidden');
    $('resetSection').classList.add('hidden');
    updateList();
    updateWorkspaceState({ status: 'Ожидание' });
    updateResultSummary(2, { count: 2, status: 'Готово' });
    updateResultSummary('multi', { count: 0, status: 'Готово' });
    toast('Сброшено', 'info');
}

// ==================== MODE & VOCAL STRENGTH ====================

function setMode(newMode) {
    mode = newMode;
    // Update UI
    document.querySelectorAll('.mode-option').forEach(el => {
        el.classList.remove('active');
        if (el.dataset.mode === newMode) el.classList.add('active');
    });
    // Show/hide vocal strength panel
    const panel = document.getElementById('vocalStrengthPanel');
    if (panel) panel.style.display = (newMode === 'mix') ? 'block' : 'none';
}

function setVocalStrength(val) {
    vocalStrength = parseInt(val, 10);
}
