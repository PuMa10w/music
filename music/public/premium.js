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
});

// ===== EQ FUNCTIONS =====
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

// ===== DENOISE FUNCTIONS =====
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
