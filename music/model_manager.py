#!/usr/bin/env python3
"""
Утилита для управления ML-моделями и проверки системы.

Команды:
    python model_manager.py status          - Статус моделей и системы
    python model_manager.py download        - Скачать все модели
    python model_manager.py clear-cache     - Очистить кэш моделей
    python model_manager.py test            - Тестовое разделение
    python model_manager.py benchmark       - Бенчмарк производительности
    python model_manager.py update-models   - Обновить модели до последних версий
"""

import sys
import os
import json
import shutil
import tempfile
import subprocess
from pathlib import Path
import requests
from urllib.parse import urlparse


def _get_cache_dirs():
    """Р’РѕР·РІСЂР°С‰Р°РµС‚ СЃРїРёСЃРѕРє РєСЌС€-РґРёСЂРµРєС‚РѕСЂРёР№ РјРѕРґРµР»РµР№ РІ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё РѕС‚ РћРЎ."""
    if sys.platform == 'win32':
        user_profile = Path(os.environ.get('USERPROFILE', Path.home()))
        return [
            user_profile / '.cache' / 'torch' / 'hub' / 'checkpoints',
            user_profile / '.cache' / 'demucs',
        ]
    else:
        return [
            Path.home() / '.cache' / 'torch' / 'hub' / 'checkpoints',
            Path.home() / '.cache' / 'demucs',
        ]

# ==========================================
# РџСЂРѕРІРµСЂРєР° СЃРёСЃС‚РµРјС‹
# ==========================================

def check_system():
    """РџСЂРѕРІРµСЂРєР° СЃРёСЃС‚РµРјС‹ Рё Р·Р°РІРёСЃРёРјРѕСЃС‚РµР№"""
    info = {
        'python_version': sys.version,
        'platform': sys.platform,
        'gpu': {
            'available': False,
            'name': None,
            'torch_cuda': False
        },
        'libraries': {},
        'models': {}
    }

    # GPU РїСЂРѕРІРµСЂРєР°
    try:
        import torch
        info['libraries']['torch'] = torch.__version__
        info['gpu']['torch_cuda'] = torch.cuda.is_available()
        if torch.cuda.is_available():
            info['gpu']['available'] = True
            info['gpu']['name'] = torch.cuda.get_device_name(0)
    except ImportError:
        info['libraries']['torch'] = 'NOT INSTALLED'

    # Demucs
    try:
        import demucs
        info['libraries']['demucs'] = getattr(demucs, '__version__', 'installed')
    except ImportError:
        info['libraries']['demucs'] = 'NOT INSTALLED'

    # librosa
    try:
        import librosa
        info['libraries']['librosa'] = librosa.__version__
    except ImportError:
        info['libraries']['librosa'] = 'NOT INSTALLED'

    # scipy
    try:
        import scipy
        info['libraries']['scipy'] = scipy.__version__
    except ImportError:
        info['libraries']['scipy'] = 'NOT INSTALLED'

    # numpy
    try:
        import numpy
        info['libraries']['numpy'] = numpy.__version__
    except ImportError:
        info['libraries']['numpy'] = 'NOT INSTALLED'

    # soundfile
    try:
        import soundfile
        info['libraries']['soundfile'] = soundfile.__version__
    except ImportError:
        info['libraries']['soundfile'] = 'NOT INSTALLED'

    return info


def check_models_status():
    """РџСЂРѕРІРµСЂРєР° СЃС‚Р°С‚СѓСЃР° ML-РјРѕРґРµР»РµР№"""
    status = {
        'demucs_ht': {'installed': False, 'path': None},
        'demucs_mdx': {'installed': False, 'path': None},
        'spleeter_2stems': {'installed': False, 'path': None},
        'spleeter_4stems': {'installed': False, 'path': None}
    }

    # РџСЂРѕРІРµСЂСЏРµРј РєСЌС€ РјРѕРґРµР»РµР№
    cache_dirs = _get_cache_dirs()

    for cache_dir in cache_dirs:
        if cache_dir.exists():
            for model_file in cache_dir.rglob('*'):
                if model_file.is_file():
                    name = model_file.stem.lower()
                    if 'htdemucs' in name or 'ht' in name:
                        status['demucs_ht']['installed'] = True
                        status['demucs_ht']['path'] = str(model_file)
                    if 'mdx' in name:
                        status['demucs_mdx']['installed'] = True
                        status['demucs_mdx']['path'] = str(model_file)

    return status


def get_runtime_models_status():
    """Runtime-статус моделей на основе реального окружения и текущих fallback-правил."""
    libs = check_system()['libraries']

    demucs_ready = libs.get('demucs') != 'NOT INSTALLED'
    spleeter_ready = False
    try:
        from spleeter.separator import Separator  # noqa: F401
        spleeter_ready = True
    except Exception:
        spleeter_ready = False

    return {
        'modern_ensemble': {
            'available': demucs_ready,
            'backend': 'local-demucs-blend',
            'note': 'Fully local blend of available Demucs-family models'
        },
        'demucs': {
            'available': demucs_ready,
            'backend': 'htdemucs',
            'note': 'Native local Hybrid Transformer model'
        },
        'openunmix': {
            'available': demucs_ready,
            'backend': 'htdemucs',
            'note': 'Local U-Net style profile without external services'
        },
        'asteroid': {
            'available': demucs_ready,
            'backend': 'mdx',
            'note': 'Local ConvTasNet-style profile without external services'
        },
        'spleeter': {
            'available': demucs_ready,
            'backend': 'htdemucs',
            'note': 'Fast local profile without Spleeter dependency'
        },
        'ensemble': {
            'available': demucs_ready,
            'backend': 'local-demucs-blend',
            'note': 'Fully local blended profile'
        },
        'mdxnet': {
            'available': demucs_ready,
            'backend': 'mdx',
            'note': 'Local MDX-style profile'
        },
        'htdemucs_ft': {
            'available': demucs_ready,
            'backend': 'htdemucs_ft',
            'note': 'Fine-tuned local Demucs profile'
        },
        'bandit': {
            'available': demucs_ready,
            'backend': 'htdemucs_6s',
            'note': 'Local 6-source research-style profile'
        },
        'melband': {
            'available': demucs_ready,
            'backend': 'htdemucs_ft',
            'note': 'Local roformer-style profile'
        },
        'scnet': {
            'available': demucs_ready,
            'backend': 'htdemucs',
            'note': 'Local compact spectral profile'
        },
        'vrnet': {
            'available': demucs_ready,
            'backend': 'mdx',
            'note': 'Local VR-style profile'
        },
        'uvr5_mdx': {
            'available': demucs_ready,
            'backend': 'mdx',
            'note': 'Local UVR-style MDX profile without UVR5'
        },
        'uvr5_vr': {
            'available': demucs_ready,
            'backend': 'htdemucs_6s',
            'note': 'Local UVR-style VR profile without UVR5'
        },
        'lalal': {
            'available': demucs_ready,
            'backend': 'htdemucs_ft',
            'note': 'Local high-quality profile replacing cloud access'
        },
        'legacy': {
            'available': True,
            'backend': 'legacy'
        }
    }


def print_system_status():
    """Р’С‹РІРѕРґ СЃС‚Р°С‚СѓСЃР° СЃРёСЃС‚РµРјС‹"""
    info = check_system()
    models = check_models_status()

    print("=" * 60, flush=True)
    print("Voice Remover Pro - System Status", flush=True)
    print("=" * 60, flush=True)

    print(f"\nPython: {info['python_version']}", flush=True)
    print(f"Platform: {info['platform']}", flush=True)

    print(f"\nGPU:", flush=True)
    print(f"   Available: {'Yes' if info['gpu']['available'] else 'No (CPU only)'}", flush=True)
    if info['gpu']['name']:
        print(f"   Device: {info['gpu']['name']}", flush=True)

    print(f"\nLibraries:", flush=True)
    for lib, version in info['libraries'].items():
        status_icon = '[OK]' if version != 'NOT INSTALLED' else '[MISSING]'
        print(f"   {status_icon} {lib}: {version}", flush=True)

    print(f"\nModels:", flush=True)
    for model, m_info in models.items():
        status_icon = '[OK]' if m_info['installed'] else '[NOT DOWNLOADED]'
        print(f"   {status_icon} {model}", flush=True)

    print("\n" + "=" * 60, flush=True)


# ==========================================
# РЈРїСЂР°РІР»РµРЅРёРµ РјРѕРґРµР»СЏРјРё
# ==========================================

def download_models():
    """РЎРєР°С‡Р°С‚СЊ РІСЃРµ ML-РјРѕРґРµР»Рё"""
    print("Downloading models...", flush=True)

    try:
        import torch
        from demucs.api import Pretrained

        # Demucs HT
        print("\n1. Downloading Demucs v4 Hybrid Transformer...", flush=True)
        try:
            model = Pretrained(name='htdemucs', device='cpu')
            print("   [OK] htdemucs downloaded", flush=True)
        except Exception as e:
            print(f"   [ERROR] htdemucs error: {e}", flush=True)

        # Demucs MDX
        print("\n2. Downloading Demucs MDX...", flush=True)
        try:
            model = Pretrained(name='mdx', device='cpu')
            print("   [OK] mdx downloaded", flush=True)
        except Exception as e:
            print(f"   [ERROR] mdx error: {e}", flush=True)

        print("\n[OK] Models download complete!", flush=True)

    except ImportError as e:
        print(f"[ERROR] Error: {e}", flush=True)
        print("Install demucs first: pip install demucs", flush=True)
        sys.exit(1)


def clear_cache():
    """РћС‡РёСЃС‚РёС‚СЊ РєСЌС€ РјРѕРґРµР»РµР№"""
    cache_dirs = _get_cache_dirs()
    # Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ РѕС‡РёС‰Р°РµРј СЂРѕРґРёС‚РµР»СЊСЃРєРёРµ torch/demucs РґРёСЂРµРєС‚РѕСЂРёРё
    torch_cache = _get_cache_dirs()[0].parent.parent.parent  # .cache/torch
    demucs_cache = _get_cache_dirs()[1].parent               # .cache/demucs
    extra_dirs = [torch_cache, demucs_cache]
    all_dirs = list(set(cache_dirs + extra_dirs))

    total_size = 0
    for cache_dir in all_dirs:
        if cache_dir.exists():
            size = sum(f.stat().st_size for f in cache_dir.rglob('*') if f.is_file())
            total_size += size
            print(f"Removing: {cache_dir} ({size / 1024 / 1024:.1f} MB)", flush=True)
            shutil.rmtree(cache_dir, ignore_errors=True)

    print(f"[OK] Cache cleared: {total_size / 1024 / 1024:.1f} MB freed", flush=True)


# ==========================================
# РўРµСЃС‚РёСЂРѕРІР°РЅРёРµ
# ==========================================

def test_separation(test_audio_path=None):
    """РўРµСЃС‚РѕРІРѕРµ СЂР°Р·РґРµР»РµРЅРёРµ"""
    print("Testing separation...", flush=True)

    if not test_audio_path:
        print("No test audio specified, creating synthetic test...", flush=True)
        # РЎРѕР·РґР°С‘Рј С‚РµСЃС‚РѕРІС‹Р№ СЃРёРіРЅР°Р»
        import numpy as np
        import soundfile as sf

        sr = 44100
        duration = 5  # СЃРµРєСѓРЅРґ
        t = np.linspace(0, duration, int(sr * duration))

        # РЎРёРЅС‚РµС‚РёС‡РµСЃРєРёР№ СЃРёРіРЅР°Р»: РІРѕРєР°Р» + РёРЅСЃС‚СЂСѓРјРµРЅС‚С‹
        vocal = 0.3 * np.sin(2 * np.pi * 440 * t)  # A4
        instrumental = 0.2 * np.sin(2 * np.pi * 220 * t) + 0.1 * np.sin(2 * np.pi * 880 * t)
        mixed = vocal + instrumental

        test_path = os.path.join(tempfile.gettempdir(), 'test_audio.wav')
        sf.write(test_path, mixed, sr)
        test_audio_path = test_path
        print(f"Created test audio: {test_path}", flush=True)

    # РџСЂРѕР±СѓРµРј СЂР°Р·РґРµР»РµРЅРёРµ
    try:
        from separate import separate_audio

        vocals_path = os.path.join(tempfile.gettempdir(), 'test_vocals.wav')
        instrumental_path = os.path.join(tempfile.gettempdir(), 'test_instrumental.wav')

        print(f"\nRunning separation with Demucs...", flush=True)
        separate_audio(test_audio_path, vocals_path, instrumental_path, mode='quality')

        if os.path.exists(vocals_path) and os.path.exists(instrumental_path):
            print("[OK] Separation test PASSED", flush=True)
            print(f"   Vocals: {vocals_path}", flush=True)
            print(f"   Instrumental: {instrumental_path}", flush=True)
        else:
            print("[ERROR] Separation test FAILED - files not created", flush=True)

    except Exception as e:
        print(f"[ERROR] Separation test error: {e}", flush=True)
        import traceback
        traceback.print_exc()


def benchmark():
    """Р‘РµРЅС‡РјР°СЂРє РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё"""
    print("Running benchmark...", flush=True)

    import numpy as np
    import time

    sr = 44100
    durations = [10, 30, 60]  # СЃРµРєСѓРЅРґ

    for duration in durations:
        print(f"\nDuration: {duration}s", flush=True)

        # РЎРѕР·РґР°С‘Рј С‚РµСЃС‚РѕРІС‹Р№ СЃРёРіРЅР°Р»
        t = np.linspace(0, duration, int(sr * duration))
        signal = 0.3 * np.sin(2 * np.pi * 440 * t)

        test_path = os.path.join(tempfile.gettempdir(), f'bench_{duration}s.wav')
        import soundfile as sf
        sf.write(test_path, signal, sr)

        # Р‘РµРЅС‡РјР°СЂРє Demucs
        try:
            from demucs.api import Pretrained

            start = time.time()
            model = Pretrained(name='htdemucs', device='cpu')
            model_load_time = time.time() - start
            print(f"   Model load: {model_load_time:.2f}s", flush=True)

            start = time.time()
            separated = model.separate_audio(test_path)
            separation_time = time.time() - start
            print(f"   Separation time: {separation_time:.2f}s", flush=True)
            print(f"   Speed: {duration / separation_time:.2f}x realtime", flush=True)

        except Exception as e:
            print(f"   [ERROR] Error: {e}", flush=True)

        # Cleanup
        if os.path.exists(test_path):
            os.remove(test_path)


# ==========================================
# CLI
# ==========================================

def main():
    if len(sys.argv) < 2:
        print("Usage: python model_manager.py <command>", flush=True)
        print("Commands: status, download, clear-cache, test, benchmark", flush=True)
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == 'status':
        print_system_status()

    elif command == 'download':
        download_models()

    elif command == 'clear-cache':
        clear_cache()

    elif command == 'test':
        test_path = sys.argv[2] if len(sys.argv) > 2 else None
        test_separation(test_path)

    elif command == 'benchmark':
        benchmark()

    else:
        print(f"[ERROR] Unknown command: {command}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
