/**
 * premium.js - Advanced features for Voice Remover
 * Contains: Denoise, EQ, Spectrogram
 */

// ===== CONFIGURATION =====
const EQ_BANDS = [
    { freq: 32, label: '32Hz' },
    { freq: 64, label: '64Hz' },
    { freq: 125, label: '125Hz' },
    { freq: 250, label: '250Hz' },
    { freq: 500, label: '500Hz' },
    { freq: 1000, label: '1kHz' },
    { freq: 2000, label: '2kHz' },
    { freq: 4000, label: '4kHz' },
    { freq: 8000, label: '8kHz' },
    { freq: 16000, label: '16kHz' }
];

let denoiseStrength = 0.5;
let eqValues = {};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Premium] Features loaded');
    initEQSliders();
    // Check if job already loaded (e.g. page refresh)
    if (window.currentJobId) showPremiumFeatures();
});

function showPremiumFeatures() {
    ['eqSection', 'denoiseSection', 'vocalFxSection', 'spectrogramSection', 'trackInfoSection'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
    });
}

// Make it global for ws-progress.js to call
window.showPremiumFeatures = showPremiumFeatures;

// ===== ANALYZE TRACK =====
function analyzeTrack(jobId) {
    if (!jobId) {
        alert('Сначала загрузи трек!');
        return;
    }

    const btn = event.target.closest('button');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-gear-fill spin"></i> Анализ...';
    }

    fetch(`/api/analyze/${jobId}`)
    .then(res => res.json())
    .then(data => {
        const bpmBadge = document.getElementById('bpmBadge');
        const keyBadge = document.getElementById('keyBadge');
        
        if (data.bpm) {
            bpmBadge.innerText = `BPM: ${data.bpm}`;
            bpmBadge.style.display = 'inline-block';
        }
        if (data.key) {
            keyBadge.innerText = `Key: ${data.key}`;
            keyBadge.style.display = 'inline-block';
        }
        if (!data.bpm && !data.key) {
            alert('Не удалось проанализировать трек');
        }
    })
    .catch(err => {
        console.error('[Analyze] Error:', err);
        alert('Ошибка анализа');
    })
    .finally(() => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Анализировать';
        }
    });
}

// ===== ROCK MODE =====
function enableRockMode() {
    if (!window.currentJobId) {
        alert('Сначала загрузи трек!');
        return;
    }
    // Set model to htdemucs_ft (fine-tuned for rock)
    const modelSelect = document.getElementById('modelSelect');
    if (modelSelect) {
        // Find option with htdemucs_ft or similar
        for (let i = 0; i < modelSelect.options.length; i++) {
            if (modelSelect.options[i].value.includes('htdemucs_ft') || modelSelect.options[i].value.includes('rock')) {
                modelSelect.selectedIndex = i;
                if (typeof setModel === 'function') setModel(modelSelect.options[i].value);
                break;
            }
        }
        // If not found, default to first model
        if (modelSelect.selectedIndex === -1) modelSelect.selectedIndex = 0;
    }
    // Set mode to vocals_only for rock vocals
    if (typeof setMode === 'function') setMode('vocals_only');
    alert('ROCK MODE ACTIVATED! Model switched to fine-tuned, mode: Vocals Only');
}

// ===== VOCAL FX FUNCTIONS =====
function applyVocalFX(jobId, stem, effect) {
    if (!jobId) {
        alert('Сначала загрузи и обработай трек!');
        return;
    }

    const btn = event.target.closest('button');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-gear-fill spin"></i> Обработка...';
    }

    fetch(`/api/effect/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            stem: stem,
            effect: effect,
            params: {}
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.url) {
            alert(`Эффект ${effect} применён!`);
            const resultDiv = document.getElementById('vocalFxResult') || document.createElement('div');
            resultDiv.id = 'vocalFxResult';
            document.getElementById('vocalFxSection').appendChild(resultDiv);
            resultDiv.innerHTML = `<a href="${data.url}" download class="btn btn-success btn-sm mt-2">Скачать ${effect}</a>`;
        } else {
            alert('Ошибка: ' + (data.error || 'Unknown'));
        }
    })
    .catch(err => {
        console.error('[VocalFX] Error:', err);
        alert('Ошибка сети при применении эффекта');
    })
    .finally(() => {
        if (btn) {
            btn.disabled = false;
            const icons = { 'autotune': 'bi-soundwave', 'dereverb': 'bi-easel2', 'reverb': 'bi-easel2' };
            btn.innerHTML = `<i class="bi ${icons[effect] || 'bi-gear'}"></i> ${effect.charAt(0).toUpperCase() + effect.slice(1)}`;
        }
    });
}

// ===== DENOISE FUNCTIONS =====
function initEQSliders() {
    const container = document.getElementById('eqSliders');
    if (!container) return;

    container.innerHTML = '';
    EQ_BANDS.forEach(band => {
        // Default gain 1.0 (0 dB)
        eqValues[band.freq] = 1.0;

        const sliderWrapper = document.createElement('div');
        sliderWrapper.className = 'eq-slider-wrapper text-center';
        sliderWrapper.innerHTML = `
            <label class="text-muted small">${band.label}</label>
            <input type="range" min="-12" max="12" value="0" step="0.5" 
                   class="form-range vertical-range" 
                   data-freq="${band.freq}"
                   oninput="updateEQValue(this)">
            <span id="eqVal_${band.freq}" class="badge bg-secondary small">0</span>
        `;
        container.appendChild(sliderWrapper);
    });
}

function updateEQValue(slider) {
    const freq = parseInt(slider.dataset.freq);
    const value = parseFloat(slider.value);
    eqValues[freq] = Math.pow(10, value / 20); // Convert dB to gain multiplier
    document.getElementById(`eqVal_${freq}`).innerText = value;
}

function resetEQ() {
    EQ_BANDS.forEach(band => {
        const slider = document.querySelector(`input[data-freq="${band.freq}"]`);
        if (slider) {
            slider.value = 0;
            updateEQValue(slider);
        }
    });
}

function applyEQ(jobId) {
    if (!jobId) {
        alert('Сначала загрузи и обработай трек!');
        return;
    }

    // Convert our eqValues to the format expected by server (if it uses gain values)
    // Assuming server expects gains in dB or linear? Let's send linear as 'params'
    const params = {};
    EQ_BANDS.forEach(band => {
        params[`gain_${band.freq}`] = eqValues[band.freq];
    });

    fetch(`/api/eq/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            stem: 'vocals', // Default to vocals
            params: params
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert('EQ применён!');
        } else {
            alert('Ошибка EQ: ' + (data.error || 'Unknown'));
        }
    })
    .catch(err => {
        console.error('[EQ] Error:', err);
        alert('Ошибка сети при применении EQ');
    });
}

// ===== SPECTROGRAM FUNCTIONS =====
let audioContext = null;
let analyser = null;
let spectrogramRunning = false;

function drawSpectrogram() {
    const canvas = document.getElementById('spectrogramCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const jobId = window.currentJobId; // Try to get from global scope

    if (!jobId) {
        // Draw placeholder if no track loaded
        ctx.fillStyle = '#121212';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Загрузи трек и нажми "Обработать" или "Play"', canvas.width/2, canvas.height/2);
        return;
    }

    // If there's an audio element playing, try to hook into it
    const audioEl = document.querySelector(`audio[data-job="${jobId}"]`) || document.querySelector('audio');
    if (!audioEl) {
         ctx.fillStyle = '#121212'; ctx.fillRect(0,0,canvas.width,canvas.height);
         ctx.fillStyle = '#666'; ctx.font = '16px Arial'; ctx.textAlign = 'center';
         ctx.fillText('Сначала запусти проигрывание стема', canvas.width/2, canvas.height/2);
        return;
    }

    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        
        const source = audioContext.createMediaElementSource(audioEl);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
    }

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function renderFrame() {
        if (!spectrogramRunning) return;
        requestAnimationFrame(renderFrame);
        
        analyser.getByteFrequencyData(dataArray);
        
        ctx.fillStyle = 'rgba(18, 18, 18, 0.1)'; // Fade effect
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        for(let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2;
            
            // Color gradient: low freq = red, high freq = blue
            const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
            gradient.addColorStop(0, `rgb(${barHeight + 100}, 50, 255)`);
            gradient.addColorStop(1, `rgb(255, 50, ${barHeight + 100})`);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
        }
    }
    
    spectrogramRunning = true;
    renderFrame();
}
function applyDenoise(jobId, stem = 'vocals') {
    if (!jobId) {
        alert('Сначала загрузи и обработай трек!');
        return;
    }

    const btn = document.getElementById('denoiseBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-gear-fill spin"></i> Обработка...';
    }

    fetch(`/api/denoise/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            strength: denoiseStrength,
            stem: stem
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(`Шумоподавление готово! Файл: ${data.file}`);
            const resultDiv = document.getElementById('denoiseResult');
            if (resultDiv) {
                resultDiv.innerHTML = `<a href="/uploads/${jobId}/${data.file}" download class="btn btn-success btn-sm">Скачать очищенный (${stem})</a>`;
            }
        } else {
            alert('Ошибка: ' + (data.error || 'Unknown'));
        }
    })
    .catch(err => {
        console.error('[Denoise] Error:', err);
        alert('Ошибка сети при денойзе');
    })
    .finally(() => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-play-fill"></i> Применить к вокалу';
        }
    });
}
