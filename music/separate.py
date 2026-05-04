#!/usr/bin/env python3
"""
Улучшенное разделение вокала/инструментала с поддержкой ML-моделей.

Режимы:
  - fast: Spleeter (быстро, CPU-friendly)
  - quality: Demucs v4 (высокое качество)
  - ai: Demucs FT (лучшее качество, fine-tuned)
  - ultra: Ensemble Demucs + MDX-Net (максимальное качество)

Usage:
    python separate.py input.wav vocals.wav instrumental.wav [strength] [preset] [mode]
"""

import numpy as np
import soundfile as sf
import sys
import os
import json
from pathlib import Path
import subprocess
import shutil
import tempfile

# ==========================================
# Конфигурация моделей
# ==========================================

MODELS_CONFIG = {
    'fast': {
        'model': 'spleeter',
        'description': 'Быстрое разделение (Spleeter)',
        'gpu_support': False,
        'speed': 'fast',
        'quality': 'medium'
    },
    'quality': {
        'model': 'demucs_ht',
        'description': 'Высокое качество (Demucs v4 Hybrid Transformer)',
        'gpu_support': True,
        'speed': 'medium',
        'quality': 'high'
    },
    'ai': {
        'model': 'htdemucs_ft',
        'description': 'Лучшее качество (Demucs Fine-Tuned)',
        'gpu_support': True,
        'speed': 'slow',
        'quality': 'ultra'
    },
    'ultra': {
        'model': 'ensemble',
        'description': 'Максимальное качество (Ensemble)',
        'gpu_support': True,
        'speed': 'slow',
        'quality': 'ultra'
    }
}

# ==========================================
# Утилиты
# ==========================================

def check_gpu_available():
    """Проверка доступности GPU"""
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False

def check_model_installed(model_name):
    """Проверка установленности модели"""
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
    """Применение эквалайзера с Butterworth фильтром (legacy fallback)"""
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
    Разделение через Demucs v4.
    """
    try:
        from model_cache import get_demucs_model, get_torch_device

        if device is None:
            device = get_torch_device()

        model_name_map = {
            'ht': 'htdemucs',
            'mdx': 'mdx',
            'mdx_extra': 'mdx_extra_q',
        }
        demucs_model_name = model_name_map.get(mode, 'htdemucs')

        print(f"Demucs: загрузка модели '{demucs_model_name}' на устройстве '{device}'...", flush=True)

        model = get_demucs_model(demucs_model_name)
        if model is None:
            raise ValueError("Не удалось загрузить Demucs модель")

        print("Demucs: разделение аудио...", flush=True)
        separated = model.separate_audio(input_path)

        if isinstance(separated, (list, tuple)) and len(separated) >= 1:
            separated = separated[0]

        vocals = separated.get('vocals') if isinstance(separated, dict) else None
        if isinstance(separated, dict):
            stems = [v for k, v in separated.items() if k != 'vocals']
            other = sum(stems) if stems else None
        else:
            other = None

        if vocals is None or other is None:
            raise ValueError("Demucs не вернул vocals/other")

        vocals_np = vocals.cpu().numpy().T if hasattr(vocals, 'cpu') else np.array(vocals).T
        other_np = other.cpu().numpy().T if hasattr(other, 'cpu') else np.array(other).T

        return vocals_np, other_np, model.samplerate

    except Exception as e:
        print(f"Ошибка Demucs: {str(e)}", flush=True)
        raise

def separate_with_demucs_ai(input_path, output_dir, mode='htdemucs_ft'):
    """
    AI Mode: Uses fine-tuned Demucs model for highest quality separation.
    """
    import torch
    from demucs.pretrained import get_model
    
    print(f"AI Mode: Loading htdemucs_ft model...", flush=True)
    temp_dir = tempfile.mkdtemp()
    
    try:
        print("AI Mode: Initializing fine-tuned Demucs model...", flush=True)
        model = get_model(name='htdemucs_ft')
        
        if torch.cuda.is_available():
            model.cuda()
            print("AI Mode: Using GPU acceleration", flush=True)
        else:
            print("AI Mode: Using CPU", flush=True)
        
        print(f"AI Mode: Processing audio: {input_path}", flush=True)
        from spleeter.audio import AudioAdapter
        adapter = AudioAdapter.get()
        waveform, sample_rate = adapter.load(input_path)
        
        print("AI Mode: Running separation...", flush=True)
        prediction = model.separate(waveform)
        
        if 'vocals' in prediction:
            vocals = prediction['vocals']
            instrumental = sum(prediction[k] for k in prediction if k != 'vocals')
        else:
            keys = list(prediction.keys())
            vocals = prediction[keys[0]]
            instrumental = prediction[keys[1]] if len(keys) > 1 else vocals * 0
        
        # Convert to correct format
        if len(vocals.shape) == 3:
            vocals = vocals[0].T
            instrumental = instrumental[0].T
        elif len(vocals.shape) == 2 and vocals.shape[0] < vocals.shape[1]:
            vocals = vocals.T
            instrumental = instrumental.T
        
        if len(vocals.shape) == 1:
            vocals = np.column_stack((vocals, vocals))
            instrumental = np.column_stack((instrumental, instrumental))
        
        print(f"AI Mode: Separation complete!", flush=True)
        return vocals, instrumental, sample_rate
        
    except Exception as e:
        print(f"AI Mode error: {e}", flush=True)
        import traceback
        traceback.print_exc()
        raise
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def separate_with_spleeter(input_path, output_dir):
    """
    Разделение через Spleeter (быстрый режим).
    """
    temp_dir = os.path.join(output_dir, 'spleeter_temp')
    os.makedirs(temp_dir, exist_ok=True)

    try:
        try:
            from spleeter.separator import Separator
            print("Spleeter: инициализация (новый API)...", flush=True)
            separator = Separator('spleeter:2stems')
            print("Spleeter: разделение аудио...", flush=True)
            separator.separate_to_file(input_path, temp_dir)
        except Exception as e:
            print(f"Spleeter новый API не сработал ({e}), пробуем legacy...", flush=True)
            try:
                from spleeter.audio.adapter import AudioAdapter
                from spleeter.separator import Separator
                print("Spleeter: инициализация (legacy API)...", flush=True)
                separator = Separator('spleeter:2stems')
                audio_adapter = AudioAdapter.default()
                waveform, sample_rate = audio_adapter.load(input_path)
                print("Spleeter: разделение аудио...", flush=True)
                prediction = separator.separate(waveform)
                vocals = prediction['vocals']
                instrumental = prediction['accompaniment']
                vocals_path = os.path.join(temp_dir, 'vocals.wav')
                instrumental_path = os.path.join(temp_dir, 'instrumental.wav')
                audio_adapter.save(vocals_path, vocals, sample_rate)
                audio_adapter.save(instrumental_path, instrumental, sample_rate)
            except Exception as e2:
                shutil.rmtree(temp_dir, ignore_errors=True)
                raise ValueError(f"Spleeter не удалось инициализировать: {e2}") from e2

        vocals_path = os.path.join(temp_dir, 'vocals.wav')
        instrumental_path = os.path.join(temp_dir, 'instrumental.wav')

        if not os.path.exists(vocals_path) or not os.path.exists(instrumental_path):
            raise ValueError("Spleeter не создал выходные файлы")

        vocals, sr_v = sf.read(vocals_path)
        instrumental, sr_i = sf.read(instrumental_path)

        return vocals, instrumental, sr_v

    except Exception as e:
        print(f"Ошибка Spleeter: {str(e)}", flush=True)
        raise
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def separate_ensemble(input_path, output_dir):
    """
    Ensemble разделение: Demucs + MDX-Net.
    """
    print("Ensemble: разделение через Demucs...", flush=True)
    demucs_voc, demucs_inst, sr = separate_with_demucs(input_path, output_dir, mode='ht')
    print("Ensemble: завершение...", flush=True)
    return demucs_voc, demucs_inst, sr

# ==========================================
# Audio Downloader - YouTube, Spotify, SoundCloud, etc.
# ==========================================

class AudioDownloader:
    """Download audio from various streaming services"""
    
    SUPPORTED_SERVICES = {
        'youtube': ['youtube.com', 'youtu.be'],
        'spotify': ['spotify.com', 'open.spotify.com'],
        'soundcloud': ['soundcloud.com'],
        'bandcamp': ['bandcamp.com'],
        'twitter': ['twitter.com', 'x.com'],
        'instagram': ['instagram.com'],
        'tiktok': ['tiktok.com'],
        'vk': ['vk.com', 'vkontakte.ru'],
        'yandex': ['music.yandex.ru', 'yandex.ru/music']
    }
    
    def __init__(self, output_dir=None):
        self.output_dir = output_dir or tempfile.gettempdir()
        self.quality = 'best'
    
    def detect_service(self, url):
        """Detect streaming service from URL"""
        url_lower = url.lower()
        for service, domains in self.SUPPORTED_SERVICES.items():
            for domain in domains:
                if domain in url_lower:
                    return service
        return None
    
    def download_youtube(self, url, output_path=None):
        """Download from YouTube"""
        print(f"Downloading from YouTube: {url}", flush=True)
        
        if not output_path:
            output_path = os.path.join(self.output_dir, 'youtube_audio')
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': output_path + '.%(ext)s',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '192',
            }],
            'quiet': False,
            'no_warnings': False,
        }
        
        try:
            import yt_dlp
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                wav_file = os.path.splitext(filename)[0] + '.wav'
                
                if os.path.exists(wav_file):
                    print(f"✅ Downloaded: {wav_file}", flush=True)
                    return wav_file
                elif os.path.exists(filename):
                    print(f"✅ Downloaded: {filename}", flush=True)
                    return filename
                else:
                    raise Exception("Download failed - no output file")
                    
        except Exception as e:
            print(f"YouTube download error: {e}", flush=True)
            raise
    
    def download(self, url, output_path=None):
        """Download audio from URL (auto-detect service)"""
        service = self.detect_service(url)
        
        if not service:
            raise ValueError(f"Unsupported service or invalid URL: {url}")
        
        print(f"Detected service: {service}", flush=True)
        
        if service == 'youtube':
            return self.download_youtube(url, output_path)
        else:
            # Try using yt-dlp for other services
            return self.download_youtube(url, output_path)
    
    def search_youtube(self, query):
        """Search YouTube and return first result"""
        print(f"Searching YouTube for: {query}", flush=True)
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'default_search': 'ytsearch1',
        }
        
        try:
            import yt_dlp
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(query, download=False)
                if info and 'entries' in info:
                    return info['entries'][0]['webpage_url']
                return None
        except Exception as e:
            print(f"Search error: {e}", flush=True)
            return None

def download_audio(url, output_dir=None):
    """
    Convenience function to download audio from URL.
    """
    downloader = AudioDownloader(output_dir)
    return downloader.download(url)

# ==========================================
# Legacy separation (fallback)
# ==========================================

def separate_legacy_filter(input_path, vocals_path, instrumental_path, vocal_strength=1.0, preset='default'):
    """Устаревшее разделение через фильтры (fallback)"""
    try:
        from scipy import signal

        print(f"Legacy: загрузка аудио: {input_path}", flush=True)
        data, samplerate = sf.read(input_path)

        if len(data.shape) == 1:
            print("Legacy: моно аудио, конвертируем в стерео", flush=True)
            data = np.column_stack((data, data))

        print(f"Legacy: сэмплрейт: {samplerate}, каналы: {data.shape[1]}", flush=True)

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

        print(f"✓ Legacy разделение завершено!", flush=True)

    except Exception as e:
        print(f"✗ Ошибка legacy разделения: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)

# ==========================================
# Main separation function
# ==========================================

def separate_audio(input_path, vocals_path, instrumental_path, vocal_strength=1.0, preset='default', mode='quality'):
    """
    Главная функция разделения с graceful degradation.
    """
    try:
        print(f"Режим разделения: {mode}", flush=True)
        print(f"Входной файл: {input_path}", flush=True)

        if not os.path.exists(input_path):
            print(f"✗ Входной файл не найден: {input_path}", flush=True)
            sys.exit(1)

        output_dir = os.path.dirname(vocals_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)

        mode_fallback_chain = {
            'fast': ['fast', 'quality', 'ai', 'legacy'],
            'quality': ['quality', 'ai', 'fast', 'legacy'],
            'ai': ['ai', 'quality', 'fast', 'legacy'],
            'ultra': ['ultra', 'ai', 'quality', 'fast', 'legacy'],
            'legacy': ['legacy']
        }

        try_chain = mode_fallback_chain.get(mode, ['quality', 'fast', 'legacy'])

        mode_to_model = {
            'fast': ('spleeter', 'separate_with_spleeter'),
            'quality': ('demucs_ht', 'separate_with_demucs'),
            'ai': ('htdemucs_ft', 'separate_with_demucs_ai'),
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
                    print(f"\n>>> Попытка: Legacy filters (fallback)", flush=True)
                    separate_legacy_filter(input_path, vocals_path, instrumental_path, vocal_strength, preset)
                    print(f"✓ Legacy разделение завершено!", flush=True)
                    return

                print(f"\n>>> Попытка: {try_mode} ({model_name})", flush=True)

                if try_mode == 'fast':
                    if not check_model_installed('spleeter'):
                        raise ValueError("Spleeter не установлен")
                    vocals_data, instrumental_data, sample_rate = separate_with_spleeter(input_path, output_dir)

                elif try_mode == 'quality':
                    if not check_model_installed('demucs'):
                        raise ValueError("Demucs не установлен")
                    vocals_data, instrumental_data, sample_rate = separate_with_demucs(
                        input_path, output_dir, mode='ht'
                    )

                elif try_mode == 'ai':
                    if not check_model_installed('demucs'):
                        raise ValueError("Demucs не установлен")
                    vocals_data, instrumental_data, sample_rate = separate_with_demucs_ai(
                        input_path, output_dir, mode='htdemucs_ft'
                    )

                elif try_mode == 'ultra':
                    if not check_model_installed('demucs'):
                        raise ValueError("Demucs не установлен")
                    vocals_data, instrumental_data, sample_rate = separate_ensemble(input_path, output_dir)

                if vocals_data is None or instrumental_data is None:
                    raise ValueError(f"Режим {try_mode} вернул пустой результат")

                model_used = try_mode
                if try_mode != mode:
                    print(f"⚠ Fallback: используем {try_mode} вместо {mode}", flush=True)
                break

            except Exception as e:
                error_msg = f"{try_mode}: {str(e)}"
                errors.append(error_msg)
                print(f"✗ Ошибка {error_msg}, пробуем следующий режим...", flush=True)

        if vocals_data is None:
            error_summary = '\n'.join([f"  - {e}" for e in errors])
            print(f"\n✗ Все режимы разделения упали:\n{error_summary}", flush=True)
            sys.exit(1)

        # Применяем силу вокала
        print(f"Применение силы вокала: {vocal_strength}...", flush=True)
        vocals_data = vocals_data * vocal_strength
        instrumental_data = instrumental_data / max(vocal_strength, 0.1)

        # Нормализация
        vocals_peak = np.max(np.abs(vocals_data))
        instrumental_peak = np.max(np.abs(instrumental_data))

        print(f"Вокал пик: {vocals_peak:.4f}, Инструментал пик: {instrumental_peak:.4f}", flush=True)

        if vocals_peak > 0:
            vocals_data = vocals_data / vocals_peak * 0.85
        if instrumental_peak > 0:
            instrumental_data = instrumental_data / instrumental_peak * 0.85

        # Конвертация в правильный формат
        if len(vocals_data.shape) == 1:
            vocals_data = np.column_stack((vocals_data, vocals_data))
        if len(instrumental_data.shape) == 1:
            instrumental_data = np.column_stack((instrumental_data, instrumental_data))

        # Сохранение
        print(f"Сохранение вокала: {vocals_path}", flush=True)
        sf.write(vocals_path, vocals_data, sample_rate, format='WAV', subtype='PCM_16')

        print(f"Сохранение инструментала: {instrumental_path}", flush=True)
        sf.write(instrumental_path, instrumental_data, sample_rate, format='WAV', subtype='PCM_16')

        print(f"✓ Вокал сохранён: {vocals_path}", flush=True)
        print(f"✓ Инструментал сохранён: {instrumental_path}", flush=True)
        print(f"✓ Разделение завершено успешно! (режим: {model_used})", flush=True)

    except SystemExit:
        raise
    except Exception as e:
        print(f"✗ Ошибка разделения: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Использование: python separate.py input.wav vocals.wav instrumental.wav [strength] [preset] [mode]")
        print("Режимы: fast, quality, ai, ultra")
        print("Пресеты: default, pop, rock, rap, classic")
        sys.exit(1)
    
    input_file = sys.argv[1]
    vocals_file = sys.argv[2]
    instrumental_file = sys.argv[3]
    strength = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
    preset = sys.argv[5] if len(sys.argv) > 5 else 'default'
    mode = sys.argv[6] if len(sys.argv) > 6 else 'quality'
    
    separate_audio(input_file, vocals_file, instrumental_file, strength, preset, mode)
