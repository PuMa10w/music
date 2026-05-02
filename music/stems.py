#!/usr/bin/env python3
"""
Локальное разделение аудио на стемы с поддержкой лучших ML-моделей.

Доступные модели:
  - htdemucs (базовая)
  - htdemucs_ft (fine-tuned, лучше качество)
  - htdemucs_6s (быстрая, 6 стемов)
  - mdx (MDX-Net локально)

Режимы разделения:
  --mode all: все стемы (vocals, drums, bass, other)
  --mode vocals_only: только вокал
  --mode instrumental_only: только инструментал
  --mode mix: микс с регулировкой силы вокала (--vocal-strength)

Usage:
    python stems.py input.wav output_dir [--model MODEL] [--mode MODE] [--vocal-strength STRENGTH]
"""

import argparse
import os
import sys
import json
import traceback

MODEL_ALIASES = {
    'modern_ensemble': 'htdemucs_ft',
    'demucs': 'htdemucs',
    'htdemucs_ft': 'htdemucs_ft',
    'htdemucs': 'htdemucs',
    'mdx': 'mdx_extra',
    'mdxnet': 'mdx_extra',
    'vrnet': 'htdemucs_6s',
    'bandit': 'htdemucs_6s',
    'melband': 'htdemucs_ft',
    'scnet': 'htdemucs',
    'openunmix': 'htdemucs',
    'asteroid': 'mdx_extra',
    'spleeter': 'htdemucs',
    'ensemble': 'htdemucs_ft',
    'uvr5_mdx': 'mdx_extra',
    'uvr5_vr': 'htdemucs_6s',
    'lalal': 'htdemucs_ft',
    'legacy': 'htdemucs',
}

def main():
    parser = argparse.ArgumentParser(description='Audio Stem Separation')
    parser.add_argument('input', help='Input WAV file path')
    parser.add_argument('output', help='Output directory')
    parser.add_argument('--model', default='htdemucs', help='Model name (htdemucs, htdemucs_ft, htdemucs_6s)')
    parser.add_argument('--mode', default='all', choices=['all', 'vocals_only', 'instrumental_only', 'mix'], help='Separation mode')
    parser.add_argument('--vocal-strength', type=float, default=1.0, help='Vocal strength for mix mode (0.0-1.0)')
    parser.add_argument('--type', default='4stem', choices=['4stem', '6stem'], help='Stem type')
    parser.add_argument('--preset', default='default', help='Preset (unused, for compatibility)')
    parser.add_argument('--strength', type=float, default=1.0, help='Strength (unused, for compatibility)')
    
    args = parser.parse_args()
    
    input_path = args.input
    output_dir = args.output
    requested_model = args.model
    model_name = MODEL_ALIASES.get(requested_model, requested_model)
    if args.type == '6stem' and requested_model in ('modern_ensemble', 'ensemble', 'bandit', 'uvr5_vr'):
        model_name = 'htdemucs_6s'
    mode = args.mode
    vocal_strength = args.vocal_strength
    
    # Логируем
    print(f"=== STEM SEPARATION ===")
    print(f"Input: {input_path}")
    print(f"Output: {output_dir}")
    print(f"Requested Model: {requested_model}")
    print(f"Runtime Model: {model_name}")
    print(f"Mode: {mode}")
    print(f"Vocal Strength: {vocal_strength}")
    sys.stdout.flush()
    
    # Проверяем входной файл
    if not os.path.exists(input_path):
        print(f"ERROR: Input file not found: {input_path}")
        sys.exit(1)
    
    # Создаем выходную папку
    os.makedirs(output_dir, exist_ok=True)
    
    # Инфо для сервера
    info = {
        'modelRequested': requested_model,
        'modelUsed': model_name,
        'runtimeBackend': model_name,
        'fallbackUsed': False
    }
    
    try:
        # Пытаемся использовать Demucs
        print("Trying to use Demucs...", flush=True)
        from demucs.separate import main as demucs_main
        from demucs.pretrained import get_model
        
        # Временно меняем аргументы для demucs
        old_argv = sys.argv
        sys.argv = ['demucs', '-n', model_name, '-o', output_dir, input_path]
        
        try:
            demucs_main()
            print("Demucs separation done!", flush=True)
        except SystemExit:
            pass
        finally:
            sys.argv = old_argv
        
        # Проверяем результат
        # Demucs создает папку {output_dir}/{model_name}/{track_name}/
        import glob
        track_name = os.path.splitext(os.path.basename(input_path))[0]
        result_dir = os.path.join(output_dir, model_name, track_name)
        
        if not os.path.exists(result_dir):
            # Пробуем найти любую папку
            dirs = glob.glob(os.path.join(output_dir, '*', track_name))
            if dirs:
                result_dir = dirs[0]
            else:
                raise Exception("Demucs output not found")
        
        # Находим файлы стемов
        stems = {}
        for stem_name in ['vocals', 'drums', 'bass', 'other']:
            stem_path = os.path.join(result_dir, f'{stem_name}.wav')
            if os.path.exists(stem_path):
                stems[stem_name] = stem_path
                # Копируем в output_dir для сервера
                import shutil
                target = os.path.join(output_dir, f'{stem_name}.wav')
                shutil.copy2(stem_path, target)
        
        print(f"Found stems: {list(stems.keys())}", flush=True)
        
        # Обработка режимов
        if mode == 'vocals_only' and 'vocals' in stems:
            # Оставляем только вокал, остальные удаляем
            for stem_name in ['drums', 'bass', 'other']:
                path = os.path.join(output_dir, f'{stem_name}.wav')
                if os.path.exists(path):
                    os.remove(path)
            print("Mode: vocals_only - kept only vocals", flush=True)
            
        elif mode == 'instrumental_only':
            # Оставляем только инструментал, вокал удаляем
            path = os.path.join(output_dir, 'vocals.wav')
            if os.path.exists(path):
                os.remove(path)
            # Создаем instrumental.wav из drums + bass + other
            from scipy.io import wavfile
            import numpy as np
            inst_parts = []
            for stem_name in ['drums', 'bass', 'other']:
                p = os.path.join(output_dir, f'{stem_name}.wav')
                if os.path.exists(p):
                    sr, data = wavfile.read(p)
                    inst_parts.append(data)
            
            if inst_parts:
                min_len = min(len(p) for p in inst_parts)
                inst_data = np.sum([p[:min_len] for p in inst_parts], axis=0)
                wavfile.write(os.path.join(output_dir, 'instrumental.wav'), sr, inst_data.astype(np.int16))
                print("Mode: instrumental_only - created instrumental.wav", flush=True)
                
        elif mode == 'mix':
            # Микс с регулировкой силы вокала
            print(f"Mode: mix with vocal strength {vocal_strength}", flush=True)
            # Вокал и инструментал должны быть созданы в server.js
            pass
        
        # Сохраняем инфо
        info_path = os.path.join(output_dir, 'stems_info.json')
        with open(info_path, 'w') as f:
            json.dump(info, f)
            
        print("=== SEPARATION COMPLETE ===", flush=True)
        
    except Exception as e:
        print(f"ERROR: {e}", flush=True)
        traceback.print_exc()
        info['fallbackUsed'] = True
        info['error'] = str(e)
        
        # Fallback: создаем пустые файлы, чтобы сервер не упал
        import numpy as np
        from scipy.io import wavfile
        sr, data = wavfile.read(input_path)
        if data.ndim == 1:
            mono = data.astype(np.float32)
            vocals = mono
            instrumental = np.zeros_like(mono)
        else:
            left = data[:, 0].astype(np.float32)
            right = data[:, 1].astype(np.float32)
            vocals = (left + right) / 2.0
            instrumental = (left - right) / 2.0

        if np.issubdtype(data.dtype, np.integer):
            info = np.iinfo(data.dtype)
            min_value, max_value = info.min, info.max
        else:
            min_value, max_value = -1.0, 1.0

        def as_stereo(signal):
            clipped = np.clip(signal, min_value, max_value).astype(data.dtype)
            return np.column_stack([clipped, clipped]) if data.ndim > 1 else clipped

        fallback_stems = {
            'vocals': as_stereo(vocals),
            'other': as_stereo(instrumental),
            'drums': np.zeros_like(data),
            'bass': np.zeros_like(data),
        }

        for stem_name, stem_data in fallback_stems.items():
            path = os.path.join(output_dir, f'{stem_name}.wav')
            if not os.path.exists(path):
                wavfile.write(path, sr, stem_data)
        
        # Сохраняем инфо об ошибке
        info_path = os.path.join(output_dir, 'stems_info.json')
        with open(info_path, 'w') as f:
            json.dump(info, f)
        
        print("Fallback: created dummy stems", flush=True)
        sys.exit(1)

if __name__ == '__main__':
    main()
