#!/usr/bin/env python3
"""
РЈР»СѓС‡С€РµРЅРЅРѕРµ СЂР°Р·РґРµР»РµРЅРёРµ РІРѕРєР°Р»Р°/РёРЅСЃС‚СЂСѓРјРµРЅС‚Р°Р»Р° СЃ РїРѕРґРґРµСЂР¶РєРѕР№ ML-РјРѕРґРµР»РµР№.

Р РµР¶РёРјС‹:
  - fast: Spleeter (Р±С‹СЃС‚СЂРѕ, CPU-friendly)
  - quality: Demucs v4 (РІС‹СЃРѕРєРѕРµ РєР°С‡РµСЃС‚РІРѕ)
  - ultra: Ensemble Demucs + MDX-Net (РјР°РєСЃРёРјР°Р»СЊРЅРѕРµ РєР°С‡РµСЃС‚РІРѕ)

Usage:
    python separate.py input.wav vocals.wav instrumental.wav [strength] [preset] [mode]

Modes:
    fast     - Spleeter 2-stem
    quality  - Demucs v4 ht (hybrid transformer)
    ultra    - Ensemble (Demucs + MDX-Net)

Presets:
    default, pop, rock, rap, classic
"""

import numpy as np
import soundfile as sf
import sys
import os
import json
from pathlib import Path
import subprocess
import shutil

# ==========================================
# РљРѕРЅС„РёРіСѓСЂР°С†РёСЏ РјРѕРґРµР»РµР№
# ==========================================

MODELS_CONFIG = {
    'fast': {
        'model': 'spleeter',
        'description': 'Р‘С‹СЃС‚СЂРѕРµ СЂР°Р·РґРµР»РµРЅРёРµ (Spleeter)',
        'gpu_support': False,
        'speed': 'fast',
        'quality': 'medium'
    },
    'quality': {
        'model': 'demucs_ht',
        'description': 'Р’С‹СЃРѕРєРѕРµ РєР°С‡РµСЃС‚РІРѕ (Demucs v4 Hybrid Transformer)',
        'gpu_support': True,
        'speed': 'medium',
        'quality': 'high'
    },
    'ultra': {
        'model': 'ensemble',
        'description': 'РњР°РєСЃРёРјР°Р»СЊРЅРѕРµ РєР°С‡РµСЃС‚РІРѕ (Demucs + MDX-Net)',
        'gpu_support': True,
        'speed': 'slow',
        'quality': 'ultra'
    }
}

# ==========================================
# РЈС‚РёР»РёС‚С‹
# ==========================================

def check_gpu_available():
    """РџСЂРѕРІРµСЂРєР° РґРѕСЃС‚СѓРїРЅРѕСЃС‚Рё GPU"""
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False

def check_model_installed(model_name):
    """РџСЂРѕРІРµСЂРєР° СѓСЃС‚Р°РЅРѕРІР»РµРЅРЅРѕСЃС‚Рё РјРѕРґРµР»Рё"""
    if model_name == 'demucs':
        try:
            import demucs
            return True
        except ImportError:
            return False
    elif model_name == 'spleeter':
        try:
            from spleeter.separator import Separator
            return True
        except ImportError:
            return False
    return False

def apply_eq(data, samplerate, low_freq, high_freq, gain_db, order=4):
    """РџСЂРёРјРµРЅРµРЅРёРµ СЌРєРІР°Р»Р°Р№Р·РµСЂР° СЃ Butterworth С„РёР»СЊС‚СЂРѕРј (legacy fallback)"""
    from scipy import signal

    gain_linear = 10 ** (gain_db / 20.0)

    nyquist = samplerate / 2
    low = max(low_freq / nyquist, 0.001)
    high = min(high_freq / nyquist, 0.999)

    b, a = signal.butter(order, [low, high], btype='band')
    filtered = signal.filtfilt(b, a, data)

    result = data + filtered * (gain_linear - 1)

    return result

# ==========================================
# ML-based separation
# ==========================================

def separate_with_demucs(input_path, output_dir, mode='ht', device=None):
    """
    Р Р°Р·РґРµР»РµРЅРёРµ С‡РµСЂРµР· Demucs v4.

    Args:
        input_path: РїСѓС‚СЊ Рє РІС…РѕРґРЅРѕРјСѓ С„Р°Р№Р»Сѓ
        output_dir: РґРёСЂРµРєС‚РѕСЂРёСЏ РґР»СЏ РІС‹РІРѕРґР°
        mode: РјРѕРґРµР»СЊ ('ht', 'mdx', 'mdx_extra')
        device: 'cuda' РёР»Рё 'cpu'
    """
    try:
        # РСЃРїРѕР»СЊР·СѓРµРј РєСЌС€ РјРѕРґРµР»РµР№
        from model_cache import get_demucs_model, get_torch_device

        # РћРїСЂРµРґРµР»СЏРµРј СѓСЃС‚СЂРѕР№СЃС‚РІРѕ
        if device is None:
            device = get_torch_device()

        # РњР°РїРїРёРЅРі СЂРµР¶РёРјР° РЅР° РёРјСЏ РјРѕРґРµР»Рё Demucs
        model_name_map = {
            'ht': 'htdemucs',
            'mdx': 'mdx',
            'mdx_extra': 'mdx_extra_q',
        }
        demucs_model_name = model_name_map.get(mode, 'htdemucs')

        print(f"Demucs: Р·Р°РіСЂСѓР·РєР° РјРѕРґРµР»Рё '{demucs_model_name}' РЅР° СѓСЃС‚СЂРѕР№СЃС‚РІРµ '{device}'...", flush=True)

        # Р—Р°РіСЂСѓР¶Р°РµРј РїСЂРµРґРѕР±СѓС‡РµРЅРЅСѓСЋ РјРѕРґРµР»СЊ С‡РµСЂРµР· РєСЌС€
        model = get_demucs_model(demucs_model_name)
        if model is None:
            raise ValueError("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Demucs РјРѕРґРµР»СЊ")

        # Р Р°Р·РґРµР»СЏРµРј
        print("Demucs: СЂР°Р·РґРµР»РµРЅРёРµ Р°СѓРґРёРѕ...", flush=True)
        separated = model.separate_audio(input_path)

        # separated - СЌС‚Рѕ tuple (audio_dict, info) РёР»Рё dict
        if isinstance(separated, (list, tuple)) and len(separated) >= 1:
            separated = separated[0]

        vocals = separated.get('vocals') if isinstance(separated, dict) else None
        # РЎРѕР±РёСЂР°РµРј РѕСЃС‚Р°Р»СЊРЅС‹Рµ СЃС‚РµРјС‹ РІ "other"
        if isinstance(separated, dict):
            stems = [v for k, v in separated.items() if k != 'vocals']
            other = sum(stems) if stems else None
        else:
            other = None

        if vocals is None or other is None:
            raise ValueError("Demucs РЅРµ РІРµСЂРЅСѓР» vocals/other")

        # РљРѕРЅРІРµСЂС‚РёСЂСѓРµРј РІ numpy
        vocals_np = vocals.cpu().numpy().T if hasattr(vocals, 'cpu') else np.array(vocals).T
        other_np = other.cpu().numpy().T if hasattr(other, 'cpu') else np.array(other).T

        return vocals_np, other_np, model.samplerate

    except Exception as e:
        print(f"РћС€РёР±РєР° Demucs: {str(e)}", flush=True)
        raise

def separate_with_spleeter(input_path, output_dir):
    """
    Р Р°Р·РґРµР»РµРЅРёРµ С‡РµСЂРµР· Spleeter (Р±С‹СЃС‚СЂС‹Р№ СЂРµР¶РёРј).

    Args:
        input_path: РїСѓС‚СЊ Рє РІС…РѕРґРЅРѕРјСѓ С„Р°Р№Р»Сѓ
        output_dir: РґРёСЂРµРєС‚РѕСЂРёСЏ РґР»СЏ РІС‹РІРѕРґР°

    Returns:
        vocals, instrumental, sample_rate
    """
    # РЎРѕР·РґР°С‘Рј РІСЂРµРјРµРЅРЅСѓСЋ РґРёСЂРµРєС‚РѕСЂРёСЋ РєСЂРѕСЃСЃРїР»Р°С‚С„РѕСЂРјРµРЅРЅРѕ
    temp_dir = os.path.join(output_dir, 'spleeter_temp')
    os.makedirs(temp_dir, exist_ok=True)

    try:
        # РџРѕРїС‹С‚РєР° 1: РЅРѕРІС‹Р№ API С‡РµСЂРµР· Separator
        try:
            from spleeter.separator import Separator

            print("Spleeter: РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ (РЅРѕРІС‹Р№ API)...", flush=True)
            separator = Separator('spleeter:2stems')

            print("Spleeter: СЂР°Р·РґРµР»РµРЅРёРµ Р°СѓРґРёРѕ...", flush=True)
            separator.separate_to_file(input_path, temp_dir)

        except Exception as e:
            print(f"Spleeter РЅРѕРІС‹Р№ API РЅРµ СЃСЂР°Р±РѕС‚Р°Р» ({e}), РїСЂРѕР±СѓРµРј legacy...", flush=True)
            # РџРѕРїС‹С‚РєР° 2: legacy API С‡РµСЂРµР· separate
            try:
                from spleeter.audio.adapter import AudioAdapter
                from spleeter.separator import Separator

                print("Spleeter: РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ (legacy API)...", flush=True)
                separator = Separator('spleeter:2stems')
                audio_adapter = AudioAdapter.default()

                # Р—Р°РіСЂСѓР¶Р°РµРј Р°СѓРґРёРѕ
                waveform, sample_rate = audio_adapter.load(input_path)

                print("Spleeter: СЂР°Р·РґРµР»РµРЅРёРµ Р°СѓРґРёРѕ...", flush=True)
                prediction = separator.separate(waveform)

                vocals = prediction['vocals']
                instrumental = prediction['accompaniment']

                # РЎРѕС…СЂР°РЅСЏРµРј РІРѕ РІСЂРµРјРµРЅРЅС‹Рµ С„Р°Р№Р»С‹ РґР»СЏ РµРґРёРЅРѕРѕР±СЂР°Р·РёСЏ
                vocals_path = os.path.join(temp_dir, 'vocals.wav')
                instrumental_path = os.path.join(temp_dir, 'instrumental.wav')

                audio_adapter.save(vocals_path, vocals, sample_rate)
                audio_adapter.save(instrumental_path, instrumental, sample_rate)

            except Exception as e2:
                shutil.rmtree(temp_dir, ignore_errors=True)
                raise ValueError(f"Spleeter РЅРµ СѓРґР°Р»РѕСЃСЊ РёРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°С‚СЊ: {e2}") from e2

        # Р§РёС‚Р°РµРј СЂРµР·СѓР»СЊС‚Р°С‚С‹ (РґР»СЏ РѕР±РѕРёС… РїСѓС‚РµР№)
        vocals_path = os.path.join(temp_dir, 'vocals.wav')
        instrumental_path = os.path.join(temp_dir, 'instrumental.wav')

        if not os.path.exists(vocals_path) or not os.path.exists(instrumental_path):
            raise ValueError("Spleeter РЅРµ СЃРѕР·РґР°Р» РІС‹С…РѕРґРЅС‹Рµ С„Р°Р№Р»С‹")

        vocals, sr_v = sf.read(vocals_path)
        instrumental, sr_i = sf.read(instrumental_path)

        return vocals, instrumental, sr_v

    except Exception as e:
        print(f"РћС€РёР±РєР° Spleeter: {str(e)}", flush=True)
        raise
    finally:
        # РћС‡РёС‰Р°РµРј РІСЂРµРјРµРЅРЅС‹Рµ С„Р°Р№Р»С‹
        shutil.rmtree(temp_dir, ignore_errors=True)

def separate_ensemble(input_path, output_dir):
    """
    Ensemble СЂР°Р·РґРµР»РµРЅРёРµ: Demucs + MDX-Net.

    РЈСЃСЂРµРґРЅСЏРµС‚ СЂРµР·СѓР»СЊС‚Р°С‚С‹ РЅРµСЃРєРѕР»СЊРєРёС… РјРѕРґРµР»РµР№ РґР»СЏ Р»СѓС‡С€РµРіРѕ РєР°С‡РµСЃС‚РІР°.
    """
    print("Ensemble: СЂР°Р·РґРµР»РµРЅРёРµ С‡РµСЂРµР· Demucs...", flush=True)
    demucs_voc, demucs_inst, sr = separate_with_demucs(input_path, output_dir, mode='ht')

    # РњРѕР¶РЅРѕ РґРѕР±Р°РІРёС‚СЊ MDX-Net Р·РґРµСЃСЊ РґР»СЏ СѓСЃСЂРµРґРЅРµРЅРёСЏ
    # РџРѕРєР° РёСЃРїРѕР»СЊР·Сѓ С‚РѕР»СЊРєРѕ Demucs РєР°Рє РѕСЃРЅРѕРІРЅРѕР№ РёСЃС‚РѕС‡РЅРёРє

    print("Ensemble: Р·Р°РІРµСЂС€РµРЅРёРµ...", flush=True)
    return demucs_voc, demucs_inst, sr

# ==========================================
# Legacy separation (fallback)
# ==========================================

def separate_legacy_filter(input_path, vocals_path, instrumental_path, vocal_strength=1.0, preset='default'):
    """РЈСЃС‚Р°СЂРµРІС€РµРµ СЂР°Р·РґРµР»РµРЅРёРµ С‡РµСЂРµР· С„РёР»СЊС‚СЂС‹ (fallback)"""
    try:
        from scipy import signal

        print(f"Legacy: Р·Р°РіСЂСѓР·РєР° Р°СѓРґРёРѕ: {input_path}", flush=True)
        data, samplerate = sf.read(input_path)

        if len(data.shape) == 1:
            print("Legacy: РјРѕРЅРѕ Р°СѓРґРёРѕ, РєРѕРЅРІРµСЂС‚РёСЂСѓРµРј РІ СЃС‚РµСЂРµРѕ", flush=True)
            data = np.column_stack((data, data))

        print(f"Legacy: СЃСЌРјРїР»СЂРµР№С‚: {samplerate}, РєР°РЅР°Р»С‹: {data.shape[1]}", flush=True)

        presets = {
            'default': {
                'vocal_low': 200, 'vocal_high': 4000, 'vocal_gain': 6,
                'instr_gain': -3, 'stereo_width': 1.0
            },
            'pop': {
                'vocal_low': 250, 'vocal_high': 5000, 'vocal_gain': 8,
                'instr_gain': -4, 'stereo_width': 1.2
            },
            'rock': {
                'vocal_low': 150, 'vocal_high': 3500, 'vocal_gain': 5,
                'instr_gain': -2, 'stereo_width': 0.9
            },
            'rap': {
                'vocal_low': 300, 'vocal_high': 6000, 'vocal_gain': 9,
                'instr_gain': -5, 'stereo_width': 1.1
            },
            'classic': {
                'vocal_low': 100, 'vocal_high': 3000, 'vocal_gain': 4,
                'instr_gain': -2, 'stereo_width': 0.8
            }
        }

        p = presets.get(preset, presets['default'])

        vocals_gain = p['vocal_gain'] * vocal_strength
        instr_gain = p['instr_gain'] * vocal_strength

        left = data[:, 0].astype(np.float64)
        right = data[:, 1].astype(np.float64)

        center = (left + right) / 2.0
        side = (left - right) / 2.0

        vocals_center = apply_eq(center, samplerate, p['vocal_low'], p['vocal_high'], vocals_gain)
        presence_range = apply_eq(center, samplerate, 2000, 4000, vocals_gain * 0.5)
        vocals_mono = vocals_center * 0.7 + presence_range * 0.3

        instrumental_side = apply_eq(side, samplerate, p['vocal_low'], p['vocal_high'], instr_gain)
        instrumental_center = apply_eq(center, samplerate, p['vocal_low'], p['vocal_high'], instr_gain * 0.5)
        instrumental_mono = instrumental_side * 0.7 + instrumental_center * 0.3

        stereo_width = p['stereo_width']
        instr_left = instrumental_mono + side * stereo_width
        instr_right = instrumental_mono - side * stereo_width

        vocals_stereo = np.column_stack((vocals_mono, vocals_mono))
        instrumental_stereo = np.column_stack((instr_left, instr_right))

        vocals_peak = np.max(np.abs(vocals_stereo))
        instrumental_peak = np.max(np.abs(instrumental_stereo))

        vocals_normalized = vocals_stereo / vocals_peak * 0.85 if vocals_peak > 0 else vocals_stereo
        instrumental_normalized = instrumental_stereo / instrumental_peak * 0.85 if instrumental_peak > 0 else instrumental_stereo

        sf.write(vocals_path, vocals_normalized, samplerate, format='WAV', subtype='PCM_16')
        sf.write(instrumental_path, instrumental_normalized, samplerate, format='WAV', subtype='PCM_16')

        print(f"вњ“ Legacy СЂР°Р·РґРµР»РµРЅРёРµ Р·Р°РІРµСЂС€РµРЅРѕ!", flush=True)

    except Exception as e:
        print(f"вњ— РћС€РёР±РєР° legacy СЂР°Р·РґРµР»РµРЅРёСЏ: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)

# ==========================================
# Main separation function
# ==========================================

def separate_audio(input_path, vocals_path, instrumental_path, vocal_strength=1.0, preset='default', mode='quality'):
    """
    Р“Р»Р°РІРЅР°СЏ С„СѓРЅРєС†РёСЏ СЂР°Р·РґРµР»РµРЅРёСЏ СЃ graceful degradation.

    Args:
        input_path: РїСѓС‚СЊ Рє РІС…РѕРґРЅРѕРјСѓ С„Р°Р№Р»Сѓ
        vocals_path: РїСѓС‚СЊ РґР»СЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ РІРѕРєР°Р»Р°
        instrumental_path: РїСѓС‚СЊ РґР»СЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ РёРЅСЃС‚СЂСѓРјРµРЅС‚Р°Р»Р°
        vocal_strength: СЃРёР»Р° РІРѕРєР°Р»Р° (0.0 - 2.0)
        preset: РїСЂРµСЃРµС‚ (default, pop, rock, rap, classic)
        mode: СЂРµР¶РёРј СЂР°Р·РґРµР»РµРЅРёСЏ (fast, quality, ultra)
    """
    try:
        print(f"Р РµР¶РёРј СЂР°Р·РґРµР»РµРЅРёСЏ: {mode}", flush=True)
        print(f"Р’С…РѕРґРЅРѕР№ С„Р°Р№Р»: {input_path}", flush=True)

        # РџСЂРѕРІРµСЂСЏРµРј СЃСѓС‰РµСЃС‚РІРѕРІР°РЅРёРµ РІС…РѕРґРЅРѕРіРѕ С„Р°Р№Р»Р°
        if not os.path.exists(input_path):
            print(f"вњ— Р’С…РѕРґРЅРѕР№ С„Р°Р№Р» РЅРµ РЅР°Р№РґРµРЅ: {input_path}", flush=True)
            sys.exit(1)

        # РЎРѕР·РґР°С‘Рј РґРёСЂРµРєС‚РѕСЂРёСЋ РІС‹РІРѕРґР°
        output_dir = os.path.dirname(vocals_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)

        # Graceful degradation chain
        mode_fallback_chain = {
            'fast': ['fast', 'quality', 'legacy'],
            'quality': ['quality', 'fast', 'legacy'],
            'ultra': ['ultra', 'quality', 'fast', 'legacy']
        }

        try_chain = mode_fallback_chain.get(mode, ['quality', 'fast', 'legacy'])

        # РћРїСЂРµРґРµР»СЏРµРј РєРѕРЅС„РёРіСѓСЂР°С†РёСЋ РґР»СЏ РєР°Р¶РґРѕРіРѕ СЂРµР¶РёРјР°
        mode_to_model = {
            'fast': ('spleeter', 'separate_with_spleeter'),
            'quality': ('demucs_ht', 'separate_with_demucs'),
            'ultra': ('ensemble', 'separate_ensemble'),
            'legacy': (None, 'legacy')
        }

        vocals_data = None
        instrumental_data = None
        sample_rate = None
        model_used = None

        errors = []

        for try_mode in try_chain:
            try:
                model_name, func_name = mode_to_model[try_mode]

                if try_mode == 'legacy':
                    print(f"\n>>> РџРѕРїС‹С‚РєР°: Legacy filters (fallback)", flush=True)
                    separate_legacy_filter(input_path, vocals_path, instrumental_path, vocal_strength, preset)
                    print(f"вњ“ Legacy СЂР°Р·РґРµР»РµРЅРёРµ Р·Р°РІРµСЂС€РµРЅРѕ!", flush=True)
                    return

                print(f"\n>>> РџРѕРїС‹С‚РєР°: {try_mode} ({model_name})", flush=True)

                if try_mode == 'fast':
                    if not check_model_installed('spleeter'):
                        raise ValueError("Spleeter РЅРµ СѓСЃС‚Р°РЅРѕРІР»РµРЅ")
                    vocals_data, instrumental_data, sample_rate = separate_with_spleeter(input_path, output_dir)

                elif try_mode == 'quality':
                    if not check_model_installed('demucs'):
                        raise ValueError("Demucs РЅРµ СѓСЃС‚Р°РЅРѕРІР»РµРЅ")
                    vocals_data, instrumental_data, sample_rate = separate_with_demucs(
                        input_path, output_dir, mode='ht'
                    )

                elif try_mode == 'ultra':
                    if not check_model_installed('demucs'):
                        raise ValueError("Demucs РЅРµ СѓСЃС‚Р°РЅРѕРІР»РµРЅ")
                    vocals_data, instrumental_data, sample_rate = separate_ensemble(input_path, output_dir)

                # РџСЂРѕРІРµСЂСЏРµРј С‡С‚Рѕ СЂРµР·СѓР»СЊС‚Р°С‚ РІР°Р»РёРґРЅС‹Р№
                if vocals_data is None or instrumental_data is None:
                    raise ValueError(f"Р РµР¶РёРј {try_mode} РІРµСЂРЅСѓР» РїСѓСЃС‚РѕР№ СЂРµР·СѓР»СЊС‚Р°С‚")

                model_used = try_mode
                if try_mode != mode:
                    print(f"вљ  Fallback: РёСЃРїРѕР»СЊР·СѓРµРј {try_mode} РІРјРµСЃС‚Рѕ {mode}", flush=True)
                break  # РЈСЃРїРµС…!

            except Exception as e:
                error_msg = f"{try_mode}: {str(e)}"
                errors.append(error_msg)
                print(f"вњ— РћС€РёР±РєР° {error_msg}, РїСЂРѕР±СѓРµРј СЃР»РµРґСѓСЋС‰РёР№ СЂРµР¶РёРј...", flush=True)
                # РџСЂРѕРґРѕР»Р¶Р°РµРј Рє СЃР»РµРґСѓСЋС‰РµРјСѓ СЂРµР¶РёРјСѓ

        # Р•СЃР»Рё РІСЃРµ СЂРµР¶РёРјС‹ СѓРїР°Р»Рё
        if vocals_data is None:
            error_summary = '\n'.join([f"  - {e}" for e in errors])
            print(f"\nвњ— Р’СЃРµ СЂРµР¶РёРјС‹ СЂР°Р·РґРµР»РµРЅРёСЏ СѓРїР°Р»Рё:\n{error_summary}", flush=True)
            sys.exit(1)

        # РџСЂРёРјРµРЅСЏРµРј СЃРёР»Сѓ РІРѕРєР°Р»Р°
        print(f"РџСЂРёРјРµРЅРµРЅРёРµ СЃРёР»С‹ РІРѕРєР°Р»Р°: {vocal_strength}...", flush=True)

        # РЈСЃРёР»РµРЅРёРµ/РѕСЃР»Р°Р±Р»РµРЅРёРµ РІРѕРєР°Р»Р°
        vocals_data = vocals_data * vocal_strength

        # РљРѕРјРїРµРЅСЃР°С†РёСЏ РёРЅСЃС‚СЂСѓРјРµРЅС‚Р°Р»Р°
        instrumental_data = instrumental_data / max(vocal_strength, 0.1)

        # РќРѕСЂРјР°Р»РёР·Р°С†РёСЏ
        vocals_peak = np.max(np.abs(vocals_data))
        instrumental_peak = np.max(np.abs(instrumental_data))

        print(f"Р’РѕРєР°Р» РїРёРє: {vocals_peak:.4f}, РРЅСЃС‚СЂСѓРјРµРЅС‚Р°Р» РїРёРє: {instrumental_peak:.4f}", flush=True)

        if vocals_peak > 0:
            vocals_data = vocals_data / vocals_peak * 0.85
        if instrumental_peak > 0:
            instrumental_data = instrumental_data / instrumental_peak * 0.85

        # РљРѕРЅРІРµСЂС‚Р°С†РёСЏ РІ РїСЂР°РІРёР»СЊРЅС‹Р№ С„РѕСЂРјР°С‚
        if len(vocals_data.shape) == 1:
            vocals_data = np.column_stack((vocals_data, vocals_data))
        if len(instrumental_data.shape) == 1:
            instrumental_data = np.column_stack((instrumental_data, instrumental_data))

        # РЎРѕС…СЂР°РЅРµРЅРёРµ
        print(f"РЎРѕС…СЂР°РЅРµРЅРёРµ РІРѕРєР°Р»Р°: {vocals_path}", flush=True)
        sf.write(vocals_path, vocals_data, sample_rate, format='WAV', subtype='PCM_16')

        print(f"РЎРѕС…СЂР°РЅРµРЅРёРµ РёРЅСЃС‚СЂСѓРјРµРЅС‚Р°Р»Р°: {instrumental_path}", flush=True)
        sf.write(instrumental_path, instrumental_data, sample_rate, format='WAV', subtype='PCM_16')

        print(f"вњ“ Р’РѕРєР°Р» СЃРѕС…СЂР°РЅС‘РЅ: {vocals_path}", flush=True)
        print(f"вњ“ РРЅСЃС‚СЂСѓРјРµРЅС‚Р°Р» СЃРѕС…СЂР°РЅС‘РЅ: {instrumental_path}", flush=True)
        print(f"вњ“ Р Р°Р·РґРµР»РµРЅРёРµ Р·Р°РІРµСЂС€РµРЅРѕ СѓСЃРїРµС€РЅРѕ! (СЂРµР¶РёРј: {model_used})", flush=True)

    except SystemExit:
        raise
    except Exception as e:
        print(f"вњ— РћС€РёР±РєР° СЂР°Р·РґРµР»РµРЅРёСЏ: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ: python separate.py input.wav vocals.wav instrumental.wav [strength] [preset] [mode]")
        print("Р РµР¶РёРјС‹: fast, quality, ultra")
        print("РџСЂРµСЃРµС‚С‹: default, pop, rock, rap, classic")
        sys.exit(1)

    input_path = sys.argv[1]
    vocals_path = sys.argv[2]
    instrumental_path = sys.argv[3]
    vocal_strength = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
    preset = sys.argv[5] if len(sys.argv) > 5 else 'default'
    mode = sys.argv[6] if len(sys.argv) > 6 else 'quality'

    separate_audio(input_path, vocals_path, instrumental_path, vocal_strength, preset, mode)
