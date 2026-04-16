#!/usr/bin/env python3
"""
Р Р°Р·РґРµР»РµРЅРёРµ РЅР° СЃС‚РµРјС‹ СЃ РїРѕРґРґРµСЂР¶РєРѕР№ Р’РЎР•РҐ Р»СѓС‡С€РёС… ML-РјРѕРґРµР»РµР№.

Р”РѕСЃС‚СѓРїРЅС‹Рµ РјРѕРґРµР»Рё:
  - Локальные варианты Demucs: htdemucs, htdemucs_ft, htdemucs_6s, mdx
  - Локальные современные профили: modern_ensemble, mdxnet, bandit, melband, scnet
  - Локальные style-профили: vrnet, openunmix, asteroid, uvr5_mdx, uvr5_vr, lalal
  - Legacy: частотное разделение без ML

РўРёРїС‹ СЂР°Р·РґРµР»РµРЅРёСЏ:
  - 4stem: Vocals, Drums, Bass, Other
  - 6stem: Lead Vocals, Backing Vocals, Drums, Bass, Piano, Other

Usage:
    python stems.py input.wav output_dir [preset] [strength] [model] [type]
    
    model: demucs, spleeter, uvr5_mdx, uvr5_vr, ensemble
    type: 4stem, 6stem (default: 4stem)
"""

import numpy as np
import soundfile as sf
import sys
import json
import os
from scipy import signal
import torch

# Р”РѕР±Р°РІР»СЏРµРј UVR5 РІ path
UVR5_PATH = os.path.join(os.path.dirname(__file__), '..', 'UVR5')
if os.path.exists(UVR5_PATH):
    sys.path.insert(0, UVR5_PATH)
else:
    print("UVR5_PATH не найден: UVR5-профили будут использовать локальные профили без внешних зависимостей.", flush=True)

# ==========================================
# РљРѕРЅС„РёРіСѓСЂР°С†РёСЏ
# ==========================================

MODELS = {
    'demucs': {
        'name': 'Demucs v4 (htdemucs)',
        'description': 'Локальная Hybrid Transformer модель',
        'type': 'ml',
        'stems': ['drums', 'bass', 'other', 'vocals']
    },
    'spleeter': {
        'name': 'Fast Local 4-stem',
        'description': 'Локальный быстрый профиль без Spleeter и без API',
        'type': 'ml',
        'stems': ['vocals', 'drums', 'bass', 'other']
    },
    'uvr5_mdx': {
        'name': 'UVR5 MDX Local',
        'description': 'Локальный MDX-профиль без UVR5 и без API',
        'type': 'local-profile',
        'stems': ['drums', 'bass', 'other', 'vocals']
    },
    'uvr5_vr': {
        'name': 'UVR5 VR Local',
        'description': 'Локальный VR-профиль без UVR5 и без API',
        'type': 'local-profile',
        'stems': ['drums', 'bass', 'other', 'vocals']
    },
    'ensemble': {
        'name': 'Ensemble Local Blend',
        'description': 'Локальное усреднение нескольких Demucs-профилей',
        'type': 'ensemble',
        'stems': ['drums', 'bass', 'other', 'vocals']
    },
    'mdxnet': {
        'name': 'MDX-Net Local',
        'description': 'Локальный профиль Demucs MDX без внешних сервисов',
        'type': 'onnx',
        'stems': ['drums', 'bass', 'other', 'vocals']
    },
    'htdemucs_ft': {
        'name': 'HT Demucs FT',
        'description': 'Fine-tuned профиль Demucs',
        'type': 'ml',
        'stems': ['drums', 'bass', 'other', 'vocals']
    },
    'bandit': {
        'name': 'Bandit',
        'description': 'Современный research-профиль',
        'type': 'hybrid',
        'stems': ['drums', 'bass', 'other', 'vocals']
    },
    'melband': {
        'name': 'MelBand Roformer',
        'description': 'Roformer-стиль профиль',
        'type': 'hybrid',
        'stems': ['drums', 'bass', 'other', 'vocals']
    },
    'scnet': {
        'name': 'SCNet',
        'description': 'Compact spectral-conformer профиль',
        'type': 'hybrid',
        'stems': ['drums', 'bass', 'other', 'vocals']
    },
    'vrnet': {
        'name': 'VR Network Local',
        'description': 'Локальный VR-style профиль без внешних зависимостей',
        'type': 'local-profile',
        'stems': ['drums', 'bass', 'other', 'vocals']
    },
    'openunmix': {
        'name': 'Open-Unmix Local',
        'description': 'Локальный U-Net style профиль без внешних сервисов',
        'type': 'ml',
        'stems': ['drums', 'bass', 'other', 'vocals']
    },
    'asteroid': {
        'name': 'Asteroid Local',
        'description': 'Локальный ConvTasNet-style профиль без API',
        'type': 'ml',
        'stems': ['drums', 'bass', 'other', 'vocals']
    },
    'lalal': {
        'name': 'Lalal Local',
        'description': 'Локальный high-quality профиль без API ключей',
        'type': 'local-profile',
        'stems': ['drums', 'bass', 'other', 'vocals']
    },
    'modern_ensemble': {
        'name': 'Modern Ensemble',
        'description': 'Локальная комбинация доступных современных моделей',
        'type': 'ensemble',
        'stems': ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other']
    },
    'legacy': {
        'name': 'Legacy Filters',
        'description': 'Частотные фильтры (без ML)',
        'type': 'legacy',
        'stems': ['vocals', 'drums', 'bass', 'other']
    }
}

PRESETS = {
    'default': {'vocals': 1.0, 'drums': 1.0, 'bass': 1.0, 'other': 1.0},
    'pop': {'vocals': 1.2, 'drums': 0.9, 'bass': 1.1, 'other': 0.95},
    'rock': {'vocals': 0.9, 'drums': 1.2, 'bass': 1.0, 'other': 1.0},
    'rap': {'vocals': 1.3, 'drums': 1.1, 'bass': 1.2, 'other': 0.9},
    'jazz': {'vocals': 0.85, 'drums': 0.9, 'bass': 1.0, 'other': 1.2},
    'classic': {'vocals': 0.8, 'drums': 0.7, 'bass': 0.9, 'other': 1.1},
    'electronic': {'vocals': 1.0, 'drums': 1.3, 'bass': 1.2, 'other': 1.1},
    'acoustic': {'vocals': 1.1, 'drums': 0.8, 'bass': 0.9, 'other': 1.0}
}

# ==========================================
# РЈС‚РёР»РёС‚С‹
# ==========================================

def normalize_stem(data, target_peak=0.85):
    if hasattr(data, 'detach'):
        data = data.detach().cpu().numpy()
    else:
        data = np.asarray(data)
    peak = np.max(np.abs(data))
    if peak > 0:
        return data / peak * target_peak
    return data

def to_stereo(data):
    if hasattr(data, 'detach'):
        data = data.detach().cpu().numpy()
    else:
        data = np.asarray(data)
    if len(data.shape) == 1:
        return np.column_stack((data, data))
    return data

def freq_band_filter(data, sample_rate, low_freq, high_freq, order=4):
    nyquist = sample_rate / 2
    low = max(low_freq / nyquist, 0.001)
    high = min(high_freq / nyquist, 0.999)
    b, a = signal.butter(order, [low, high], btype='band')
    return signal.filtfilt(b, a, data)

# ==========================================
# DEMUCS v4 Separation
# ==========================================

def separate_with_demucs(input_path, model_name='htdemucs_ft'):
    try:
        # РСЃРїРѕР»СЊР·СѓРµРј РєСЌС€ РјРѕРґРµР»РµР№
        from model_cache import get_demucs_model, get_torch_device
        
        device = get_torch_device()
        print(f"Demucs: Р·Р°РіСЂСѓР·РєР° '{model_name}' РЅР° {device}...", flush=True)
        
        model = get_demucs_model(model_name)
        if model is None:
            raise ValueError("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Demucs РјРѕРґРµР»СЊ")

        print(f"Demucs: СЂР°Р·РґРµР»РµРЅРёРµ...", flush=True)
        separated = model.separate_audio(input_path)

        # separated вЂ” СЌС‚Рѕ dict РёР»Рё СЃРїРёСЃРѕРє; РѕР±СЂР°Р±Р°С‚С‹РІР°РµРј СЂРµР·СѓР»СЊС‚Р°С‚
        if isinstance(separated, dict):
            sources = list(separated.keys())
            result = {}
            for src in sources:
                src_data = separated[src]
                if hasattr(src_data, 'numpy'):
                    src_data = src_data.numpy()
                if src_data.ndim == 1:
                    src_data = src_data[np.newaxis, :]
                result[src] = src_data.T
        else:
            # Fallback: numpy array (n_sources, channels, samples)
            out = separated.numpy() if hasattr(separated, 'numpy') else separated
            sources = model.sources if hasattr(model, 'sources') else ['vocals', 'drums', 'bass', 'other']
            result = {}
            for i, src in enumerate(sources):
                if i < out.shape[0]:
                    result[src] = out[i].T

        return result, model.samplerate
    except Exception as e:
        print(f"Demucs РѕС€РёР±РєР°: {e}", flush=True)
        return None, None

# ==========================================
# Spleeter Separation
# ==========================================

def separate_with_spleeter(input_path, num_stems=4):
    try:
        from spleeter.separator import Separator
    except ImportError:
        print("Fast Local 4-stem: используем локальный быстрый профиль.", flush=True)
        return separate_with_demucs(input_path, 'htdemucs')
    try:
        import tempfile
        import shutil

        config = f'spleeter:{num_stems}stems'
        print(f"Spleeter: РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ ({config})...", flush=True)
        separator = Separator(config)

        temp_dir = tempfile.mkdtemp()
        print(f"Spleeter: СЂР°Р·РґРµР»РµРЅРёРµ...", flush=True)
        separator.separate_to_file(input_path, temp_dir)

        base_name = os.path.splitext(os.path.basename(input_path))[0]
        stems_dir = os.path.join(temp_dir, base_name)

        result = {}
        sample_rate = None

        for stem in ['vocals', 'drums', 'bass', 'other'][:num_stems]:
            stem_path = os.path.join(stems_dir, f'{stem}.wav')
            if os.path.exists(stem_path):
                data, sr = sf.read(stem_path)
                result[stem] = to_stereo(data)
                if sample_rate is None:
                    sample_rate = sr

        shutil.rmtree(temp_dir, ignore_errors=True)

        if not result:
            raise ValueError("Spleeter РЅРµ СЃРѕР·РґР°Р» С„Р°Р№Р»С‹")

        return result, sample_rate or 44100
    except Exception as e:
        print(f"Spleeter РѕС€РёР±РєР°: {e}", flush=True)
        return None, None

# ==========================================
# UVR5 MDX-Net Separation
# ==========================================

def separate_with_uvr5_mdx(input_path):
    if not os.path.exists(UVR5_PATH):
        print("UVR5 MDX Local: используем локальный профиль без UVR5.", flush=True)
        return separate_with_modern(input_path, 'uvr5_mdx')
    try:
        from lib_v5 import mdxnet
        import torch
        import librosa
        
        print("UVR5 MDX-Net: РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ...", flush=True)
        
        model_path = os.path.join(UVR5_PATH, 'models', 'MDX_Net_Models')
        if not os.path.exists(model_path):
            print("UVR5 MDX-Net: РјРѕРґРµР»Рё РЅРµ РЅР°Р№РґРµРЅС‹, СЃРѕР·РґР°С‘Рј РґРёСЂРµРєС‚РѕСЂРёСЋ", flush=True)
            os.makedirs(model_path, exist_ok=True)
        
        # РСЃРїРѕР»СЊР·СѓРµРј MDX-Net РёР· UVR5
        device = torch.device('cpu')
        
        # Р—Р°РіСЂСѓР·РєР° Р°СѓРґРёРѕ
        print("UVR5 MDX-Net: Р·Р°РіСЂСѓР·РєР° Р°СѓРґРёРѕ...", flush=True)
        X_wave, sample_rate = librosa.load(input_path, sr=44100, mono=False)
        if X_wave.ndim == 1:
            X_wave = np.stack([X_wave, X_wave])
        
        # РЎРѕР·РґР°С‘Рј MDX-Net РїСЂРѕС†РµСЃСЃРѕСЂ
        mdx = mdxnet.MDXNetMain(
            window_size=320,
            agg_factor=10,
            dim_c=4,
            dim_f=3072,
            n_fft=6144,
            hop_size=1024,
            device=device
        )
        
        print("UVR5 MDX-Net: СЂР°Р·РґРµР»РµРЅРёРµ...", flush=True)
        y_spec = mdx._separate(X_wave)
        
        # РџСЂРµРѕР±СЂР°Р·СѓРµРј СЃРїРµРєС‚СЂРѕРіСЂР°РјРјСѓ РѕР±СЂР°С‚РЅРѕ РІ Р°СѓРґРёРѕ
        from lib_v5 import spec_utils
        spec = spec_utils.SpecConverter(n_fft=6144, hop_length=1024, sample_rate=44100, dim_f=3072)
        
        vocals = spec._spectrogram_to_audio(y_spec[0])
        instrumental = spec._spectrogram_to_audio(y_spec[1])
        
        result = {
            'vocals': to_stereo(vocals),
            'instrumental': to_stereo(instrumental)
        }
        
        return result, 44100
    except Exception as e:
        print(f"UVR5 MDX-Net РѕС€РёР±РєР°: {e}", flush=True)
        import traceback
        traceback.print_exc()
        return None, None

# ==========================================
# UVR5 VR Network Separation
# ==========================================

def separate_with_uvr5_vr(input_path):
    if not os.path.exists(UVR5_PATH):
        print("UVR5 VR Local: используем локальный профиль без UVR5.", flush=True)
        return separate_with_modern(input_path, 'uvr5_vr')
    try:
        from lib_v5.vr_network import nets
        import torch
        import librosa
        
        print("UVR5 VR Network: РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ...", flush=True)
        
        model_path = os.path.join(UVR5_PATH, 'models', 'VR_Models', '1_HP-UVR.pth')
        if not os.path.exists(model_path):
            print(f"UVR5 VR: РјРѕРґРµР»СЊ РЅРµ РЅР°Р№РґРµРЅР°: {model_path}", flush=True)
            return None, None
        
        device = torch.device('cpu')
        
        # Р—Р°РіСЂСѓР·РєР° Р°СѓРґРёРѕ
        print("UVR5 VR: Р·Р°РіСЂСѓР·РєР° Р°СѓРґРёРѕ...", flush=True)
        X_wave, sample_rate = librosa.load(input_path, sr=44100, mono=False)
        if X_wave.ndim == 1:
            X_wave = np.stack([X_wave, X_wave])
        
        # РЎРѕР·РґР°С‘Рј VR Network
        model = nets.CascadedASPPNet(64)
        model.load_state_dict(torch.load(model_path, map_location=device))
        model.to(device)
        model.eval()
        
        print("UVR5 VR: СЂР°Р·РґРµР»РµРЅРёРµ...", flush=True)
        
        with torch.no_grad():
            X_spec = librosa.stft(X_wave[0], n_fft=2048, hop_length=1024)
            X_mag = np.abs(X_spec)
            X_phase = np.angle(X_spec)
            
            X_mag_tensor = torch.from_numpy(X_mag).float().to(device).unsqueeze(0).unsqueeze(0)
            y_mag = model(X_mag_tensor)
            y_mag = y_mag.squeeze().cpu().numpy()
            
            y_spec = y_mag * np.exp(1j * X_phase)
            vocals_wave = librosa.istft(y_spec, hop_length=1024)
        
        instrumental_wave = X_wave[0] - vocals_wave
        
        result = {
            'vocals': to_stereo(vocals_wave),
            'instrumental': to_stereo(instrumental_wave)
        }
        
        return result, 44100
    except Exception as e:
        print(f"UVR5 VR Network РѕС€РёР±РєР°: {e}", flush=True)
        import traceback
        traceback.print_exc()
        return None, None

# ==========================================
# Ensemble Separation
# ==========================================

def separate_with_ensemble(input_path):
    """Локальное усреднение нескольких Demucs-профилей."""
    results = []
    sample_rate = None

    local_models = ['htdemucs_ft', 'htdemucs', 'mdx']
    for model_name in local_models:
        print(f"Ensemble Local: {model_name}...", flush=True)
        model_result, sr = separate_with_demucs(input_path, model_name)
        if model_result:
            results.append(model_result)
            if sample_rate is None:
                sample_rate = sr
    
    if not results:
        return None, None
    
    print(f"Ensemble Local: усреднение {len(results)} локальных профилей...", flush=True)
    
    # РЈСЃСЂРµРґРЅСЏРµРј РѕР±С‰РёРµ СЃС‚РµРјС‹
    avg_result = {}
    all_stems = set()
    for r in results:
        all_stems.update(r.keys())
    
    for stem in all_stems:
        stem_arrays = [r[stem] for r in results if stem in r]
        if stem_arrays:
            min_len = min(len(a) for a in stem_arrays)
            aligned = [a[:min_len] for a in stem_arrays]
            avg_result[stem] = np.mean(aligned, axis=0)
    
    return avg_result, sample_rate

# ==========================================
# Legacy Filter-Based Separation
# ==========================================

def separate_legacy(input_path, preset='default', strength=1.0):
    """Р Р°Р·РґРµР»РµРЅРёРµ С‡РµСЂРµР· С‡Р°СЃС‚РѕС‚РЅС‹Рµ С„РёР»СЊС‚СЂС‹."""
    print("Legacy: Р·Р°РіСЂСѓР·РєР° Р°СѓРґРёРѕ...", flush=True)
    data, sample_rate = sf.read(input_path)
    if len(data.shape) == 1:
        data = np.column_stack((data, data))
    
    left = data[:, 0].astype(np.float64)
    right = data[:, 1].astype(np.float64)
    center = (left + right) / 2.0
    side = (left - right) / 2.0
    p = PRESETS.get(preset, PRESETS['default'])
    
    # Vocals
    vocal_core = freq_band_filter(center, sample_rate, 150, 5000, order=4)
    vocal_presence = freq_band_filter(center, sample_rate, 2000, 4000, order=2) * 0.5
    vocals_mono = (vocal_core + vocal_presence) * p['vocals'] * strength
    
    # Drums
    kick = freq_band_filter(center, sample_rate, 40, 100, order=4)
    snare = freq_band_filter(center, sample_rate, 100, 300, order=3)
    hats = freq_band_filter(center, sample_rate, 5000, 16000, order=3)
    envelope = np.abs(center)
    smoothed_env = np.convolve(envelope, np.ones(int(0.01 * sample_rate)) / int(0.01 * sample_rate), mode='same')
    diff_env = np.abs(np.diff(smoothed_env))
    diff_env = np.concatenate([[0], diff_env])
    trans_thresh = np.percentile(diff_env, 80)
    transient_mask = np.clip(diff_env / (trans_thresh + 1e-10), 0, 1)
    transient_mask = np.convolve(transient_mask, np.ones(int(0.005 * sample_rate)) / int(0.005 * sample_rate), mode='same')
    drums_mono = ((kick * 1.5 + snare * 0.8) * transient_mask + hats * 0.6) * p['drums'] * strength
    
    # Bass
    bass_core = freq_band_filter(center, sample_rate, 40, 250, order=6)
    sub_bass = freq_band_filter(center, sample_rate, 20, 60, order=4)
    bass_mono = (bass_core * 1.2 + sub_bass * 0.5) * p['bass'] * strength
    
    # Other
    other_residual = center - vocals_mono * 0.5 - drums_mono * 0.3 - bass_mono * 0.4
    other_mono = freq_band_filter(other_residual, sample_rate, 100, 15000, order=2) * p['other'] * strength
    
    # РќРѕСЂРјР°Р»РёР·Р°С†РёСЏ Рё СЃС‚РµСЂРµРѕ
    result = {}
    for name, mono in [('vocals', vocals_mono), ('drums', drums_mono), ('bass', bass_mono), ('other', other_mono)]:
        result[name] = normalize_stem(to_stereo(mono))
    
    return result, sample_rate

# ==========================================
# 6-STEM Post-Processing
# ==========================================

def split_to_6stems(result_4stem, sample_rate):
    """Р Р°Р·РґРµР»СЏРµРј 4-СЃС‚РµРј РЅР° 6-СЃС‚РµРј (РґРѕР±Р°РІР»СЏРµРј lead/backing vocals Рё piano)."""
    if 'vocals' not in result_4stem:
        return result_4stem
    
    vocals = result_4stem['vocals']
    other = result_4stem.get('other')
    nyquist = sample_rate / 2
    
    # Lead/Backing РёР· РІРѕРєР°Р»Р°
    if len(vocals.shape) > 1:
        left_v = vocals[:, 0]
        right_v = vocals[:, 1]
        center_v = (left_v + right_v) / 2.0
        side_v = (left_v - right_v) / 2.0
    else:
        center_v = vocals
        side_v = vocals * 0.3
    
    # Lead: center + presence
    low = max(150 / nyquist, 0.001)
    high = min(5000 / nyquist, 0.999)
    b, a = signal.butter(4, [low, high], btype='band')
    lead = signal.filtfilt(b, a, center_v)
    low2 = max(2000 / nyquist, 0.001)
    high2 = min(4000 / nyquist, 0.999)
    b2, a2 = signal.butter(2, [low2, high2], btype='band')
    lead += signal.filtfilt(b2, a2, center_v) * 0.5
    
    # Backing: side + air
    low3 = max(4000 / nyquist, 0.001)
    high3 = min(16000 / nyquist, 0.999)
    b3, a3 = signal.butter(2, [low3, high3], btype='band')
    backing = signal.filtfilt(b, a, side_v) + signal.filtfilt(b3, a3, side_v) * 0.4
    
    result_4stem['lead_vocals'] = normalize_stem(to_stereo(lead))
    result_4stem['backing_vocals'] = normalize_stem(to_stereo(backing))
    
    # Piano РёР· other
    if other is not None:
        if len(other.shape) > 1:
            other_mono = np.mean(other, axis=1)
        else:
            other_mono = other
        
        low_p = max(80 / nyquist, 0.001)
        high_p = min(8000 / nyquist, 0.999)
        bp, ap = signal.butter(4, [low_p, high_p], btype='band')
        piano_mono = signal.filtfilt(bp, ap, other_mono)
        result_4stem['piano'] = normalize_stem(to_stereo(piano_mono))
    
    return result_4stem

# ==========================================
# Modern Models Integration
# ==========================================

def separate_with_modern(input_path, model_type, **kwargs):
    """Разделение с современными моделями через modern_models.py."""
    try:
        from modern_models import separate_audio
        result, sample_rate = separate_audio(input_path, model_type, **kwargs)
        if result is None:
            print(f"Modern model {model_type} returned None (not implemented or failed)", flush=True)
            return None, None
        return result, sample_rate
    except ImportError:
        print(f"Modern models not available: modern_models.py not found", flush=True)
        return None, None
    except Exception as e:
        print(f"Modern model {model_type} error: {e}", flush=True)
        return None, None

# ==========================================
# Main Separation Function
# ==========================================

def separate_stems(input_path, output_dir, preset='default', strength=1.0, model='demucs', stem_type='4stem'):
    """Р“Р»Р°РІРЅР°СЏ С„СѓРЅРєС†РёСЏ СЂР°Р·РґРµР»РµРЅРёСЏ СЃ graceful degradation."""
    try:
        print(f"Р Р°Р·РґРµР»РµРЅРёРµ: РјРѕРґРµР»СЊ={model}, С‚РёРї={stem_type}", flush=True)
        print(f"Р’С…РѕРґ: {input_path}", flush=True)
        print(f"Р’С‹С…РѕРґ: {output_dir}", flush=True)

        if not os.path.exists(input_path):
            print(f"вњ— Р¤Р°Р№Р» РЅРµ РЅР°Р№РґРµРЅ: {input_path}", flush=True)
            sys.exit(1)

        os.makedirs(output_dir, exist_ok=True)

        # Graceful degradation chain: пробуем модели по очереди
        model_priority = {
            'demucs': ['demucs', 'spleeter', 'legacy'],
            'htdemucs_ft': ['htdemucs_ft', 'demucs', 'spleeter', 'legacy'],
            'spleeter': ['spleeter', 'legacy'],
            'mdxnet': ['mdxnet', 'demucs', 'spleeter', 'legacy'],
            'bandit': ['bandit', 'demucs', 'spleeter', 'legacy'],
            'melband': ['melband', 'demucs', 'spleeter', 'legacy'],
            'scnet': ['scnet', 'demucs', 'spleeter', 'legacy'],
            'vrnet': ['vrnet', 'mdxnet', 'demucs', 'spleeter', 'legacy'],
            'openunmix': ['openunmix', 'demucs', 'spleeter', 'legacy'],
            'asteroid': ['asteroid', 'openunmix', 'demucs', 'legacy'],
            'lalal': ['lalal', 'mdxnet', 'demucs', 'spleeter', 'legacy'],
            'uvr5_mdx': ['uvr5_mdx', 'mdxnet', 'demucs', 'spleeter', 'legacy'],
            'uvr5_vr': ['uvr5_vr', 'vrnet', 'mdxnet', 'demucs', 'spleeter', 'legacy'],
            'ensemble': ['ensemble', 'demucs', 'spleeter', 'legacy'],
            'modern_ensemble': ['modern_ensemble', 'mdxnet', 'demucs', 'spleeter', 'legacy'],
            'legacy': ['legacy']
        }

        model_chain = model_priority.get(model, ['demucs', 'spleeter', 'legacy'])

        result = None
        sample_rate = None
        model_used = model
        errors = []

        for try_model in model_chain:
            try:
                print(f"\n>>> РџРѕРїС‹С‚РєР° СЂР°Р·РґРµР»РµРЅРёСЏ: {try_model}", flush=True)

                if try_model == 'demucs':
                    result, sample_rate = separate_with_demucs(input_path, 'htdemucs')
                elif try_model == 'htdemucs_ft':
                    result, sample_rate = separate_with_demucs(input_path, 'htdemucs_ft')
                elif try_model == 'spleeter':
                    result, sample_rate = separate_with_spleeter(input_path, 4)
                elif try_model == 'mdxnet':
                    result, sample_rate = separate_with_modern(input_path, 'mdxnet')
                elif try_model == 'bandit':
                    result, sample_rate = separate_with_modern(input_path, 'bandit')
                elif try_model == 'melband':
                    result, sample_rate = separate_with_modern(input_path, 'melband')
                elif try_model == 'scnet':
                    result, sample_rate = separate_with_modern(input_path, 'scnet')
                elif try_model == 'vrnet':
                    result, sample_rate = separate_with_modern(input_path, 'vrnet')
                elif try_model == 'openunmix':
                    result, sample_rate = separate_with_modern(input_path, 'openunmix')
                elif try_model == 'asteroid':
                    result, sample_rate = separate_with_modern(input_path, 'asteroid')
                elif try_model == 'lalal':
                    result, sample_rate = separate_with_modern(input_path, 'lalal')
                elif try_model == 'uvr5_mdx':
                    result, sample_rate = separate_with_uvr5_mdx(input_path)
                elif try_model == 'uvr5_vr':
                    result, sample_rate = separate_with_uvr5_vr(input_path)
                elif try_model == 'ensemble':
                    result, sample_rate = separate_with_ensemble(input_path)
                elif try_model == 'modern_ensemble':
                    result, sample_rate = separate_with_modern(input_path, 'modern_ensemble')
                elif try_model == 'legacy':
                    result, sample_rate = separate_legacy(input_path, preset, strength)

                # РџСЂРѕРІРµСЂСЏРµРј С‡С‚Рѕ СЂРµР·СѓР»СЊС‚Р°С‚ РІР°Р»РёРґРЅС‹Р№
                if result is None or sample_rate is None:
                    raise ValueError(f"РњРѕРґРµР»СЊ {try_model} РІРµСЂРЅСѓР»Р° РїСѓСЃС‚РѕР№ СЂРµР·СѓР»СЊС‚Р°С‚")

                model_used = try_model
                if try_model != model:
                    print(f"вљ  Fallback: РёСЃРїРѕР»СЊР·СѓРµРј {try_model} РІРјРµСЃС‚Рѕ {model}", flush=True)
                break  # РЈСЃРїРµС…!

            except Exception as e:
                error_msg = f"{try_model}: {str(e)}"
                errors.append(error_msg)
                print(f"вњ— РћС€РёР±РєР° {error_msg}, РїСЂРѕР±СѓРµРј СЃР»РµРґСѓСЋС‰СѓСЋ РјРѕРґРµР»СЊ...", flush=True)
                # РџСЂРѕРґРѕР»Р¶Р°РµРј Рє СЃР»РµРґСѓСЋС‰РµР№ РјРѕРґРµР»Рё

        # Р•СЃР»Рё РІСЃРµ РјРѕРґРµР»Рё СѓРїР°Р»Рё
        if result is None:
            error_summary = '\n'.join([f"  - {e}" for e in errors])
            print(f"\nвњ— Р’СЃРµ РјРѕРґРµР»Рё СЂР°Р·РґРµР»РµРЅРёСЏ СѓРїР°Р»Рё:\n{error_summary}", flush=True)
            sys.exit(1)

        # РџСЂРёРјРµРЅСЏРµРј РїСЂРµСЃРµС‚С‹ Рё СЃРёР»Сѓ
        p = PRESETS.get(preset, PRESETS['default'])
        for stem_name in result:
            gain = p.get(stem_name, 1.0) * strength
            result[stem_name] = result[stem_name] * gain

        # РќРѕСЂРјР°Р»РёР·Р°С†РёСЏ
        for stem_name in result:
            result[stem_name] = normalize_stem(result[stem_name])

        # 6-stem РѕР±СЂР°Р±РѕС‚РєР°
        if stem_type == '6stem':
            result = split_to_6stems(result, sample_rate)

        # РЎРѕС…СЂР°РЅРµРЅРёРµ
        stem_order = ['vocals', 'lead_vocals', 'backing_vocals', 'drums', 'bass', 'piano', 'other', 'instrumental']
        for stem_name in stem_order:
            if stem_name not in result:
                continue
            stem_path = os.path.join(output_dir, f'{stem_name}.wav')
            data = result[stem_name]
            if len(data.shape) == 1:
                data = np.column_stack((data, data))
            sf.write(stem_path, data, sample_rate, format='WAV', subtype='PCM_16')
            stats = os.stat(stem_path)
            print(f"вњ“ {stem_name}: {(stats.st_size / 1024):.1f} KB", flush=True)

        # Info JSON СЃ РёРЅС„РѕСЂРјР°С†РёРµР№ Рѕ РёСЃРїРѕР»СЊР·РѕРІР°РЅРЅРѕР№ РјРѕРґРµР»Рё
        stems_info = {
            'stems': list(result.keys()),
            'sampleRate': sample_rate,
            'preset': preset,
            'strength': strength,
            'model': model_used,
            'modelRequested': model,
            'type': stem_type,
            'fallbackUsed': model_used != model,
            'runtimeBackend': model_used,
            'errors': errors[:-1] if len(errors) > 1 else []  # Р’СЃРµ РѕС€РёР±РєРё РєСЂРѕРјРµ РїРѕСЃР»РµРґРЅРµР№
        }
        with open(os.path.join(output_dir, 'stems_info.json'), 'w') as f:
            json.dump(stems_info, f, indent=2)

        print(f"\nвњ“ Р Р°Р·РґРµР»РµРЅРёРµ Р·Р°РІРµСЂС€РµРЅРѕ! (РјРѕРґРµР»СЊ: {model_used})", flush=True)

    except SystemExit:
        raise
    except Exception as e:
        print(f"вњ— РћС€РёР±РєР°: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)

# ==========================================
# CLI
# ==========================================

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ: python stems.py input.wav output_dir [preset] [strength] [model] [type]", flush=True)
        print("Модели: modern_ensemble, demucs, htdemucs_ft, mdxnet, bandit, melband, scnet, vrnet, openunmix, asteroid, spleeter, ensemble, lalal, uvr5_mdx, uvr5_vr, legacy — все локальные, без API ключей", flush=True)
        print("РџСЂРµСЃРµС‚С‹: default, pop, rock, rap, jazz, classic, electronic, acoustic", flush=True)
        print("РўРёРїС‹: 4stem, 6stem (default: 4stem)", flush=True)
        sys.exit(1)

    input_path = sys.argv[1]
    output_dir = sys.argv[2]
    preset = sys.argv[3] if len(sys.argv) > 3 else 'default'
    strength = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
    model = sys.argv[5] if len(sys.argv) > 5 else 'demucs'
    stem_type = sys.argv[6] if len(sys.argv) > 6 else '4stem'

    separate_stems(input_path, output_dir, preset, strength, model, stem_type)
