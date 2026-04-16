#!/usr/bin/env python3
"""
Model Cache вЂ” Singleton РґР»СЏ ML РјРѕРґРµР»РµР№.

Р—Р°РіСЂСѓР¶Р°РµС‚ РјРѕРґРµР»Рё РѕРґРёРЅ СЂР°Р· Рё С…СЂР°РЅРёС‚ РІ РїР°РјСЏС‚Рё РґР»СЏ РїРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ.
Р—РЅР°С‡РёС‚РµР»СЊРЅРѕ СѓСЃРєРѕСЂСЏРµС‚ РѕР±СЂР°Р±РѕС‚РєСѓ вЂ” РЅРµ РЅСѓР¶РЅРѕ Р·Р°РіСЂСѓР¶Р°С‚СЊ РјРѕРґРµР»СЊ РєР°Р¶РґС‹Р№ СЂР°Р·.

Usage:
    from model_cache import get_demucs_model, get_spleeter_separator
"""

import sys
import os

# ==========================================
# Model Cache Store
# ==========================================

_model_cache = {
    'demucs': {},      # { model_name: model_instance }
    'spleeter': None,  # Separator instance
    'torch_device': None,
}


class DemucsModelAdapter:
    """Compatibility wrapper around the installed Demucs package."""

    def __init__(self, model_name='htdemucs_ft', device='cpu'):
        from demucs.pretrained import get_model

        self.name = model_name
        self.device = device
        self.model = get_model(model_name)
        self.model.to(device)
        self.model.eval()
        self.sources = list(getattr(self.model, 'sources', ['drums', 'bass', 'other', 'vocals']))
        self.samplerate = getattr(self.model, 'samplerate', 44100)
        self.audio_channels = getattr(self.model, 'audio_channels', 2)

    def separate_audio(self, input_path):
        import numpy as np
        import soundfile as sf
        import torch
        from demucs.apply import apply_model

        wav, sample_rate = sf.read(input_path, always_2d=True)
        wav = torch.tensor(np.asarray(wav).T, dtype=torch.float32)

        if sample_rate != self.samplerate:
            import librosa

            wav_np = wav.cpu().numpy()
            wav_np = np.stack([
                librosa.resample(channel, orig_sr=sample_rate, target_sr=self.samplerate)
                for channel in wav_np
            ])
            wav = torch.tensor(wav_np, dtype=torch.float32)

        if wav.shape[0] > self.audio_channels:
            wav = wav[:self.audio_channels]
        elif wav.shape[0] < self.audio_channels:
            if wav.shape[0] == 1 and self.audio_channels == 2:
                wav = wav.repeat(2, 1)
            else:
                wav = wav.repeat(self.audio_channels, 1)[:self.audio_channels]

        with torch.no_grad():
            separated = apply_model(
                self.model,
                wav[None],
                device=self.device,
                split=True,
                overlap=0.25,
                progress=False,
            )

        result = {}
        sources = separated[0].cpu()
        for idx, source in enumerate(self.sources):
            if idx < sources.shape[0]:
                result[source] = sources[idx]

        return result


def get_torch_device():
    """РџРѕР»СѓС‡РёС‚СЊ СѓСЃС‚СЂРѕР№СЃС‚РІРѕ (cuda/cpu) вЂ” РєСЌС€РёСЂСѓРµС‚СЃСЏ."""
    if _model_cache['torch_device'] is not None:
        return _model_cache['torch_device']
    
    try:
        import torch
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        _model_cache['torch_device'] = device
        print(f"[ModelCache] Device: {device}", flush=True)
        return device
    except ImportError:
        _model_cache['torch_device'] = 'cpu'
        return 'cpu'


def get_demucs_model(model_name='htdemucs_ft'):
    """
    РџРѕР»СѓС‡РёС‚СЊ Demucs РјРѕРґРµР»СЊ вЂ” singleton.
    Р—Р°РіСЂСѓР¶Р°РµС‚ РѕРґРёРЅ СЂР°Р·, РІРѕР·РІСЂР°С‰Р°РµС‚ РєСЌС€ РїСЂРё РїРѕРІС‚РѕСЂРЅС‹С… РІС‹Р·РѕРІР°С….
    """
    if model_name in _model_cache['demucs']:
        print(f"[ModelCache] Using cached Demucs: {model_name}", flush=True)
        return _model_cache['demucs'][model_name]
    
    try:
        device = get_torch_device()
        
        print(f"[ModelCache] Loading Demucs model: {model_name} on {device}...", flush=True)
        model = DemucsModelAdapter(model_name=model_name, device=device)
        
        _model_cache['demucs'][model_name] = model
        print(f"[ModelCache] Demucs model cached: {model_name}", flush=True)
        return model
        
    except Exception as e:
        print(f"[ModelCache] Failed to load Demucs {model_name}: {e}", flush=True)
        return None


def get_spleeter_separator(config='spleeter:4stems'):
    """
    РџРѕР»СѓС‡РёС‚СЊ Spleeter Separator вЂ” singleton.
    """
    if _model_cache['spleeter'] is not None:
        print(f"[ModelCache] Using cached Spleeter", flush=True)
        return _model_cache['spleeter']
    
    try:
        from spleeter.separator import Separator
        
        print(f"[ModelCache] Loading Spleeter ({config})...", flush=True)
        separator = Separator(config)
        
        _model_cache['spleeter'] = separator
        print(f"[ModelCache] Spleeter cached", flush=True)
        return separator
        
    except Exception as e:
        print(f"[ModelCache] Failed to load Spleeter: {e}", flush=True)
        return None


def clear_cache(model_name=None):
    """
    РћС‡РёСЃС‚РёС‚СЊ РєСЌС€ РјРѕРґРµР»РµР№.
    Р•СЃР»Рё model_name СѓРєР°Р·Р°РЅ вЂ” С‚РѕР»СЊРєРѕ СЌС‚Сѓ РјРѕРґРµР»СЊ.
    """
    if model_name is None:
        # РћС‡РёСЃС‚РёС‚СЊ РІСЃС‘
        _model_cache['demucs'] = {}
        _model_cache['spleeter'] = None
        _model_cache['torch_device'] = None
        print("[ModelCache] All cache cleared", flush=True)
    elif model_name.startswith('demucs'):
        _model_cache['demucs'] = {}
        print(f"[ModelCache] Demucs cache cleared", flush=True)
    elif model_name == 'spleeter':
        _model_cache['spleeter'] = None
        print(f"[ModelCache] Spleeter cache cleared", flush=True)


def get_cache_status():
    """РџРѕР»СѓС‡РёС‚СЊ СЃС‚Р°С‚СѓСЃ РєСЌС€Р°."""
    status = {
        'torch_device': _model_cache['torch_device'],
        'demucs_models': list(_model_cache['demucs'].keys()),
        'spleeter_loaded': _model_cache['spleeter'] is not None,
    }
    
    # РРЅС„РѕСЂРјР°С†РёСЏ Рѕ РїР°РјСЏС‚Рё (РµСЃР»Рё РґРѕСЃС‚СѓРїРµРЅ psutil)
    try:
        import psutil
        process = psutil.Process(os.getpid())
        mem_info = process.memory_info()
        status['memory_mb'] = round(mem_info.rss / (1024 * 1024), 1)
    except ImportError:
        status['memory_mb'] = 'unknown'
    
    return status


# ==========================================
# CLI РґР»СЏ С‚РµСЃС‚РёСЂРѕРІР°РЅРёСЏ
# ==========================================

if __name__ == '__main__':
    import json
    
    print("=== Model Cache Status ===", flush=True)
    status = get_cache_status()
    print(json.dumps(status, indent=2), flush=True)
    
    # РџСЂРёРјРµСЂ Р·Р°РіСЂСѓР·РєРё РјРѕРґРµР»Рё
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        print("\n=== Testing Demucs load ===", flush=True)
        model = get_demucs_model('htdemucs_ft')
        if model:
            print(f"Model loaded: {type(model)}", flush=True)
        
        print("\n=== Status after load ===", flush=True)
        status = get_cache_status()
        print(json.dumps(status, indent=2), flush=True)
