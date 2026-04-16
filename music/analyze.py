#!/usr/bin/env python3
"""
РЈР»СѓС‡С€РµРЅРЅС‹Р№ Р°РЅР°Р»РёР· Р°СѓРґРёРѕ СЃ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµРј librosa Рё СЃРѕРІСЂРµРјРµРЅРЅС‹С… РјРµС‚РѕРґРѕРІ.

РЈР»СѓС‡С€РµРЅРёСЏ:
- BPM РґРµС‚РµРєС†РёСЏ С‡РµСЂРµР· librosa.beat.beat_track (С‚РѕС‡РЅРµРµ Р°РІС‚РѕРєРѕСЂСЂРµР»СЏС†РёРё)
- РўРѕРЅР°Р»СЊРЅРѕСЃС‚СЊ С‡РµСЂРµР· С…СЂРѕРјР°С‚РёС‡РµСЃРєРёР№ Р°РЅР°Р»РёР· librosa
- Р Р°СЃС€РёСЂРµРЅРЅС‹Р№ СЃРїРµРєС‚СЂР°Р»СЊРЅС‹Р№ Р°РЅР°Р»РёР·
- Р”РµС‚РµРєС†РёСЏ Р°РєРєРѕСЂРґРѕРІ
- РћС†РµРЅРєР° РіСЂРѕРјРєРѕСЃС‚Рё РїРѕ СЃС‚Р°РЅРґР°СЂС‚Сѓ LUFS

Usage:
    python analyze.py input.wav
"""

import numpy as np
import soundfile as sf
import sys
import json
import os
from pathlib import Path

try:
    import librosa
    HAS_LIBROSA = True
except ImportError:
    HAS_LIBROSA = False
    print("Warning: librosa not installed, using fallback methods", flush=True)


def detect_bpm_librosa(data, sample_rate):
    """Р”РµС‚РµРєС†РёСЏ BPM С‡РµСЂРµР· librosa - state-of-the-art РјРµС‚РѕРґ"""
    if not HAS_LIBROSA:
        return detect_bpm_fallback(data, sample_rate)

    # РљРѕРЅРІРµСЂС‚РёСЂСѓРµРј РІ РјРѕРЅРѕ РµСЃР»Рё РЅСѓР¶РЅРѕ
    if len(data.shape) > 1:
        data = np.mean(data, axis=1)

    # librosa beat tracking
    tempo, beat_frames = librosa.beat.beat_track(y=data, sr=sample_rate)

    # tempo РјРѕР¶РµС‚ Р±С‹С‚СЊ РјР°СЃСЃРёРІРѕРј РёР»Рё СЃРєР°Р»СЏСЂРѕРј
    if isinstance(tempo, np.ndarray):
        bpm = float(tempo[0]) if len(tempo) > 0 else 120.0
    else:
        bpm = float(tempo)

    # РџРѕР»СѓС‡Р°РµРј РІСЂРµРјРµРЅР° Р±РёС‚РѕРІ
    beat_times = librosa.frames_to_time(beat_frames, sr=sample_rate)

    # РћРіСЂР°РЅРёС‡РёРІР°РµРј РєРѕР»РёС‡РµСЃС‚РІРѕ Р±РёС‚РѕРІ
    beat_times_list = [round(t, 3) for t in beat_times[:50]]

    # РЈС‚РѕС‡РЅСЏРµРј BPM (РєСЂР°С‚РЅРѕСЃС‚СЊ 2)
    if bpm < 70:
        bpm *= 2
    elif bpm > 180:
        bpm /= 2

    return round(bpm, 1), beat_times_list


def detect_bpm_fallback(data, sample_rate):
    """Fallback BPM С‡РµСЂРµР· СЌРЅРµСЂРіРёСЋ Рё Р°РІС‚РѕРєРѕСЂСЂРµР»СЏС†РёСЋ (СЃС‚Р°СЂС‹Р№ РјРµС‚РѕРґ)"""
    if len(data.shape) > 1:
        data = np.mean(data, axis=1)

    hop_length = 512
    frame_length = 2048

    energy = []
    for i in range(0, len(data) - frame_length, hop_length):
        frame = data[i:i + frame_length]
        rms = np.sqrt(np.mean(frame ** 2))
        energy.append(rms)

    energy = np.array(energy)

    if len(energy) < 10:
        return 120.0, []

    energy = (energy - np.mean(energy)) / (np.std(energy) + 1e-8)

    min_bpm = 60
    max_bpm = 200

    frames_per_minute = len(energy) * hop_length / len(data) * sample_rate
    min_lag = int(frames_per_minute / max_bpm)
    max_lag = int(frames_per_minute / min_bpm)

    autocorr = np.correlate(energy, energy, mode='full')
    autocorr = autocorr[len(autocorr) // 2:]

    if max_lag >= len(autocorr):
        max_lag = len(autocorr) - 1

    search_region = autocorr[min_lag:max_lag + 1]
    peak_idx = np.argmax(search_region) + min_lag

    bpm = 60.0 * sample_rate / (peak_idx * hop_length)

    if bpm < 70:
        bpm *= 2
    elif bpm > 180:
        bpm /= 2

    beat_interval = 60.0 / bpm
    total_duration = len(data) / sample_rate
    beat_times = []
    t = 0
    while t < total_duration:
        beat_times.append(round(t, 3))
        t += beat_interval

    return round(bpm, 1), beat_times[:50]


def detect_key_librosa(data, sample_rate):
    """РћРїСЂРµРґРµР»РµРЅРёРµ С‚РѕРЅР°Р»СЊРЅРѕСЃС‚Рё С‡РµСЂРµР· С…СЂРѕРјР°С‚РёС‡РµСЃРєРёР№ РїСЂРѕС„РёР»СЊ librosa"""
    if not HAS_LIBROSA:
        return detect_key_fallback(data, sample_rate)

    if len(data.shape) > 1:
        data = np.mean(data, axis=1)

    # РҐСЂРѕРјР°РіСЂР°РјРјР° С‡РµСЂРµР· librosa
    chroma = librosa.feature.chroma_stft(y=data, sr=sample_rate)
    chroma_mean = np.mean(chroma, axis=1)

    # РќРѕСЂРјР°Р»РёР·Р°С†РёСЏ
    chroma_mean = chroma_mean / (np.max(chroma_mean) + 1e-8)

    # РќРѕС‚С‹
    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    # РњР°Р¶РѕСЂ Рё РјРёРЅРѕСЂ РїСЂРѕС„РёР»Рё (Krumhansl-Schmuckler)
    major_profile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    minor_profile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

    # РќРѕСЂРјР°Р»РёР·Р°С†РёСЏ РїСЂРѕС„РёР»РµР№
    major_profile = np.array(major_profile) / np.sum(major_profile)
    minor_profile = np.array(minor_profile) / np.sum(minor_profile)

    best_score = -1
    best_key = 'C'
    best_mode = 'major'

    for i in range(12):
        # РЎРґРІРёРіР°РµРј РїСЂРѕС„РёР»Рё
        major_shifted = np.roll(major_profile, i)
        minor_shifted = np.roll(minor_profile, i)

        # РљРѕСЂСЂРµР»СЏС†РёСЏ
        major_score = np.correlate(chroma_mean, major_shifted, mode='valid')[0]
        minor_score = np.correlate(chroma_mean, minor_shifted, mode='valid')[0]

        if major_score > best_score:
            best_score = major_score
            best_key = note_names[i]
            best_mode = 'major'

        if minor_score > best_score:
            best_score = minor_score
            best_key = note_names[i]
            best_mode = 'minor'

    mode_str = 'Major' if best_mode == 'major' else 'Minor'
    return f"{best_key} {mode_str}", chroma_mean.tolist()


def detect_key_fallback(data, sample_rate):
    """Fallback РѕРїСЂРµРґРµР»РµРЅРёРµ С‚РѕРЅР°Р»СЊРЅРѕСЃС‚Рё (СЃС‚Р°СЂС‹Р№ РјРµС‚РѕРґ)"""
    if len(data.shape) > 1:
        data = np.mean(data, axis=1)

    fft_data = np.fft.rfft(data)
    freqs = np.fft.rfftfreq(len(data), 1.0 / sample_rate)

    note_freqs = {
        'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
        'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
        'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
    }

    chroma = np.zeros(12)
    note_names = list(note_freqs.keys())

    for i, (note, freq) in enumerate(note_freqs.items()):
        energy_sum = 0
        count = 0
        for octave_mult in [0.5, 1.0, 2.0, 4.0]:
            target_freq = freq * octave_mult
            mask = np.abs(freqs - target_freq) < target_freq * 0.05
            if np.any(mask):
                energy_sum += np.sum(np.abs(fft_data[mask]))
                count += np.sum(mask)
        chroma[i] = energy_sum / (count + 1)

    chroma = chroma / (np.max(chroma) + 1e-8)

    major_intervals = [0, 4, 7]
    minor_intervals = [0, 3, 7]

    best_score = -1
    best_key = 'C'
    best_mode = 'major'

    for i in range(12):
        major_score = sum(chroma[(i + interval) % 12] for interval in major_intervals)
        minor_score = sum(chroma[(i + interval) % 12] for interval in minor_intervals)

        if major_score > best_score:
            best_score = major_score
            best_key = note_names[i]
            best_mode = 'major'

        if minor_score > best_score:
            best_score = minor_score
            best_key = note_names[i]
            best_mode = 'minor'

    mode_str = 'Major' if best_mode == 'major' else 'Minor'
    return f"{best_key} {mode_str}", chroma.tolist()


def spectral_analysis_librosa(data, sample_rate):
    """Р Р°СЃС€РёСЂРµРЅРЅС‹Р№ СЃРїРµРєС‚СЂР°Р»СЊРЅС‹Р№ Р°РЅР°Р»РёР· С‡РµСЂРµР· librosa"""
    if not HAS_LIBROSA:
        return spectral_analysis_fallback(data, sample_rate)

    if len(data.shape) > 1:
        data = np.mean(data, axis=1)

    duration = len(data) / sample_rate

    # РЎРїРµРєС‚СЂР°Р»СЊРЅС‹Р№ С†РµРЅС‚СЂРѕРёРґ
    centroid = librosa.feature.spectral_centroid(y=data, sr=sample_rate)
    spectral_centroid = float(np.mean(centroid))

    # РЎРїРµРєС‚СЂР°Р»СЊРЅС‹Р№ СЂР°Р·Р±СЂРѕСЃ
    rolloff = librosa.feature.spectral_rolloff(y=data, sr=sample_rate)
    spectral_rolloff = float(np.mean(rolloff))

    # Spectral flatness
    flatness = librosa.feature.spectral_flatness(y=data)
    spectral_flatness = float(np.mean(flatness))

    # ZCR
    zcr = librosa.feature.zero_crossing_rate(y=data)
    zcr_mean = float(np.mean(zcr))

    # RMS
    rms = librosa.feature.rms(y=data)
    rms_mean = float(np.mean(rms))

    # РџРёРє
    peak = float(np.max(np.abs(data)))

    # MFCC (13 РєРѕСЌС„С„РёС†РёРµРЅС‚РѕРІ)
    mfccs = librosa.feature.mfcc(y=data, sr=sample_rate, n_mfcc=13)
    mfcc_means = [float(np.mean(mfccs[i])) for i in range(13)]

    # Р§Р°СЃС‚РѕС‚РЅС‹Рµ РїРѕР»РѕСЃС‹ С‡РµСЂРµР· librosa
    # Mel-СЃРїРµРєС‚СЂРѕРіСЂР°РјРјР°
    mel = librosa.feature.melspectrogram(y=data, sr=sample_rate, n_mels=128)
    mel_mean = np.mean(mel, axis=1)

    # Р‘Р°СЃСЃ (РїРµСЂРІС‹Рµ РјРµР»-С„РёР»СЊС‚СЂС‹)
    bass_energy = float(np.sum(mel_mean[:10])) / (float(np.sum(mel_mean)) + 1e-8)
    # РЎСЂРµРґРЅРёРµ
    mid_energy = float(np.sum(mel_mean[10:60])) / (float(np.sum(mel_mean)) + 1e-8)
    # Р’С‹СЃРѕРєРёРµ
    high_energy = float(np.sum(mel_mean[60:])) / (float(np.sum(mel_mean)) + 1e-8)

    # LUFS С‡РµСЂРµР· pyloudnorm approximation
    # K-weighted filter СѓРїСЂРѕС‰С‘РЅРЅС‹Р№
    lufs = 10 * np.log10(rms_mean ** 2 + 1e-10) - 0.691

    # Р”РёРЅР°РјРёС‡РµСЃРєРёР№ РґРёР°РїР°Р·РѕРЅ
    abs_data = np.abs(data)
    threshold = np.percentile(abs_data, 95)
    dynamic_range = 20 * np.log10(threshold / (rms_mean + 1e-8))

    return {
        'duration': round(duration, 2),
        'spectral_centroid': round(spectral_centroid, 1),
        'spectral_rolloff': round(spectral_rolloff, 1),
        'spectral_flatness': round(spectral_flatness, 4),
        'zcr': round(zcr_mean, 4),
        'rms': round(rms_mean, 6),
        'peak': round(peak, 6),
        'lufs': round(float(lufs), 1),
        'dynamic_range': round(float(dynamic_range), 1),
        'bassEnergy': round(bass_energy, 3),
        'midEnergy': round(mid_energy, 3),
        'highEnergy': round(high_energy, 3),
        'mfcc': [round(m, 4) for m in mfcc_means]
    }


def spectral_analysis_fallback(data, sample_rate):
    """Fallback СЃРїРµРєС‚СЂР°Р»СЊРЅС‹Р№ Р°РЅР°Р»РёР· (СЃС‚Р°СЂС‹Р№ РјРµС‚РѕРґ)"""
    if len(data.shape) > 1:
        data = np.mean(data, axis=1)

    duration = len(data) / sample_rate

    fft_data = np.abs(np.fft.rfft(data))
    freqs = np.fft.rfftfreq(len(data), 1.0 / sample_rate)

    spectral_centroid = np.sum(freqs * fft_data) / (np.sum(fft_data) + 1e-8)
    spectral_spread = np.sqrt(
        np.sum(((freqs - spectral_centroid) ** 2) * fft_data) / (np.sum(fft_data) + 1e-8)
    )

    zcr = np.sum(np.abs(np.diff(np.signbit(data)))) / (2 * len(data))
    rms = np.sqrt(np.mean(data ** 2))
    peak = np.max(np.abs(data))

    lufs = 10 * np.log10(rms ** 2 + 1e-10) - 0.691

    abs_data = np.abs(data)
    threshold = np.percentile(abs_data, 95)
    dynamic_range = 20 * np.log10(threshold / (rms + 1e-8))

    bass_mask = (freqs >= 20) & (freqs < 250)
    mid_mask = (freqs >= 250) & (freqs < 4000)
    high_mask = (freqs >= 4000) & (freqs < 20000)

    bass_energy = np.sum(fft_data[bass_mask]) / (np.sum(fft_data) + 1e-8)
    mid_energy = np.sum(fft_data[mid_mask]) / (np.sum(fft_data) + 1e-8)
    high_energy = np.sum(fft_data[high_mask]) / (np.sum(fft_data) + 1e-8)

    return {
        'duration': round(duration, 2),
        'spectral_centroid': round(float(spectral_centroid), 1),
        'spectral_spread': round(float(spectral_spread), 1),
        'zcr': round(float(zcr), 4),
        'rms': round(float(rms), 6),
        'peak': round(float(peak), 6),
        'lufs': round(float(lufs), 1),
        'dynamic_range': round(float(dynamic_range), 1),
        'bassEnergy': round(float(bass_energy), 3),
        'midEnergy': round(float(mid_energy), 3),
        'highEnergy': round(float(high_energy), 3)
    }


def detect_silence_regions(data, sample_rate, threshold_db=-40, min_duration=0.3):
    """Р”РµС‚РµРєС†РёСЏ С‚РёС€РёРЅС‹ РґР»СЏ СЃРµРіРјРµРЅС‚Р°С†РёРё"""
    if len(data.shape) > 1:
        data = np.mean(data, axis=1)

    if HAS_LIBROSA:
        # РСЃРїРѕР»СЊР·СѓРµРј librosa РґР»СЏ Р±РѕР»РµРµ С‚РѕС‡РЅРѕР№ РґРµС‚РµРєС†РёРё
        rms = librosa.feature.rms(y=data, frame_length=2048, hop_length=512)[0]
        times = librosa.frames_to_time(np.arange(len(rms)), sr=sample_rate, hop_length=512)
        threshold = 10 ** (threshold_db / 20)
        is_silent = rms < threshold
    else:
        threshold = 10 ** (threshold_db / 20)
        window_size = int(0.05 * sample_rate)
        hop = window_size // 2

        energy = []
        times = []

        for i in range(0, len(data) - window_size, hop):
            window_rms = np.sqrt(np.mean(data[i:i + window_size] ** 2))
            energy.append(window_rms)
            times.append(i / sample_rate)

        energy = np.array(energy)
        is_silent = energy < threshold

    # РќР°С…РѕРґРёРј СЂРµРіРёРѕРЅС‹ С‚РёС€РёРЅС‹
    silence_regions = []
    in_silence = False
    start_idx = 0

    for i, silent in enumerate(is_silent):
        if silent and not in_silence:
            in_silence = True
            start_idx = i
        elif not silent and in_silence:
            in_silence = False
            duration = (i - start_idx) * (times[1] - times[0]) if len(times) > 1 else 0.05
            if duration >= min_duration:
                silence_regions.append({
                    'start': round(times[start_idx], 2),
                    'end': round(times[i], 2),
                    'duration': round(duration, 2)
                })

    return silence_regions


def analyze_audio(input_path):
    """РџРѕР»РЅС‹Р№ Р°РЅР°Р»РёР· Р°СѓРґРёРѕС„Р°Р№Р»Р°"""
    try:
        print(f"РђРЅР°Р»РёР·: {input_path}", flush=True)

        # Р—Р°РіСЂСѓР·РєР° С‡РµСЂРµР· librosa РµСЃР»Рё РґРѕСЃС‚СѓРїРµРЅ
        if HAS_LIBROSA:
            data, sample_rate = librosa.load(input_path, sr=None, mono=False)
            # librosa РІРѕР·РІСЂР°С‰Р°РµС‚ (channels, samples) - С‚СЂР°РЅСЃРїРѕРЅРёСЂСѓРµРј
            if len(data.shape) > 1:
                data = data.T
        else:
            data, sample_rate = sf.read(input_path)

        print(f"РЎСЌРјРїР»СЂРµР№С‚: {sample_rate}, РљР°РЅР°Р»С‹: {1 if len(data.shape) == 1 else data.shape[1]}, РЎСЌРјРїР»РѕРІ: {len(data)}", flush=True)

        print("Р”РµС‚РµРєС†РёСЏ BPM (librosa)...", flush=True)
        bpm, beat_times = detect_bpm_librosa(data, sample_rate)

        print("РћРїСЂРµРґРµР»РµРЅРёРµ С‚РѕРЅР°Р»СЊРЅРѕСЃС‚Рё (librosa)...", flush=True)
        key, chroma = detect_key_librosa(data, sample_rate)

        print("РЎРїРµРєС‚СЂР°Р»СЊРЅС‹Р№ Р°РЅР°Р»РёР· (librosa)...", flush=True)
        spectral = spectral_analysis_librosa(data, sample_rate)

        print("Р”РµС‚РµРєС†РёСЏ С‚РёС€РёРЅС‹...", flush=True)
        silence_regions = detect_silence_regions(data, sample_rate)

        result = {
            'bpm': bpm,
            'key': key,
            'chroma': chroma,
            'beatTimes': beat_times,
            'silenceRegions': silence_regions[:10],
            'librosaAvailable': HAS_LIBROSA,
            **spectral
        }

        print(json.dumps(result), flush=True)
        return result

    except Exception as e:
        print(f"РћС€РёР±РєР° Р°РЅР°Р»РёР·Р°: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ: python analyze.py input.wav")
        sys.exit(1)

    input_path = sys.argv[1]
    analyze_audio(input_path)
