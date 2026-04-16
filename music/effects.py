#!/usr/bin/env python3
"""
Audio effects processor for Voice Remover Pro.
Applies EQ, reverb, compressor, chorus, pitch shift, and distortion.
Uses scipy.signal for filters, numpy for processing, soundfile for I/O.

Usage:
    python effects.py input.wav output.wav effect_name param1=value1 param2=value2 ...

Examples:
    python effects.py input.wav output.wav eq 31=3 62=6 125=3 250=0 500=-2 1000=0 2000=2 4000=3 8000=0 16000=0
    python effects.py input.wav output.wav reverb mix=0.3 decay=2.0
    python effects.py input.wav output.wav compressor threshold=-20 ratio=4 attack=10 release=100
    python effects.py input.wav output.wav chorus rate=1.5 depth=0.7 mix=0.5
    python effects.py input.wav output.wav pitchshift semitones=3
    python effects.py input.wav output.wav distortion drive=0.6 tone=0.5
"""

import sys
import os
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, sosfreqz
from scipy.signal import convolve
import json

# 10-band EQ center frequencies (Hz)
EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]


def db_to_linear(db):
    """Convert dB to linear amplitude."""
    return 10.0 ** (db / 20.0)


def butter_bandpass(lowcut, highcut, fs, order=4):
    """Create Butterworth bandpass SOS filter."""
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    low = max(low, 0.0001)
    high = min(high, 0.9999)
    sos = butter(order, [low, high], btype='band', output='sos')
    return sos


def butter_lowpass(cutoff, fs, order=4):
    """Create Butterworth lowpass SOS filter."""
    nyq = 0.5 * fs
    freq = cutoff / nyq
    freq = min(freq, 0.9999)
    sos = butter(order, freq, btype='low', output='sos')
    return sos


def butter_highpass(cutoff, fs, order=4):
    """Create Butterworth highpass SOS filter."""
    nyq = 0.5 * fs
    freq = cutoff / nyq
    freq = max(freq, 0.0001)
    sos = butter(order, freq, btype='high', output='sos')
    return sos


def apply_band(data, sos):
    """Apply SOS filter to a single channel."""
    return sosfilt(sos, data)


def apply_eq(data, sample_rate, band_gains_db):
    """
    Apply 10-band EQ to audio data.

    Args:
        data: numpy array of audio samples (mono or per-channel)
        sample_rate: sample rate in Hz
        band_gains_db: list of 10 dB gain values for each EQ band

    Returns:
        Processed audio data
    """
    print(f"Applying 10-band EQ: {band_gains_db}", flush=True)

    if len(band_gains_db) != 10:
        raise ValueError(f"Expected 10 band gains, got {len(band_gains_db)}")

    result = np.zeros_like(data, dtype=np.float64)

    # Define band edges (crossover frequencies between bands)
    # Bands: 31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k
    # Edges are geometric means of adjacent center frequencies
    edges = [22.05]  # below 31 Hz
    for i in range(len(EQ_BANDS) - 1):
        edges.append(np.sqrt(EQ_BANDS[i] * EQ_BANDS[i + 1]))
    edges.append(sample_rate / 2.0)  # above 16k Hz

    for i in range(10):
        low_freq = edges[i]
        high_freq = edges[i + 1]
        gain_db = band_gains_db[i]

        if gain_db == 0:
            continue

        gain_linear = db_to_linear(gain_db)

        if i == 0:
            # First band: highpass at low_freq, lowpass at high_freq (low-shelf approximation)
            sos = butter_lowpass(high_freq, sample_rate, order=4)
        elif i == 9:
            # Last band: highpass at low_freq (high-shelf approximation)
            sos = butter_highpass(low_freq, sample_rate, order=4)
        else:
            sos = butter_bandpass(low_freq, high_freq, sample_rate, order=4)

        band_signal = apply_band(data, sos)
        result += band_signal * gain_linear
        print(f"  Band {EQ_BANDS[i]}Hz: {gain_db}dB (gain={gain_linear:.3f})", flush=True)

    # If all gains are 0, result is zeros -- pass through original
    total_gain = sum(abs(g) for g in band_gains_db)
    if total_gain == 0:
        return data.astype(np.float64)

    return result


def generate_impulse_response(sample_rate, decay=2.0, n_channels=1):
    """Generate a simple exponentially decaying impulse response for reverb."""
    length = int(sample_rate * decay)
    ir = np.zeros(length, dtype=np.float64)
    ir[0] = 1.0
    # Exponential decay
    decay_curve = np.exp(-np.linspace(0, 6, length))
    ir *= decay_curve

    # Add some early reflections
    reflection_times = [0.02, 0.04, 0.06, 0.09, 0.13, 0.18]
    reflection_gains = [0.5, 0.35, 0.25, 0.18, 0.12, 0.08]
    for t, g in zip(reflection_times, reflection_gains):
        idx = int(t * sample_rate)
        if idx < length:
            ir[idx] += g

    return ir


def apply_reverb(data, sample_rate, mix=0.3, decay=2.0):
    """
    Apply reverb using convolution with generated impulse response.

    Args:
        data: numpy array of audio samples
        sample_rate: sample rate in Hz
        mix: wet/dry mix (0.0 to 1.0)
        decay: reverb decay time in seconds
    """
    print(f"Applying reverb: mix={mix}, decay={decay}s", flush=True)

    ir = generate_impulse_response(sample_rate, decay=decay)

    # Convolve dry signal with impulse response
    print("  Convolving signal with impulse response...", flush=True)
    wet = convolve(data, ir, mode='full')

    # Trim to original length
    wet = wet[:len(data)]

    # Normalize wet signal to prevent clipping
    wet_max = np.max(np.abs(wet))
    if wet_max > 0:
        wet = wet / wet_max * 0.5

    # Mix dry and wet
    result = (1.0 - mix) * data + mix * wet
    print("  Reverb applied.", flush=True)
    return result


def apply_compressor(data, sample_rate, threshold=-20.0, ratio=4.0, attack=10.0, release=100.0):
    """
    Apply dynamic range compression.

    Args:
        data: numpy array of audio samples
        sample_rate: sample rate in Hz
        threshold: compression threshold in dB
        ratio: compression ratio (e.g., 4.0 means 4:1)
        attack: attack time in ms
        release: release time in ms
    """
    print(f"Applying compressor: threshold={threshold}dB, ratio={ratio}, attack={attack}ms, release={release}ms", flush=True)

    # Convert times to samples
    attack_samples = max(1, int(attack / 1000.0 * sample_rate))
    release_samples = max(1, int(release / 1000.0 * sample_rate))

    # Work with envelope (absolute value smoothed)
    envelope = np.abs(data)
    # Simple smoothing of envelope
    envelope = np.convolve(envelope, np.ones(64) / 64, mode='same')

    # Convert to dB
    threshold_linear = db_to_linear(threshold)

    # Calculate gain reduction
    gain = np.ones(len(data), dtype=np.float64)
    current_gain = 1.0

    for i in range(len(envelope)):
        if envelope[i] > threshold_linear:
            # How much above threshold
            overshoot_db = 20 * np.log10(envelope[i] / threshold_linear + 1e-10)
            # Compressed overshoot
            compressed_overshoot_db = overshoot_db / ratio
            # Target gain
            target_gain = db_to_linear(-compressed_overshoot_db)
        else:
            target_gain = 1.0

        # Attack/release smoothing
        if target_gain < current_gain:
            # Attacking: follow target quickly
            alpha = 1.0 / attack_samples if attack_samples > 0 else 1.0
            current_gain = (1 - alpha) * current_gain + alpha * target_gain
        else:
            # Releasing: follow target slowly
            alpha = 1.0 / release_samples if release_samples > 0 else 1.0
            current_gain = (1 - alpha) * current_gain + alpha * target_gain

        gain[i] = current_gain

    result = data * gain
    print("  Compression applied.", flush=True)
    return result


def apply_chorus(data, sample_rate, rate=1.5, depth=0.7, mix=0.5):
    """
    Apply chorus effect.

    Args:
        data: numpy array of audio samples
        sample_rate: sample rate in Hz
        rate: LFO rate in Hz
        depth: modulation depth (0.0 to 1.0)
        mix: wet/dry mix (0.0 to 1.0)
    """
    print(f"Applying chorus: rate={rate}Hz, depth={depth}, mix={mix}", flush=True)

    max_delay = int(0.020 * sample_rate)  # 20ms max delay
    wet = np.zeros_like(data, dtype=np.float64)

    # Modulated delay line
    t = np.arange(len(data)) / sample_rate
    # LFO: sinusoidal modulation
    lfo = depth * np.sin(2 * np.pi * rate * t)
    delay_samples = (max_delay // 2 + lfo * (max_delay // 2)).astype(int)
    delay_samples = np.clip(delay_samples, 0, max_delay)

    # Simple delay with modulation
    buf = np.zeros(max_delay + 1, dtype=np.float64)
    for i in range(len(data)):
        buf[max_delay] = data[i]
        d = delay_samples[i]
        if d < max_delay:
            # Linear interpolation
            frac = delay_samples[i] - d
            wet[i] = buf[d] * (1 - frac) + buf[d + 1] * frac
        else:
            wet[i] = buf[d]
        # Shift buffer
        buf[:-1] = buf[1:]
        buf[-1] = 0

    result = (1.0 - mix) * data + mix * wet
    print("  Chorus applied.", flush=True)
    return result


def apply_pitch_shift(data, sample_rate, semitones=0):
    """
    Apply pitch shift using phase vocoder approach (time-stretch then resample).

    Args:
        data: numpy array of audio samples
        sample_rate: sample rate in Hz
        semitones: number of semitones to shift (-12 to +12)
    """
    print(f"Applying pitch shift: {semitones} semitones", flush=True)

    if semitones == 0:
        return data.astype(np.float64)

    # Calculate speed factor
    factor = 2.0 ** (semitones / 12.0)

    # Phase vocoder pitch shift
    # STFT parameters
    fft_size = 4096
    hop_length = fft_size // 4

    # Window
    window = np.hanning(fft_size)

    # Pad signal
    pad_length = fft_size * 2
    padded = np.zeros(len(data) + pad_length, dtype=np.float64)
    padded[:len(data)] = data

    # Overlap-add parameters
    time_steps = 1.0 / factor  # stretch factor

    num_frames = (len(padded) - fft_size) // hop_length + 1

    # Accumulator for output
    output_length = int(len(padded) * time_steps) + fft_size * 4
    output = np.zeros(output_length, dtype=np.float64)
    window_sum = np.zeros(output_length, dtype=np.float64)

    phase_advance = np.zeros(fft_size, dtype=np.float64)

    frame_idx = 0
    for i in range(num_frames):
        start = i * hop_length
        frame = padded[start:start + fft_size] * window

        # FFT
        spectrum = np.fft.rfft(frame)
        magnitude = np.abs(spectrum)
        phase = np.angle(spectrum)

        # Phase vocoder: calculate true phase increment
        if i > 0:
            phase_diff = phase - prev_phase
            # Expected phase advance
            expected_advance = phase_advance * hop_length
            # Deviation from expected
            deviation = phase_diff - expected_advance
            # Wrap deviation
            deviation = np.mod(deviation + np.pi, 2 * np.pi) - np.pi
            # True frequency
            true_phase = expected_advance + deviation * time_steps
        else:
            true_phase = np.angle(spectrum)

        # Synthesize with phase advance
        synth_magnitude = magnitude
        synth_phase = true_phase
        synth_spectrum = synth_magnitude * np.exp(1j * synth_phase)

        # IFFT
        synth_frame = np.fft.irfft(synth_spectrum, n=fft_size) * window

        # Overlap-add at output position
        out_start = int(i * hop_length * time_steps)
        if out_start + fft_size <= output_length:
            output[out_start:out_start + fft_size] += synth_frame
            window_sum[out_start:out_start + fft_size] += window ** 2

        phase_advance = phase
        prev_phase = phase

    # Normalize by window sum
    nonzero = window_sum > 1e-8
    output[nonzero] /= window_sum[nonzero]

    # Trim to expected output length
    expected_len = int(len(data) / factor)
    result = output[:expected_len] if expected_len > 0 else output[:len(data)]

    # If we have extra data, trim
    if len(result) > len(data):
        result = result[:len(data)]
    elif len(result) < len(data):
        result = np.pad(result, (0, len(data) - len(result)), mode='constant')

    print("  Pitch shift applied.", flush=True)
    return result


def apply_distortion(data, sample_rate, drive=0.5, tone=0.5):
    """
    Apply waveshaper distortion.

    Args:
        data: numpy array of audio samples (should be normalized to [-1, 1])
        sample_rate: sample rate in Hz
        drive: amount of drive/gain before waveshaping (0.0 to 1.0)
        tone: post-filter tone control (0.0 = dark, 1.0 = bright)
    """
    print(f"Applying distortion: drive={drive}, tone={tone}", flush=True)

    # Normalize input to [-1, 1] range
    max_val = np.max(np.abs(data))
    if max_val > 0:
        normalized = data / max_val
    else:
        normalized = data

    # Apply drive (pre-gain)
    gain = 1.0 + drive * 20.0  # 1x to 21x gain
    driven = normalized * gain

    # Soft clipping waveshaper: tanh-based
    shaped = np.tanh(driven)

    # Add some odd harmonics for character
    shaped = shaped + 0.1 * np.tanh(driven * 3.0) * drive
    shaped = shaped / (1.0 + 0.1 * drive)

    # Tone control: lowpass filter based on tone parameter
    if tone < 1.0:
        cutoff_hz = 2000 + tone * 16000  # 2kHz to 18kHz
        sos = butter_lowpass(cutoff_hz, sample_rate, order=2)
        shaped = sosfilt(sos, shaped)

    # Restore original amplitude range
    result = shaped * max_val

    print("  Distortion applied.", flush=True)
    return result


def parse_args(args):
    """Parse command line arguments into a dict of param=value pairs."""
    params = {}
    for arg in args:
        if '=' in arg:
            key, value = arg.split('=', 1)
            # Try to convert to float or int
            try:
                if '.' in value:
                    params[key] = float(value)
                else:
                    params[key] = int(value)
            except ValueError:
                params[key] = value
        else:
            # Positional: could be band values for EQ (e.g. "31=3" format already handled)
            # Or standalone values
            pass
    return params


def main():
    if len(sys.argv) < 4:
        print("Usage: python effects.py input.wav output.wav effect_name param1=value1 param2=value2 ...", flush=True)
        print("Effects: eq, reverb, compressor, chorus, pitchshift, distortion", flush=True)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    effect_name = sys.argv[3].lower()
    param_args = sys.argv[4:]

    if not os.path.exists(input_path):
        print(f"Error: Input file not found: {input_path}", flush=True)
        sys.exit(1)

    # Read audio
    print(f"Reading: {input_path}", flush=True)
    data, sample_rate = sf.read(input_path, dtype='float64')

    # Store original shape for multi-channel handling
    original_shape = data.shape
    is_stereo = len(original_shape) == 2 and original_shape[1] == 2

    # Convert to mono for processing, then restore if needed
    if is_stereo:
        print(f"  Stereo input: {original_shape}", flush=True)
        left = data[:, 0]
        right = data[:, 1]
    else:
        left = data
        right = None

    # Parse effect-specific parameters
    params = {}
    for arg in param_args:
        if '=' in arg:
            key, value = arg.split('=', 1)
            try:
                if '.' in value:
                    params[key] = float(value)
                else:
                    params[key] = int(value)
            except ValueError:
                params[key] = value

    # Apply effect
    if effect_name == 'eq':
        # EQ expects band_gains in format: 31=3 62=6 125=3 ...
        band_gains = [0.0] * 10
        for freq, idx in zip(EQ_BANDS, range(10)):
            freq_str = str(freq)
            if freq_str in params:
                band_gains[idx] = float(params[freq_str])
            # Also support integer key strings
            if freq in params:
                band_gains[idx] = float(params[freq])
        left = apply_eq(left, sample_rate, band_gains)
        if is_stereo:
            right = apply_eq(right, sample_rate, band_gains)

    elif effect_name == 'reverb':
        mix = params.get('mix', 0.3)
        decay = params.get('decay', 2.0)
        left = apply_reverb(left, sample_rate, mix=mix, decay=decay)
        if is_stereo:
            right = apply_reverb(right, sample_rate, mix=mix, decay=decay)

    elif effect_name == 'compressor':
        threshold = params.get('threshold', -20.0)
        ratio = params.get('ratio', 4.0)
        attack = params.get('attack', 10.0)
        release = params.get('release', 100.0)
        left = apply_compressor(left, sample_rate, threshold=threshold, ratio=ratio, attack=attack, release=release)
        if is_stereo:
            right = apply_compressor(right, sample_rate, threshold=threshold, ratio=ratio, attack=attack, release=release)

    elif effect_name == 'chorus':
        rate = params.get('rate', 1.5)
        depth = params.get('depth', 0.7)
        mix = params.get('mix', 0.5)
        left = apply_chorus(left, sample_rate, rate=rate, depth=depth, mix=mix)
        if is_stereo:
            right = apply_chorus(right, sample_rate, rate=rate, depth=depth, mix=mix)

    elif effect_name == 'pitchshift':
        semitones = params.get('semitones', 0)
        semitones = max(-12, min(12, semitones))
        left = apply_pitch_shift(left, sample_rate, semitones=semitones)
        if is_stereo:
            right = apply_pitch_shift(right, sample_rate, semitones=semitones)

    elif effect_name == 'distortion':
        drive = params.get('drive', 0.5)
        tone = params.get('tone', 0.5)
        left = apply_distortion(left, sample_rate, drive=drive, tone=tone)
        if is_stereo:
            right = apply_distortion(right, sample_rate, drive=drive, tone=tone)

    else:
        print(f"Error: Unknown effect '{effect_name}'", flush=True)
        print("Available effects: eq, reverb, compressor, chorus, pitchshift, distortion", flush=True)
        sys.exit(1)

    # Reconstruct stereo if needed
    if is_stereo and right is not None:
        output_data = np.column_stack((left, right))
    else:
        output_data = left

    # Normalize to prevent clipping
    max_val = np.max(np.abs(output_data))
    if max_val > 1.0:
        output_data = output_data / max_val * 0.95

    # Write output
    print(f"Writing: {output_path}", flush=True)
    sf.write(output_path, output_data, sample_rate)
    print("Done.", flush=True)


if __name__ == '__main__':
    main()
