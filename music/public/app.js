     1|     1|/**
     2|     2| * Voice Remover Pro v5.0 — Ultimate Stem Separation
     3|     3| * Main Application JavaScript
     4|     4| */
     5|     5|
     6|     6|// ==================== UTILITY FUNCTIONS ====================
     7|     7|
     8|     8|/**
     9|     9| * Escape HTML special characters to prevent XSS
    10|    10| * @param {string} unsafe - string to escape
    11|    11| * @returns {string} escaped string
    12|    12| */
    13|    13|function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe.replace(/[&<>"']/g, m => {
        switch (m) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return m;
        }
    });
}[m]));
    22|    22|}
    23|    23|
    24|// ==================== API BASE URL (RELATIVE PATHS) ====================
    25|let _apiBase = ''; // always use relative paths
    26|
    27|async function getAPI() {
    28|    return _apiBase;
    29|}
    30|
    31|// Synchronous getter (cached value)
    32|function api() {
    33|    return _apiBase;
    34|}
    35|    47|
    36|    48|// ==================== STATE ====================
    37|    49|
    38|    50|// WebSocket progress connection
    39|    51|let wsProgress = null;
    40|    52|let wsCurrentJobId = null;
    41|    53|
    42|    54|/**
    43|    55| * Инициализация WebSocket для прогресса
    44|    56| */
    45|    57|function initWebSocketProgress() {
    46|    58|    if (wsProgress) return; // Уже инициализировано
    47|    59|    
    48|    60|    try {
    49|    61|        wsProgress = createProgressWebSocket();
    50|    62|        
    51|    63|        // Слушаем прогресс
    52|    64|        wsProgress.on('progress', (data) => {
    53|    65|            console.log('[WS] Progress:', data.percent, data.message);
    54|    66|            updateProgress(data.percent || 0, data.message || 'Обработка...');
    55|    67|        });
    56|    68|
    57|    69|        wsProgress.on('complete', (data) => {
    58|    70|            console.log('[WS] Complete:', data);
    59|    71|            updateProgress(100, data.message || 'Готово!');
    60|    72|            hideLoading();
    61|    73|            toast('✓ Обработка завершена!', 'success');
    62|    74|        });
    63|    75|
    64|    76|        wsProgress.on('error', (data) => {
    65|    77|            console.error('[WS] Error:', data);
    66|    78|            hideLoading();
    67|    79|            $('progressContainer').classList.add('hidden');
    68|    80|            toast('Ошибка: ' + (data.message || 'Неизвестная ошибка'), 'error');
    69|    81|        });
    70|    82|
    71|    83|        wsProgress.on('start', (data) => {
    72|    84|            console.log('[WS] Job started:', data);
    73|    85|            $('progressContainer').classList.remove('hidden');
    74|    86|            updateProgress(5, 'Запуск обработки...');
    75|    87|        });
    76|    88|
    77|    89|        console.log('[WS] Progress WebSocket initialized');
    78|    90|    } catch (e) {
    79|    91|        console.warn('[WS] Failed to initialize WebSocket:', e.message);
    80|    92|        // Fallback: без WebSocket прогресса
    81|    93|        wsProgress = null;
    82|    94|    }
    83|    95|}
    84|    96|let files = [];
    85|    97|let currentIdx = 0;
    86|    98|let currentJob = null;
    87|    99|let mode = '2stem';
    88|   100|let quality = 'quality';
    89|   101|let preset = 'default';
    90|   102|let selectedModel = 'modern_ensemble';
    91|   103|let modelRegistry = {};
    92|   104|let modelStatusRegistry = {};
    93|   105|let stemsData = {};
    94|   106|let session = {};
    95|   107|let soloedStem = null;
    96|   108|let stemStates = {};
    97|   109|let eqStates = {};
    98|   110|const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    99|   111|
   100|   112|// ==================== BATCH PROCESSING ====================
   101|   113|let batchQueue = [];          // очередь заданий
   102|   114|let batchProcessing = false;  // флаг обработки
   103|   115|let batchPaused = false;      // флаг паузы
   104|   116|let maxConcurrent = 2;        // макс одновременно
   105|   117|let activeJobs = new Set();   // активные задачи
   106|   118|
   107|   119|// Статусы файлов в очереди
   108|   120|const BATCH_STATUS = {
   109|   121|    PENDING: 'pending',     // ожидает
   110|   122|    PROCESSING: 'processing', // обрабатывается
   111|   123|    COMPLETED: 'completed', // завершён
   112|   124|    ERROR: 'error',         // ошибка
   113|   125|    CANCELLED: 'cancelled'  // отменён
   114|   126|};
   115|   127|
   116|   128|// ==================== DOM HELPERS ====================
   117|   129|const $ = id => document.getElementById(id);
   118|   130|
   119|   131|// ==================== INITIALIZATION ====================
   120|   132|document.addEventListener('DOMContentLoaded', () => {
   121|   133|    getAPI(); // probe API base URL
   122|   134|    initNavigation();
   123|   135|    initKeyboard();
   124|   136|    initDropZone();
   125|   137|    initPresets();
   126|   138|    loadSession();
   127|   139|    loadHistory();
   128|   140|    initMobileResponsive();
   129|   141|    loadModelRegistry();
   130|   142|    updateWorkspaceState();
   131|   143|});
   132|   144|
   133|   145|function updateWorkspaceState(state = {}) {
   134|   146|    const modeLabels = {
   135|   147|        '2stem': '2 STEMS',
   136|   148|        '4stem': '4 STEMS',
   137|   149|        '6stem': '6 STEMS'
   138|   150|    };
   139|   151|
   140|   152|    const activeFile = files[currentIdx];
   141|   153|    const statusText = state.status || (activeFile ? 'Файл готов' : 'Ожидание');
   142|   154|    const heroText = activeFile
   143|   155|        ? `Активный файл: ${activeFile.filename}. Выберите режим, настройте силу разделения и запустите обработку.`
   144|   156|        : 'Сейчас в сессии нет активного файла. Перетащите трек в левую панель или откройте YouTube-вкладку для импорта аудио.';
   145|   157|
   146|   158|    if ($('statusFileCount')) $('statusFileCount').textContent = String(files.length);
   147|   159|    if ($('statusMode')) $('statusMode').textContent = modeLabels[mode] || mode.toUpperCase();
   148|   160|    if ($('statusPreset')) $('statusPreset').textContent = (preset || 'default').toUpperCase();
   149|   161|    if ($('statusState')) $('statusState').textContent = statusText;
   150|   162|    if ($('heroStateText')) $('heroStateText').textContent = heroText;
   151|   163|    if ($('heroStateCard')) $('heroStateCard').classList.toggle('hidden', Boolean(activeFile));
   152|   164|
   153|   165|    if ($('resultSummary2Mode')) $('resultSummary2Mode').textContent = modeLabels[mode] || mode.toUpperCase();
   154|   166|    if ($('resultSummary2Preset')) $('resultSummary2Preset').textContent = (preset || 'default').toUpperCase();
   155|   167|    if ($('resultSummaryMultiMode')) $('resultSummaryMultiMode').textContent = modeLabels[mode] || mode.toUpperCase();
   156|   168|    if ($('resultSummaryMultiPreset')) $('resultSummaryMultiPreset').textContent = (preset || 'default').toUpperCase();
   157|   169|
   158|   170|    const activeModel = modelRegistry[selectedModel];
   159|   171|    const runtimeStatus = modelStatusRegistry[selectedModel];
   160|   172|    if ($('activeModelName')) $('activeModelName').textContent = activeModel?.name || 'Model not loaded';
   161|   173|    if ($('activeModelBadge')) $('activeModelBadge').textContent = activeModel?.badge || 'Unknown';
   162|   174|    if ($('activeModelDescription')) $('activeModelDescription').textContent = activeModel?.description || 'Список моделей ещё загружается.';
   163|   175|    if ($('activeModelFamily')) $('activeModelFamily').textContent = activeModel?.family || 'Unknown';
   164|   176|    if ($('activeModelBackend')) $('activeModelBackend').textContent = `backend: ${runtimeStatus?.backend || activeModel?.backend || 'unknown'}`;
   165|   177|    if ($('activeModelState')) $('activeModelState').textContent = runtimeStatus?.available === false ? 'limited' : 'ready';
   166|   178|}
   167|   179|
   168|   180|async function loadModelRegistry() {
   169|   181|    try {
   170|   182|        const [modelsRes, statusRes] = await Promise.all([
   171|   183|            fetch(`${api()}/api/models`),
   172|   184|            fetch(`${api()}/api/models/status`)
   173|   185|        ]);
   174|   186|
   175|   187|        modelRegistry = modelsRes.ok ? await modelsRes.json() : {};
   176|   188|        const statusJson = statusRes.ok ? await statusRes.json() : {};
   177|   189|        modelStatusRegistry = statusJson.models || {};
   178|   190|        populateModelSelect();
   179|   191|        updateWorkspaceState();
   180|   192|    } catch (e) {
   181|   193|        console.warn('Model registry load failed:', e.message);
   182|   194|    }
   183|   195|}
   184|   196|
   185|   197|function populateModelSelect() {
   186|   198|    const select = $('modelSelect');
   187|   199|    if (!select) return;
   188|   200|    const compareA = $('compareModelA');
   189|   201|    const compareB = $('compareModelB');
   190|   202|
   191|   203|    const preferredOrder = ['modern_ensemble', 'demucs', 'htdemucs_ft', 'mdxnet', 'bandit', 'melband', 'scnet', 'vrnet', 'openunmix', 'asteroid', 'spleeter', 'ensemble', 'uvr5_mdx', 'uvr5_vr', 'lalal', 'legacy'];
   192|   204|    const entries = preferredOrder.filter(key => modelRegistry[key]).map(key => [key, modelRegistry[key]]);
   193|   205|
   194|   206|    select.innerHTML = entries.map(([key, model]) => {
   195|   207|        const status = modelStatusRegistry[key];
   196|   208|        const suffix = status?.available === false ? ' • limited' : ' • local';
   197|   209|        return `<option value="${key}" ${key === selectedModel ? 'selected' : ''}>${model.name}${suffix}</option>`;
   198|   210|    }).join('');
   199|   211|
   200|   212|    if (!modelRegistry[selectedModel] && entries.length) {
   201|   213|        selectedModel = entries[0][0];
   202|   214|        select.value = selectedModel;
   203|   215|    }
   204|   216|
   205|   217|    const compareOptions = entries.map(([key, model]) => `<option value="${key}">${model.name}</option>`).join('');
   206|   218|    if (compareA) compareA.innerHTML = compareOptions;
   207|   219|    if (compareB) compareB.innerHTML = compareOptions;
   208|   220|    if (compareA && !compareA.value) compareA.value = 'modern_ensemble';
   209|   221|    if (compareB && !compareB.value) compareB.value = 'demucs';
   210|   222|}
   211|   223|
   212|   224|function updateResultSummary(type, details = {}) {
   213|   225|    const targets = {
   214|   226|        2: {
   215|   227|            mode: $('resultSummary2Mode'),
   216|   228|            preset: $('resultSummary2Preset'),
   217|   229|            count: $('resultSummary2Count'),
   218|   230|            status: $('resultSummary2Status')
   219|   231|        },
   220|   232|        multi: {
   221|   233|            mode: $('resultSummaryMultiMode'),
   222|   234|            preset: $('resultSummaryMultiPreset'),
   223|   235|            count: $('resultSummaryMultiCount'),
   224|   236|            status: $('resultSummaryMultiStatus')
   225|   237|        }
   226|   238|    };
   227|   239|
   228|   240|    const modeLabels = {
   229|   241|        '2stem': '2 STEMS',
   230|   242|        '4stem': '4 STEMS',
   231|   243|        '6stem': '6 STEMS'
   232|   244|    };
   233|   245|
   234|   246|    const bucket = targets[type];
   235|   247|    if (!bucket) return;
   236|   248|
   237|   249|    if (bucket.mode) bucket.mode.textContent = details.modeLabel || modeLabels[mode] || mode.toUpperCase();
   238|   250|    if (bucket.preset) bucket.preset.textContent = details.presetLabel || (preset || 'default').toUpperCase();
   239|   251|    if (bucket.count) bucket.count.textContent = String(details.count ?? 0);
   240|   252|    if (bucket.status) bucket.status.textContent = details.status || 'Готово';
   241|   253|
   242|   254|    if (type === 2 && $('resultBackendTrace')) {
   243|   255|        const backend = details.runtimeBackend || modelStatusRegistry[selectedModel]?.backend || modelRegistry[selectedModel]?.backend || 'unknown';
   244|   256|        const requested = details.modelRequested || selectedModel;
   245|   257|        const used = details.modelUsed || selectedModel;
   246|   258|        $('resultBackendTrace').textContent = `requested: ${requested} / used: ${used} / backend: ${backend}`;
   247|   259|    }
   248|   260|}
   249|   261|
   250|   262|// ==================== MOBILE RESPONSIVE ====================
   251|   263|function initMobileResponsive() {
   252|   264|    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
   253|   265|    const appNav = document.getElementById('appNav');
   254|   266|    
   255|   267|    // Show/hide hamburger menu based on screen width
   256|   268|    function updateMobileMenuVisibility() {
   257|   269|        if (window.innerWidth <= 768) {
   258|   270|            // Mobile: show hamburger, hide nav items
   259|   271|            if (mobileMenuBtn) mobileMenuBtn.classList.remove('hidden');
   260|   272|            if (appNav) appNav.style.display = 'none';
   261|   273|        } else {
   262|   274|            // Desktop: hide hamburger, show nav
   263|   275|            if (mobileMenuBtn) mobileMenuBtn.classList.add('hidden');
   264|   276|            if (appNav) appNav.style.display = 'flex';
   265|   277|        }
   266|   278|    }
   267|   279|    
   268|   280|    // Initial check
   269|   281|    updateMobileMenuVisibility();
   270|   282|    
   271|   283|    // Listen to window resize
   272|   284|    window.addEventListener('resize', updateMobileMenuVisibility);
   273|   285|    
   274|   286|    // Prevent body scroll when mobile menu is open
   275|   287|    const overlay = document.getElementById('mobileMenuOverlay');
   276|   288|    if (overlay) {
   277|   289|        overlay.addEventListener('click', toggleMobileMenu);
   278|   290|    }
   279|   291|}
   280|   292|
   281|   293|function toggleMobileMenu() {
   282|   294|    const overlay = document.getElementById('mobileMenuOverlay');
   283|   295|    const appNav = document.getElementById('appNav');
   284|   296|    
   285|   297|    if (!overlay || !appNav) return;
   286|   298|    
   287|   299|    const isHidden = overlay.classList.contains('hidden');
   288|   300|    
   289|   301|    if (isHidden) {
   290|   302|        // Open menu
   291|   303|        overlay.classList.remove('hidden');
   292|   304|        appNav.classList.remove('hidden');
   293|   305|        appNav.style.display = 'flex';
   294|   306|        appNav.style.position = 'fixed';
   295|   307|        appNav.style.top = '120px';
   296|   308|        appNav.style.left = '0';
   297|   309|        appNav.style.right = '0';
   298|   310|        appNav.style.zIndex = '1000';
   299|   311|        appNav.style.flexDirection = 'column';
   300|   312|        appNav.style.gap = '4px';
   301|   313|        appNav.style.margin = '0';
   302|   314|        appNav.style.padding = '8px';
   303|   315|        appNav.style.background = 'var(--bg-card)';
   304|   316|        appNav.style.borderBottom = '1px solid var(--border-subtle)';
   305|   317|        appNav.style.borderRadius = '0';
   306|   318|        document.body.style.overflow = 'hidden';
   307|   319|    } else {
   308|   320|        // Close menu
   309|   321|        overlay.classList.add('hidden');
   310|   322|        appNav.classList.add('hidden');
   311|   323|        appNav.style.position = 'relative';
   312|   324|        appNav.style.top = 'auto';
   313|   325|        appNav.style.left = 'auto';
   314|   326|        appNav.style.right = 'auto';
   315|   327|        appNav.style.zIndex = 'auto';
   316|   328|        appNav.style.flexDirection = 'row';
   317|   329|        appNav.style.margin = '0';
   318|   330|        appNav.style.padding = '10px';
   319|   331|        appNav.style.background = 'transparent';
   320|   332|        appNav.style.borderBottom = 'none';
   321|   333|        appNav.style.display = 'flex';
   322|   334|        document.body.style.overflow = 'auto';
   323|   335|    }
   324|   336|}
   325|   337|
   326|   338|
   327|   339|
   328|   340|// ==================== TOAST NOTIFICATIONS ====================
   329|   341|function toast(msg, type = 'info') {
   330|   342|    const icons = {
   331|   343|        success: 'check-circle-fill',
   332|   344|        error: 'exclamation-triangle-fill',
   333|   345|        warning: 'exclamation-circle-fill',
   334|   346|        info: 'info-circle-fill'
   335|   347|    };
   336|   348|    const t = document.createElement('div');
   337|   349|    t.className = `toast ${type}`;
   338|   350|    const icon = document.createElement('i');
   339|   351|    icon.className = `bi bi-${icons[type]}`;
   340|   352|    const span = document.createElement('span');
   341|   353|    span.textContent = msg; // XSS-safe
   342|   354|    t.appendChild(icon);
   343|   355|    t.appendChild(span);
   344|   356|    $('toastContainer').appendChild(t);
   345|   357|    setTimeout(() => {
   346|   358|        t.style.opacity = '0';
   347|   359|        t.style.transform = 'translateX(100%)';
   348|   360|        t.style.transition = 'all 0.3s ease';
   349|   361|        setTimeout(() => t.remove(), 300);
   350|   362|    }, 4000);
   351|   363|}
   352|   364|
   353|   365|// ==================== NAVIGATION ====================
   354|   366|function initNavigation() {
   355|   367|    document.querySelectorAll('.nav-btn').forEach(btn => {
   356|   368|        btn.onclick = () => {
   357|   369|            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
   358|   370|            btn.classList.add('active');
   359|   371|            switchView(btn.dataset.view);
   360|   372|            
   361|   373|            // Close mobile menu after navigation (mobile only)
   362|   374|            if (window.innerWidth <= 768) {
   363|   375|                setTimeout(() => {
   364|   376|                    const overlay = document.getElementById('mobileMenuOverlay');
   365|   377|                    if (overlay && !overlay.classList.contains('hidden')) {
   366|   378|                        toggleMobileMenu();
   367|   379|                    }
   368|   380|                }, 100);
   369|   381|            }
   370|   382|        };
   371|   383|    });
   372|   384|}
   373|   385|
   374|   386|function switchView(view) {
   375|   387|    const ws = $('workspaceView');
   376|   388|    const lib = $('libraryView');
   377|   389|    const yt = $('youtubeView');
   378|   390|    const hist = $('historyView');
   379|   391|    if (ws) ws.classList.toggle('hidden', view !== 'workspace');
   380|   392|    if (lib) lib.classList.toggle('hidden', view !== 'library');
   381|   393|    if (yt) yt.classList.toggle('hidden', view !== 'youtube');
   382|   394|    if (hist) hist.classList.toggle('hidden', view !== 'history');
   383|   395|    if (view === 'history') loadHistory();
   384|   396|    if (view === 'library' && lib) loadLibrary();
   385|   397|    updateWorkspaceState();
   386|   398|}
   387|   399|
   388|   400|// ==================== KEYBOARD SHORTCUTS ====================
   389|   401|function initKeyboard() {
   390|   402|    document.addEventListener('keydown', e => {
   391|   403|        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
   392|   404|        switch(e.key.toLowerCase()) {
   393|   405|            case ' ':
   394|   406|                e.preventDefault();
   395|   407|                togglePlayPause();
   396|   408|                break;
   397|   409|            case 's':
   398|   410|                if (!e.ctrlKey && !e.metaKey) processCurrent();
   399|   411|                break;
   400|   412|            case 'r':
   401|   413|                resetApp();
   402|   414|                break;
   403|   415|            case 'o':
   404|   416|                if (e.ctrlKey || e.metaKey) {
   405|   417|                    e.preventDefault();
   406|   418|                    $('fileInput').click();
   407|   419|                }
   408|   420|                break;
   409|   421|            case 'escape':
   410|   422|                resetApp();
   411|   423|                break;
   412|   424|        }
   413|   425|    });
   414|   426|}
   415|   427|
   416|   428|function togglePlayPause() {
   417|   429|    const audio = $('previewAudio');
   418|   430|    if (audio?.src) {
   419|   431|        audio.paused ? audio.play() : audio.pause();
   420|   432|        updatePlayBtn(!audio.paused);
   421|   433|    }
   422|   434|}
   423|   435|
   424|   436|function updatePlayBtn(playing) {
   425|   437|    const btn = $('playBtn');
   426|   438|    if (btn) {
   427|   439|        btn.innerHTML = playing ? '<i class="bi bi-pause-fill"></i>' : '<i class="bi bi-play-fill"></i>';
   428|   440|    }
   429|   441|}
   430|   442|
   431|   443|function skipAudio(seconds) {
   432|   444|    const audio = $('previewAudio');
   433|   445|    if (audio?.src) {
   434|   446|        audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
   435|   447|    }
   436|   448|}
   437|   449|
   438|   450|// ==================== DRAG & DROP ====================
   439|   451|function initDropZone() {
   440|   452|    const dz = $('dropZone');
   441|   453|    const fi = $('fileInput');
   442|   454|
   443|   455|    dz.onclick = () => fi.click();
   444|   456|
   445|   457|    dz.ondragover = e => {
   446|   458|        e.preventDefault();
   447|   459|        dz.classList.add('dragover');
   448|   460|    };
   449|   461|
   450|   462|    dz.ondragleave = () => dz.classList.remove('dragover');
   451|   463|
   452|   464|    dz.ondrop = e => {
   453|   465|        e.preventDefault();
   454|   466|        dz.classList.remove('dragover');
   455|   467|        if (e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]);
   456|   468|    };
   457|   469|
   458|   470|    fi.onchange = e => {
   459|   471|        if (e.target.files.length) handleFiles([...e.target.files]);
   460|   472|    };
   461|   473|}
   462|   474|
   463|   475|// ==================== FILE HANDLING ====================
   464|   476|async function handleFiles(fileArr) {
   465|   477|    for (const file of fileArr) {
   466|   478|        const ext = file.name.split('.').pop().toLowerCase();
   467|   479|        const allowed = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'mp4', 'aac', 'aiff', 'wma', 'opus'];
   468|   480|        if (!allowed.includes(ext)) {
   469|   481|            toast(`${file.name} — неподдерживаемый формат`, 'error');
   470|   482|            continue;
   471|   483|        }
   472|   484|
   473|   485|        const fd = new FormData();
   474|   486|        fd.append('audio', file);
   475|   487|
   476|   488|        try {
   477|   489|            showLoading('ЗАГРУЗКА ФАЙЛА...');
   478|   490|            const res = await fetch(`${api()}/api/upload`, { method: 'POST', body: fd });
   479|   491|            const data = await res.json();
   480|   492|            hideLoading();
   481|   493|            if (data.error) { toast(data.error, 'error'); continue; }
   482|   494|            files.push({ ...data, file });
   483|   495|            toast(`✓ ${file.name}`, 'success');
   484|   496|        } catch (e) {
   485|   497|            hideLoading();
   486|   498|            toast(`Ошибка загрузки: ${file.name}`, 'error');
   487|   499|        }
   488|   500|    }
   489|   501|