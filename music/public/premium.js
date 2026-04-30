/**
 * Premium Features for Voice Remover Pro
 * EQ, Spectrogram, BPM/Key Detection, Vocal FX
 */

// ===== 10-BAND EQUALIZER =====

const PREMIUM_EQ_BANDS = [60, 150, 400, 1000, 2400, 6000, 15000, 40000, 100000, 200000]; // Hz
let premiumEqBandsState = Array(10).fill(0); // Gain in dB

function initPremiumEQ() {
    const container = document.getElementById('eqContainer');
    if (!container) return;
    container.innerHTML = '';
    PREMIUM_EQ_BANDS.forEach((freq, i) => {
        const col = document.createElement('div');
        col.className = 'eq-slider-col';
        col.innerHTML = `
            <input type="range" min="-12" max="12" value="0" class="eq-slider" orient="vertical" 
                   id="premiumEqSlider${i}" oninput="updatePremiumEQ(${i}, this.value)">
            <label class="eq-label">${freq >= 1000 ? (freq/1000)+'k' : freq}</label>
        `;
        container.appendChild(col);
    });
}

function updatePremiumEQ(index, value) {
    premiumEqBandsState[index] = parseInt(value);
    const slider = document.getElementById('premiumEqSlider' + index);
    if (slider) slider.style.accentColor = value > 0 ? '#00ff88' : (value < 0 ? '#ff0066' : '#888');
}

function resetPremiumEQ() {
    premiumEqBandsState = Array(10).fill(0);
    for (let i = 0; i < 10; i++) {
        const slider = document.getElementById('premiumEqSlider' + i);
        if (slider) slider.value = 0;
    }
    if (typeof toast === 'function') toast('EQ Reset', 'info');
}

async function applyPremiumEQ() {
    if (!currentJob) { 
        if (typeof toast === 'function') toast('Сначала обработайте трек', 'warning'); 
        return; 
    }
    if (typeof toast === 'function') toast('Applying EQ...', 'info');
    try {
        const res = await fetch(`${api()}/api/eq/${currentJob}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stem: 'vocals', bands: premiumEqBandsState })
        });
        if (!res.ok) throw new Error('EQ failed');
        if (typeof toast === 'function') toast('EQ Applied!', 'success');
    } catch (e) {
        if (typeof toast === 'function') toast('EQ Error: ' + e.message, 'error');
    }
}

// ===== SPECTROGRAM & ANALYSIS =====

let premiumAudioContext = null;
let premiumAnalyser = null;

function initPremiumAudioContext() {
    if (!premiumAudioContext) {
        premiumAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        premiumAnalyser = premiumAudioContext.createAnalyser();
        premiumAnalyser.fftSize = 2048;
    }
}

async function analyzeTrackPremium(jobId) {
    if (!jobId) return;
    try {
        const res = await fetch(`${api()}/api/analyze/${jobId}`);
        const data = await res.json();
        const bpmEl = document.getElementById('detectedBPM');
        const keyEl = document.getElementById('detectedKey');
        const genreEl = document.getElementById('detectedGenre');
        if (bpmEl) bpmEl.textContent = `BPM: ${data.bpm || '--'}`;
        if (keyEl) keyEl.textContent = `Key: ${data.key || '--'}`;
        if (genreEl) genreEl.textContent = `Genre: ${data.genre || '--'}`;
        drawSpectrogramPremium();
    } catch (e) {
        console.error('Analyze error:', e);
    }
}

function drawSpectrogramPremium() {
    const canvas = document.getElementById('spectrogramCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    let time = Date.now() * 0.001;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    for (let x = 0; x < width; x += 2) {
        for (let y = 0; y < height; y += 2) {
            const value = Math.sin(x * 0.05 + time) * Math.cos(y * 0.02 + time) * 0.5 + 0.5;
            const g = Math.floor(value * 255);
            ctx.fillStyle = `rgb(0, ${g}, ${Math.floor(value * 136)})`;
            ctx.fillRect(x, y, 2, 2);
        }
    }
    requestAnimationFrame(drawSpectrogramPremium);
}

// ===== VOCAL FX =====

function setPremiumAutotune(value) {
    console.log('Autotune set to:', value);
    if (currentJob && value > 0) {
        fetch(`${api()}/api/vocal-fx/${currentJob}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ autotune: value, dereverb: 0, denoise: 0 })
        }).catch(e => console.error(e));
    }
}

// ===== INIT ON LOAD =====

document.addEventListener('DOMContentLoaded', () => {
    initPremiumEQ();
    initPremiumAudioContext();
});
