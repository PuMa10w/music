#!/usr/bin/env python3
"""Локальные современные профили разделения аудио без внешних API."""

import numpy as np
import soundfile as sf
import torch
import os
import sys
from pathlib import Path
from typing import Dict, Tuple, Optional, List

# Добавляем UVR5 в path если существует
UVR5_PATH = os.path.join(os.path.dirname(__file__), '..', 'UVR5')
if os.path.exists(UVR5_PATH):
    sys.path.insert(0, UVR5_PATH)

# ==========================================
# MDX-Net Models (UVR5)
# ==========================================

class MDXNetModel:
    """MDX-Net модель для разделения."""

    def __init__(self, model_path: str, device: str = 'cpu'):
        self.model_path = model_path
        self.device = device
        self.model = None
        self._load_model()

    def _load_model(self):
        """Загрузить ONNX модель."""
        try:
            import onnxruntime as ort
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider'] if self.device == 'cuda' else ['CPUExecutionProvider']
            self.model = ort.InferenceSession(self.model_path, providers=providers)
            print(f"MDX-Net loaded: {self.model_path}")
        except Exception as e:
            print(f"Failed to load MDX-Net: {e}")
            self.model = None

    def separate(self, audio: np.ndarray, sr: int) -> Dict[str, np.ndarray]:
        """Разделить аудио."""
        if self.model is None:
            return {}

        try:
            # Предварительная обработка
            audio = self._preprocess_audio(audio, sr)

            # Инференс
            inputs = {self.model.get_inputs()[0].name: audio}
            outputs = self.model.run(None, inputs)

            # Постобработка
            return self._postprocess_outputs(outputs, sr)
        except Exception as e:
            print(f"MDX-Net inference error: {e}")
            return {}

    def _preprocess_audio(self, audio: np.ndarray, sr: int) -> np.ndarray:
        """Предварительная обработка аудио."""
        # Нормализация и конвертация в нужный формат
        if audio.ndim == 1:
            audio = audio[np.newaxis, :]
        elif audio.shape[0] > audio.shape[1]:
            audio = audio.T

        # Ресемплинг если нужно
        target_sr = 44100  # MDX-Net обычно работает на 44.1kHz
        if sr != target_sr:
            import librosa
            audio = librosa.resample(audio.T, orig_sr=sr, target_sr=target_sr).T

        return audio.astype(np.float32)

    def _postprocess_outputs(self, outputs: List[np.ndarray], sr: int) -> Dict[str, np.ndarray]:
        """Постобработка выходов модели."""
        result = {}
        # Предполагаем 2 выхода: vocals и instrumental
        if len(outputs) >= 2:
            result['vocals'] = outputs[0].T
            result['instrumental'] = outputs[1].T
        return result

# ==========================================
# VR Network Models
# ==========================================

class VRNetworkModel:
    """VR Network модель для разделения."""

    def __init__(self, model_path: str, device: str = 'cpu'):
        self.model_path = model_path
        self.device = device
        self.model = None
        self._load_model()

    def _load_model(self):
        """Загрузить модель."""
        try:
            import onnxruntime as ort
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider'] if self.device == 'cuda' else ['CPUExecutionProvider']
            self.model = ort.InferenceSession(self.model_path, providers=providers)
            print(f"VR Network loaded: {self.model_path}")
        except Exception as e:
            print(f"Failed to load VR Network: {e}")
            self.model = None

    def separate(self, audio: np.ndarray, sr: int) -> Dict[str, np.ndarray]:
        """Разделить аудио."""
        if self.model is None:
            return {}

        try:
            # Предварительная обработка
            audio = self._preprocess_audio(audio, sr)

            # Инференс
            inputs = {self.model.get_inputs()[0].name: audio}
            outputs = self.model.run(None, inputs)

            # Постобработка
            return self._postprocess_outputs(outputs, sr)
        except Exception as e:
            print(f"VR Network inference error: {e}")
            return {}

    def _preprocess_audio(self, audio: np.ndarray, sr: int) -> np.ndarray:
        """Предварительная обработка."""
        if audio.ndim == 1:
            audio = audio[np.newaxis, :]
        return audio.astype(np.float32)

    def _postprocess_outputs(self, outputs: List[np.ndarray], sr: int) -> Dict[str, np.ndarray]:
        """Постобработка."""
        result = {}
        if len(outputs) >= 2:
            result['vocals'] = outputs[0].T
            result['instrumental'] = outputs[1].T
        return result

# ==========================================
# Open-Unmix
# ==========================================

def separate_with_openunmix(audio_path: str) -> Tuple[Optional[Dict[str, np.ndarray]], Optional[int]]:
    """Разделение с помощью Open-Unmix."""
    try:
        import openunmix

        print("Open-Unmix: загрузка модели...")
        separator = openunmix.umxl()

        print("Open-Unmix: разделение...")
        audio, sr = sf.read(audio_path)

        # Конвертация в нужный формат
        if audio.ndim == 1:
            audio = audio[:, np.newaxis]

        estimates = separator(audio.T)

        result = {}
        for target, estimate in estimates.items():
            result[target] = estimate.T

        return result, sr

    except Exception as e:
        print(f"Open-Unmix error: {e}")
        return None, None

# ==========================================
# Asteroid (Conv-TasNet)
# ==========================================

def separate_with_asteroid(audio_path: str, model_name: str = 'mpariente/ConvTasNet_WHAM!_sepclean') -> Tuple[Optional[Dict[str, np.ndarray]], Optional[int]]:
    """Разделение с помощью Asteroid."""
    try:
        from asteroid.models import ConvTasNet
        import torchaudio

        print(f"Asteroid: загрузка {model_name}...")
        model = ConvTasNet.from_pretrained(model_name)

        print("Asteroid: разделение...")
        wav, sr = torchaudio.load(audio_path)

        # Инференс
        with torch.no_grad():
            estimates = model(wav.unsqueeze(0))

        # Конвертация в numpy
        estimates = estimates.squeeze(0).cpu().numpy()

        result = {}
        # Предполагаем 2 источника
        result['source1'] = estimates[0].T
        result['source2'] = estimates[1].T

        return result, sr

    except Exception as e:
        print(f"Asteroid error: {e}")
        return None, None

LOCAL_PROFILE_MODELS = {
    'modern_ensemble': ['htdemucs_ft', 'htdemucs', 'mdx'],
    'demucs': ['htdemucs'],
    'htdemucs_ft': ['htdemucs_ft'],
    'mdxnet': ['mdx'],
    'bandit': ['htdemucs_6s'],
    'melband': ['htdemucs_ft'],
    'scnet': ['htdemucs'],
    'vrnet': ['mdx'],
    'openunmix': ['htdemucs'],
    'asteroid': ['mdx'],
    'spleeter': ['htdemucs'],
    'ensemble': ['htdemucs_ft', 'mdx'],
    'uvr5_mdx': ['mdx'],
    'uvr5_vr': ['htdemucs_6s'],
    'lalal': ['htdemucs_ft'],
}


def average_stem_results(results: List[Dict[str, np.ndarray]]) -> Dict[str, np.ndarray]:
    """Average matching stems across several local model outputs."""
    final_result = {}
    all_stems = set()
    for result in results:
        all_stems.update(result.keys())

    for stem in all_stems:
        stem_results = [result[stem] for result in results if stem in result]
        if stem_results:
            final_result[stem] = np.mean(stem_results, axis=0)

    return final_result

# ==========================================
# Modern Ensemble
# ==========================================

def separate_with_modern_ensemble(audio_path: str) -> Tuple[Optional[Dict[str, np.ndarray]], Optional[int]]:
    """Локальный ансамбль из нескольких доступных Demucs-профилей."""
    print("Modern Ensemble: blending local models")
    results = []
    sample_rates = []

    for model_name in LOCAL_PROFILE_MODELS['modern_ensemble']:
        result, sr = separate_with_demucs(audio_path, model_name)
        if result:
            results.append(result)
            sample_rates.append(sr)

    if not results:
        return None, None

    return average_stem_results(results), max(sample_rates) if sample_rates else 44100

# ==========================================
# Helper Functions
# ==========================================

def separate_with_mdxnet(audio_path: str, model_name: str) -> Tuple[Optional[Dict[str, np.ndarray]], Optional[int]]:
    """Локальный MDX-профиль на базе Demucs MDX."""
    print(f"MDX-Net {model_name}: using local Demucs MDX backend")
    return separate_with_demucs(audio_path, 'mdx')

def separate_with_demucs(audio_path: str, model_name: str) -> Tuple[Optional[Dict[str, np.ndarray]], Optional[int]]:
    """Обертка для Demucs."""
    try:
        import numpy as np
        from model_cache import get_demucs_model

        model = get_demucs_model(model_name)
        if model is None:
            return None, None

        raw_result = model.separate_audio(audio_path)
        result = {}
        for stem_name, stem_data in raw_result.items():
            if hasattr(stem_data, 'detach'):
                stem_data = stem_data.detach().cpu().numpy()
            else:
                stem_data = np.asarray(stem_data)

            if stem_data.ndim == 1:
                stem_data = stem_data[np.newaxis, :]

            result[stem_name] = stem_data.T

        sr = model.samplerate
        return result, sr
    except Exception as e:
        print(f"Demucs wrapper error: {e}")
        return None, None

# ==========================================
# Main Interface
# ==========================================

def separate_audio(input_path: str, model_type: str = 'modern_ensemble', **kwargs) -> Tuple[Optional[Dict[str, np.ndarray]], Optional[int]]:
    """
    Основная функция разделения с современными моделями.

    Args:
        input_path: Путь к аудио файлу
        model_type: Тип модели ('mdxnet', 'vrnet', 'openunmix', 'asteroid', 'lalal', 'modern_ensemble')
        **kwargs: Дополнительные параметры

    Returns:
        (result_dict, sample_rate) или (None, None) при ошибке
    """

    if model_type in {'lalal', 'bandit', 'melband', 'scnet', 'vrnet', 'openunmix', 'asteroid', 'uvr5_mdx', 'uvr5_vr', 'spleeter', 'demucs', 'htdemucs_ft', 'ensemble'}:
        profile_chain = LOCAL_PROFILE_MODELS.get(model_type, ['htdemucs_ft'])
        print(f"{model_type}: using local profile {', '.join(profile_chain)}")

        results = []
        sample_rates = []
        for model_name in profile_chain:
            result, sr = separate_with_demucs(input_path, model_name)
            if result:
                results.append(result)
                sample_rates.append(sr)

        if not results:
            return None, None

        if len(results) == 1:
            return results[0], sample_rates[0]

        return average_stem_results(results), max(sample_rates)

    if model_type == 'mdxnet':
        return separate_with_mdxnet(input_path, kwargs.get('model_name', 'UVR-MDX-NET-Inst_HQ_3'))
    elif model_type == 'modern_ensemble':
        return separate_with_modern_ensemble(input_path)
    else:
        print(f"Unknown model type: {model_type}")
        return None, None

if __name__ == '__main__':
    # Тест
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
        model_type = sys.argv[2] if len(sys.argv) > 2 else 'modern_ensemble'

        print(f"Testing {model_type} on {input_file}")
        result, sr = separate_audio(input_file, model_type)

        if result:
            print(f"Success! Sample rate: {sr}")
            print(f"Stems: {list(result.keys())}")
        else:
            print("Failed!")
