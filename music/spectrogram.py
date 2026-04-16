#!/usr/bin/env python3
"""Generate a mel-spectrogram from a mono WAV file and output it as JSON."""

import json
import sys
import os

# в”Ђв”Ђв”Ђ Attempt librosa import в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
try:
    import librosa
    import numpy as np
    HAS_LIBROSA = True
except ImportError:
    import numpy as np
    HAS_LIBROSA = False


def compute_with_librosa(wav_path):
    """Compute mel-spectrogram using librosa."""
    print("Loading audio with librosa...", flush=True)
    y, sr = librosa.load(wav_path, sr=None, mono=True)

    print(f"Sample rate: {sr}, samples: {len(y)}", flush=True)

    print("Computing mel-spectrogram...", flush=True)
    mel_spec = librosa.feature.melspectrogram(
        y=y,
        sr=sr,
        n_mels=128,
        n_fft=2048,
        hop_length=512,
    )

    print("Converting to dB scale...", flush=True)
    mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)

    # Downsample frequency axis from 128 bins to 64 bins
    mel_spec_down = np.array_split(mel_spec_db, 64, axis=0)
    mel_spec_down = np.array([chunk.mean(axis=0) for chunk in mel_spec_down])

    num_frames = mel_spec_down.shape[1]
    print(f"Downsampled to 64 bins, {num_frames} frames", flush=True)

    result = {
        "spectrogram": mel_spec_down.tolist(),
        "fftSize": 2048,
        "hopLength": 512,
        "numFrames": num_frames,
        "numBins": 64,
        "sampleRate": sr,
    }
    return result


def compute_fallback(wav_path):
    """Fallback STFT-based spectrogram using only numpy + stdlib WAV reader."""
    import wave
    import struct

    print("Loading WAV via stdlib (fallback mode)...", flush=True)

    with wave.open(wav_path, "rb") as wf:
        n_channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        sr = wf.getframerate()
        n_frames = wf.getnframes()

        raw = wf.readframes(n_frames)

    if n_channels != 1:
        print(f"Warning: expected mono, got {n_channels} channels вЂ” using first channel", flush=True)

    if sample_width == 1:
        fmt = f"{len(raw)}B"
        samples = np.array(struct.unpack(fmt, raw), dtype=np.float32)
        samples = (samples - 128) / 128.0
    elif sample_width == 2:
        fmt = f"{len(raw) // 2}h"
        samples = np.array(struct.unpack(fmt, raw), dtype=np.float32) / 32768.0
    elif sample_width == 4:
        fmt = f"{len(raw) // 4}i"
        samples = np.array(struct.unpack(fmt, raw), dtype=np.float32) / 2147483648.0
    else:
        raise ValueError(f"Unsupported sample width: {sample_width}")

    print(f"Sample rate: {sr}, samples: {len(samples)}", flush=True)

    n_fft = 2048
    hop_length = 512
    n_mels_target = 64

    # Hann window
    window = np.hanning(n_fft)

    # Number of frames
    num_frames = 1 + (len(samples) - n_fft) // hop_length
    if num_frames <= 0:
        # Pad signal
        samples = np.pad(samples, (0, n_fft))
        num_frames = 1 + (len(samples) - n_fft) // hop_length

    print("Computing STFT (fallback)...", flush=True)

    # Compute magnitude spectrogram via STFT
    mag_spec = []
    for i in range(num_frames):
        start = i * hop_length
        frame = samples[start:start + n_fft] * window
        fft_vals = np.fft.rfft(frame, n=n_fft)
        mag_spec.append(np.abs(fft_vals))

    mag_spec = np.array(mag_spec).T  # shape: (n_fft//2+1, num_frames)

    # Convert to power
    power_spec = mag_spec ** 2

    # Simple mel-like downsampling: average power into 64 log-spaced bins
    n_freq_bins = power_spec.shape[0]
    bin_edges = np.linspace(0, n_freq_bins, n_mels_target + 1).astype(int)
    bin_edges[-1] = n_freq_bins  # ensure full coverage

    mel_bins = []
    for k in range(n_mels_target):
        chunk = power_spec[bin_edges[k]:bin_edges[k + 1]]
        if chunk.shape[0] > 0:
            mel_bins.append(chunk.mean(axis=0))
        else:
            mel_bins.append(np.zeros(num_frames))

    mel_spec = np.array(mel_bins)

    # Convert to dB
    mel_spec_db = 10.0 * np.log10(np.maximum(mel_spec, 1e-10))
    # Normalize relative to max
    mel_spec_db -= mel_spec_db.max()

    print(f"Fallback: 64 bins, {num_frames} frames", flush=True)

    result = {
        "spectrogram": mel_spec_db.tolist(),
        "fftSize": n_fft,
        "hopLength": hop_length,
        "numFrames": num_frames,
        "numBins": 64,
        "sampleRate": sr,
    }
    return result


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input_mono_wav> <output_json>", flush=True)
        sys.exit(1)

    wav_path = sys.argv[1]
    json_path = sys.argv[2]

    if not os.path.isfile(wav_path):
        print(f"Error: file not found: {wav_path}", flush=True)
        sys.exit(1)

    if HAS_LIBROSA:
        print("Using librosa backend.", flush=True)
        result = compute_with_librosa(wav_path)
    else:
        print("librosa not available вЂ” using fallback STFT (numpy only).", flush=True)
        result = compute_fallback(wav_path)

    print(f"Writing JSON: {json_path}", flush=True)
    with open(json_path, "w") as f:
        json.dump(result, f)

    print("Done.", flush=True)


if __name__ == "__main__":
    main()
