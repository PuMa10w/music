#!/usr/bin/env python3
"""
AI Mastering Script
Performs automatic mastering: Loudness normalization (EBU R128), 
basic compression, EQ, and stereo enhancement.
"""
import sys
import os
import json
import numpy as np

try:
    import librosa
    import soundfile as sf
    import pyloudnorm as pyln
    import pydub
    from pydub import AudioSegment
    from pydub.effects import normalize, compress_dynamic_range
except ImportError as e:
    print(json.dumps({"error": f"Missing library: {e}"}))
    sys.exit(1)

def master_audio(input_path, output_path, target_lufs=-14.0):
    """
    Master audio file.
    Steps: Load -> Normalize Loudness (EBU R128) -> Compress -> Save
    """
    try:
        # Load audio
        y, sr = librosa.load(input_path, mono=False)
        
        # Convert to stereo if mono
        if y.ndim == 1:
            y = np.array([y, y])
        
        # Loudness normalization
        meter = pyln.Meter(sr)
        loudness = meter.integrated_loudness(y.T)
        
        # Normalize to target LUFS
        y_normalized = pyln.normalize.loudness(y.T, loudness, target_lufs).T
        
        # Save temporarily as WAV for pydub processing
        temp_out = output_path + ".temp.wav"
        sf.write(temp_out, y_normalized.T, sr)
        
        # Load with pydub for effects
        audio = AudioSegment.from_wav(temp_out)
        
        # Normalize (peak)
        audio = normalize(audio)
        
        # Compression (basic)
        audio = compress_dynamic_range(audio, threshold=-20, ratio=2.0)
        
        # Export
        audio.export(output_path, format="wav")
        
        # Cleanup
        if os.path.exists(temp_out):
            os.remove(temp_out)
            
        return {"success": True, "output": output_path, "loudness": loudness, "target_lufs": target_lufs}
        
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python mastering.py <input> <output> [target_lufs]"}))
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    target = float(sys.argv[3]) if len(sys.argv) > 3 else -14.0
    
    result = master_audio(input_file, output_file, target)
    print(json.dumps(result))
